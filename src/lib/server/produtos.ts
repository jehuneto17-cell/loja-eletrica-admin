import { FieldValue } from "firebase-admin/firestore";
import type { Produto, Unidade } from "@/types";
import { abaixoDoMinimo } from "../status.ts";
import { adminDb, Timestamp, type Doc } from "./admin.ts";
import { ApiError, ident, inteiro, objeto, texto, type Ctx } from "./http.ts";

export const UNIDADES: Unidade[] = ["un", "m", "rolo", "cx", "kg"];
// 3 escritas por linha nova (produto + trava de código + saldo inicial) dentro de 1 transação de até 500
export const MAX_LINHAS_IMPORTACAO = 100;
const PRECO_MAX = 100_000_000; // R$ 1.000.000,00 em centavos
const QTD_MAX = 1_000_000_000;

export interface ProdutoEntrada {
  id?: string;
  codigo: string;
  nome: string;
  categoria?: string;
  marca?: string;
  unidade: Unidade;
  precoVenda: number;
  estoqueMinimo: number;
  ativo: boolean;
  estoqueInicial?: number; // só produto novo (cadastro e importação)
}

export function lerProduto(raw: unknown): ProdutoEntrada {
  const b = objeto(raw, "Produto");
  if (!UNIDADES.includes(b.unidade as Unidade)) throw new ApiError(400, "Unidade inválida");
  return {
    id: b.id === undefined ? undefined : ident(b.id, "id"),
    codigo: texto(b.codigo, "Código", 40).toUpperCase(),
    nome: texto(b.nome, "Nome", 120),
    categoria: texto(b.categoria, "Categoria", 60, false),
    marca: texto(b.marca, "Marca", 60, false),
    unidade: b.unidade as Unidade,
    precoVenda: inteiro(b.precoVenda, "Preço", 1, PRECO_MAX),
    estoqueMinimo: inteiro(b.estoqueMinimo ?? 0, "Estoque mínimo", 0, QTD_MAX),
    ativo: b.ativo !== false,
    estoqueInicial: b.estoqueInicial === undefined ? undefined : inteiro(b.estoqueInicial, "Estoque inicial", 0, QTD_MAX),
  };
}

// Unicidade do código por loja: um documento "trava" por (loja, código), criado na mesma
// transação do produto. Consulta por campo não impede dois cadastros simultâneos.
const travaRef = (lojaId: string, codigo: string) =>
  adminDb().doc(`codigos/${lojaId}__${encodeURIComponent(codigo)}`);

async function acharPorCodigo(
  tx: FirebaseFirestore.Transaction,
  lojaId: string,
  codigo: string,
): Promise<string | undefined> {
  const trava = await tx.get(travaRef(lojaId, codigo));
  if (trava.exists) return trava.data()!.produtoId as string;
  // produto anterior à trava (sem documento de código): cai na consulta por campo
  const q = await tx.get(
    adminDb().collection("produtos").where("lojaId", "==", lojaId).where("codigo", "==", codigo).limit(1),
  );
  return q.docs[0]?.id;
}

const opcional = (v: string | undefined) => v || FieldValue.delete(); // só em update: "" limpa o campo

function movimentoInicial(ctx: Ctx, produtoId: string, saldo: number, agora: FirebaseFirestore.Timestamp, motivo: string) {
  return {
    lojaId: ctx.lojaId,
    produtoId,
    tipo: "entrada",
    quantidade: saldo,
    saldoApos: saldo,
    motivo,
    usuarioId: ctx.uid,
    usuarioNome: ctx.nome,
    criadoEm: agora,
  };
}

/** Cria ou edita produto. Só dono. Saldo de produto existente nunca é editado aqui: usa movimentação. */
export async function salvarProduto(ctx: Ctx, e: ProdutoEntrada) {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const existente = await acharPorCodigo(tx, ctx.lojaId, e.codigo);
    if (existente && existente !== e.id) throw new ApiError(409, `Já existe um produto com o código ${e.codigo}`);

    const ref = e.id ? db.doc(`produtos/${e.id}`) : db.collection("produtos").doc();
    const atual = e.id ? ((await tx.get(ref)).data() as Doc<Produto> | undefined) : undefined;
    if (e.id && (!atual || atual.lojaId !== ctx.lojaId)) throw new ApiError(404, "Produto não encontrado");

    const campos = {
      codigo: e.codigo,
      nome: e.nome,
      unidade: e.unidade,
      precoVenda: e.precoVenda,
      estoqueMinimo: e.estoqueMinimo,
      ativo: e.ativo,
    };
    if (!atual) {
      const saldo = e.estoqueInicial ?? 0;
      const novo: Doc<Produto> = {
        lojaId: ctx.lojaId,
        ...campos,
        categoria: e.categoria || undefined,
        marca: e.marca || undefined,
        estoqueAtual: saldo,
        abaixoDoMinimo: abaixoDoMinimo(saldo, e.estoqueMinimo),
      };
      tx.set(ref, novo);
      tx.set(travaRef(ctx.lojaId, e.codigo), { produtoId: ref.id });
      if (saldo > 0) {
        tx.set(db.collection("movimentacoes").doc(), movimentoInicial(ctx, ref.id, saldo, Timestamp.now(), "Saldo inicial"));
      }
      return { id: ref.id };
    }
    if (atual.codigo !== e.codigo) tx.delete(travaRef(ctx.lojaId, atual.codigo));
    tx.set(travaRef(ctx.lojaId, e.codigo), { produtoId: ref.id }); // também "migra" produto antigo sem trava
    tx.update(ref, {
      ...campos,
      categoria: opcional(e.categoria),
      marca: opcional(e.marca),
      abaixoDoMinimo: abaixoDoMinimo(atual.estoqueAtual, e.estoqueMinimo),
    });
    return { id: ref.id };
  });
}

export interface ResultadoImportacao {
  criados: number;
  atualizados: number;
}

/**
 * Importação em lote (validada no cliente, revalidada aqui). Código existente: atualiza os
 * dados, sem mexer no saldo e sem reativar produto inativo. Tudo ou nada.
 */
export async function importarProdutos(ctx: Ctx, linhas: ProdutoEntrada[]): Promise<ResultadoImportacao> {
  if (!linhas.length || linhas.length > MAX_LINHAS_IMPORTACAO) {
    throw new ApiError(400, `Envie de 1 a ${MAX_LINHAS_IMPORTACAO} linhas por vez`);
  }
  const codigos = linhas.map((l) => l.codigo);
  if (new Set(codigos).size !== codigos.length) throw new ApiError(400, "Código repetido na planilha");

  const db = adminDb();
  return db.runTransaction(async (tx) => {
    // leituras primeiro
    const lidos = [];
    for (const l of linhas) {
      const id = await acharPorCodigo(tx, ctx.lojaId, l.codigo);
      const atual = id ? ((await tx.get(db.doc(`produtos/${id}`))).data() as Doc<Produto> | undefined) : undefined;
      if (id && (!atual || atual.lojaId !== ctx.lojaId)) throw new ApiError(409, `Código ${l.codigo} em conflito`);
      lidos.push({ l, id, atual });
    }

    const agora = Timestamp.now();
    let criados = 0;
    let atualizados = 0;
    for (const { l, id, atual } of lidos) {
      const campos = {
        codigo: l.codigo,
        nome: l.nome,
        unidade: l.unidade,
        precoVenda: l.precoVenda,
        estoqueMinimo: l.estoqueMinimo,
      };
      if (id && atual) {
        tx.update(db.doc(`produtos/${id}`), {
          ...campos,
          categoria: opcional(l.categoria),
          marca: opcional(l.marca),
          abaixoDoMinimo: abaixoDoMinimo(atual.estoqueAtual, l.estoqueMinimo),
        });
        tx.set(travaRef(ctx.lojaId, l.codigo), { produtoId: id });
        atualizados++;
        continue;
      }
      const ref = db.collection("produtos").doc();
      const saldo = l.estoqueInicial ?? 0;
      tx.set(ref, {
        lojaId: ctx.lojaId,
        ...campos,
        categoria: l.categoria || undefined,
        marca: l.marca || undefined,
        ativo: true,
        estoqueAtual: saldo,
        abaixoDoMinimo: abaixoDoMinimo(saldo, l.estoqueMinimo),
      } satisfies Doc<Produto>);
      tx.set(travaRef(ctx.lojaId, l.codigo), { produtoId: ref.id });
      if (saldo > 0) {
        tx.set(db.collection("movimentacoes").doc(), movimentoInicial(ctx, ref.id, saldo, agora, "Saldo inicial (importação)"));
      }
      criados++;
    }
    return { criados, atualizados };
  });
}
