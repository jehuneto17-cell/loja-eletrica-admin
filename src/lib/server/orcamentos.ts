import type { DocumentReference } from "firebase-admin/firestore";
import type { ItemDocumento, Loja, Orcamento, Produto, StatusOrcamento } from "@/types";
import { bruto, totaisDocumento, totalItem } from "../calc.ts";
import { numeroDoc, PROXIMOS_STATUS, statusDoOrcamento } from "../status.ts";
import { adminDb, Timestamp, type Doc } from "./admin.ts";
import { ApiError, ident, inteiro, objeto, texto, type Ctx } from "./http.ts";

const MAX_ITENS = 100; // 1 transação aguenta ~500 escritas; venda grava ~3 por item
const MAX_QUANTIDADE = 1_000_000_000; // 1 milhão de unidades, em milésimos
const DIA_MS = 86_400_000;

export interface OrcamentoEntrada {
  id?: string;
  clienteId: string;
  itens: { produtoId: string; quantidade: number; desconto?: number }[];
  descontoGeral?: number;
  validadeDias?: number;
  formaPagamento?: string;
  observacoes?: string;
}

export interface Aviso {
  produtoId: string;
  descricao: string;
  faltam: number; // milésimos
}

/** Lê e valida o corpo do cliente. */
export function lerOrcamento(b: Record<string, unknown>): OrcamentoEntrada {
  if (!Array.isArray(b.itens) || b.itens.length < 1 || b.itens.length > MAX_ITENS) {
    throw new ApiError(400, `Informe de 1 a ${MAX_ITENS} itens`);
  }
  return {
    id: b.id === undefined ? undefined : ident(b.id, "id"),
    clienteId: ident(b.clienteId, "Cliente"),
    itens: b.itens.map((raw) => {
      const i = objeto(raw, "Item");
      return {
        produtoId: ident(i.produtoId, "Produto"),
        quantidade: inteiro(i.quantidade, "Quantidade", 1, MAX_QUANTIDADE),
        desconto: i.desconto === undefined ? 0 : inteiro(i.desconto, "Desconto"),
      };
    }),
    descontoGeral: b.descontoGeral === undefined ? 0 : inteiro(b.descontoGeral, "Desconto"),
    validadeDias:
      b.validadeDias === undefined ? undefined : inteiro(b.validadeDias, "Validade", 1, 365),
    formaPagamento: texto(b.formaPagamento, "Forma de pagamento", 60, false),
    observacoes: texto(b.observacoes, "Observações", 1000, false),
  };
}

export async function salvarOrcamento(ctx: Ctx, e: OrcamentoEntrada) {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const lojaRef = db.doc(`lojas/${ctx.lojaId}`);
    const orcRef = e.id ? db.doc(`orcamentos/${e.id}`) : db.collection("orcamentos").doc();
    const ids = [...new Set(e.itens.map((i) => i.produtoId))];
    const prodRefs = ids.map((id) => db.doc(`produtos/${id}`));

    // --- leituras (todas antes das escritas) ---
    const [lojaSnap, clienteSnap, orcSnap, ...prodSnaps] = await tx.getAll(
      lojaRef,
      db.doc(`clientes/${e.clienteId}`),
      orcRef,
      ...prodRefs,
    );
    const itensAntigos = e.id ? await tx.get(orcRef.collection("itens")) : null;

    const loja = lojaSnap.data() as Doc<Loja> | undefined;
    if (!loja) throw new ApiError(404, "Loja não encontrada");
    if (clienteSnap.data()?.lojaId !== ctx.lojaId) throw new ApiError(400, "Cliente inválido");

    const antigo = orcSnap.data() as Doc<Orcamento> | undefined;
    if (e.id) {
      if (!antigo || antigo.lojaId !== ctx.lojaId) throw new ApiError(404, "Orçamento não encontrado");
      if (statusDoOrcamento(antigo) !== "rascunho") {
        throw new ApiError(409, "Só rascunho pode ser editado. Duplique o orçamento.");
      }
    }

    // regra 5: item que já estava no orçamento mantém o que foi copiado (preço, nome, unidade)
    const copiado = new Map<string, ItemDocumento>();
    itensAntigos?.docs.forEach((d) => {
      const it = d.data() as ItemDocumento;
      if (!copiado.has(it.produtoId)) copiado.set(it.produtoId, it);
    });
    const produtos = new Map(
      prodSnaps.map((s) => [s.id, s.data() as Doc<Produto> | undefined]),
    );

    const itens: ItemDocumento[] = e.itens.map((i, ordem) => {
      const p = produtos.get(i.produtoId);
      if (!p || p.lojaId !== ctx.lojaId) throw new ApiError(400, "Produto inválido");
      const antes = copiado.get(i.produtoId);
      if (!p.ativo && !antes) throw new ApiError(400, `Produto inativo: ${p.nome}`);
      const base = {
        quantidade: i.quantidade,
        precoUnitario: antes?.precoUnitario ?? p.precoVenda,
        desconto: i.desconto ?? 0,
      };
      if (bruto(base) <= 0) throw new ApiError(400, `Item com valor zero: ${p.nome}`);
      if (base.desconto > bruto(base)) throw new ApiError(400, `Desconto maior que o item: ${p.nome}`);
      return {
        ordem,
        produtoId: i.produtoId,
        descricao: antes?.descricao ?? p.nome,
        unidade: antes?.unidade ?? p.unidade,
        ...base,
        total: totalItem(base),
      };
    });

    const t = totaisDocumento(itens, e.descontoGeral ?? 0);
    if (t.total < 0) throw new ApiError(400, "Desconto maior que o total");
    // regra 10: acima do limite só o dono
    if (ctx.perfil !== "dono" && t.descontoPct > loja.descontoMaxVendedorPct) {
      throw new ApiError(
        403,
        `Desconto de ${t.descontoPct.toFixed(1)}% passa do limite de ${loja.descontoMaxVendedorPct}%. Peça ao dono.`,
      );
    }

    // --- escritas ---
    let numero = antigo?.numero;
    if (!antigo) {
      const n = loja.ultimoNumeroOrcamento + 1;
      numero = numeroDoc("ORC", n);
      tx.update(lojaRef, { ultimoNumeroOrcamento: n });
    }
    const agora = Timestamp.now();
    // validade: orçamento novo conta a partir de agora; edição conta a partir da criação
    // (editar não "renova" um rascunho velho com o preço copiado de meses atrás)
    const padrao = Number.isInteger(loja.validadePadraoDias) && loja.validadePadraoDias > 0 ? loja.validadePadraoDias : 15;
    const base = antigo ? antigo.criadoEm.toMillis() : agora.toMillis();
    const dias = e.validadeDias ?? (antigo ? undefined : padrao);
    const validade = dias ? Timestamp.fromMillis(base + dias * DIA_MS) : antigo!.validade;

    const doc: Doc<Orcamento> = {
      lojaId: ctx.lojaId,
      numero: numero!,
      clienteId: e.clienteId,
      usuarioId: antigo?.usuarioId ?? ctx.uid,
      status: "rascunho",
      subtotal: t.subtotal,
      desconto: t.desconto,
      total: t.total,
      validade,
      formaPagamento: e.formaPagamento || undefined,
      observacoes: e.observacoes || undefined,
      criadoEm: antigo?.criadoEm ?? agora,
      // editar invalida os links de PDF já enviados (mostrariam dados que mudaram)
      ...(antigo ? { linkRevogadoEm: agora.toMillis() } : {}),
    };
    tx.set(orcRef, doc);
    itensAntigos?.docs.forEach((d) => tx.delete(d.ref));
    itens.forEach((it) => tx.set(orcRef.collection("itens").doc(), it));

    return { id: orcRef.id, numero: numero!, avisos: avisosDeEstoque(itens, produtos) };
  });
}

export function avisosDeEstoque(
  itens: ItemDocumento[],
  produtos: Map<string, Doc<Produto> | undefined>,
): Aviso[] {
  const pedido = new Map<string, number>();
  itens.forEach((i) => pedido.set(i.produtoId, (pedido.get(i.produtoId) ?? 0) + i.quantidade));
  const avisos: Aviso[] = [];
  for (const [produtoId, q] of pedido) {
    const p = produtos.get(produtoId);
    if (p && q > p.estoqueAtual) {
      avisos.push({ produtoId, descricao: p.nome, faltam: q - Math.max(p.estoqueAtual, 0) });
    }
  }
  return avisos;
}

async function carregar(ctx: Ctx, ref: DocumentReference, tx: FirebaseFirestore.Transaction) {
  const snap = await tx.get(ref);
  const o = snap.data() as Doc<Orcamento> | undefined;
  if (!o || o.lojaId !== ctx.lojaId) throw new ApiError(404, "Orçamento não encontrado");
  return o;
}

export async function mudarStatus(ctx: Ctx, id: string, novo: StatusOrcamento) {
  const ref = adminDb().doc(`orcamentos/${ident(id, "id")}`);
  return adminDb().runTransaction(async (tx) => {
    const o = await carregar(ctx, ref, tx);
    const atual = statusDoOrcamento(o);
    if (atual === "expirado") throw new ApiError(409, "Orçamento vencido. Duplique para atualizar os preços.");
    if (!PROXIMOS_STATUS[atual].includes(novo)) {
      throw new ApiError(409, `Não dá para mudar de ${atual} para ${novo}`);
    }
    if (o.vendaId) throw new ApiError(409, "Orçamento já virou venda. Cancele a venda antes.");
    // recusado: o link que já foi para o cliente deixa de abrir
    tx.update(ref, novo === "recusado" ? { status: novo, linkRevogadoEm: Date.now() } : { status: novo });
    return { status: novo };
  });
}

/**
 * Regra 6: duplica com os preços de hoje, como rascunho novo. Produto que ficou
 * inativo é descartado e o desconto é limitado ao novo valor (o preço pode ter caído).
 */
export async function duplicarOrcamento(ctx: Ctx, id: string) {
  const db = adminDb();
  const ref = db.doc(`orcamentos/${ident(id, "id")}`);
  const o = (await ref.get()).data() as Doc<Orcamento> | undefined;
  if (!o || o.lojaId !== ctx.lojaId) throw new ApiError(404, "Orçamento não encontrado");
  const itens = (await ref.collection("itens").orderBy("ordem").get()).docs.map((d) => d.data() as ItemDocumento);
  const ids = [...new Set(itens.map((i) => i.produtoId))];
  const snaps = ids.length ? await db.getAll(...ids.map((p) => db.doc(`produtos/${p}`))) : [];
  const produtos = new Map(snaps.map((s) => [s.id, s.data() as Doc<Produto> | undefined]));

  const novos = itens.flatMap((i) => {
    const p = produtos.get(i.produtoId);
    if (!p || p.lojaId !== ctx.lojaId || !p.ativo) return [];
    const teto = bruto({ quantidade: i.quantidade, precoUnitario: p.precoVenda });
    return [{ produtoId: i.produtoId, quantidade: i.quantidade, desconto: Math.min(i.desconto, teto) }];
  });
  if (!novos.length) throw new ApiError(409, "Nenhum produto deste orçamento está ativo para duplicar");

  const subtotal = novos.reduce((s, i) => {
    const p = produtos.get(i.produtoId)!;
    return s + bruto({ quantidade: i.quantidade, precoUnitario: p.precoVenda }) - i.desconto;
  }, 0);
  // salvarOrcamento recopia o preço atual (sem id => nada a preservar)
  const r = await salvarOrcamento(ctx, {
    clienteId: o.clienteId,
    itens: novos,
    descontoGeral: Math.min(o.desconto, subtotal),
    formaPagamento: o.formaPagamento,
    observacoes: o.observacoes,
  });
  return { ...r, descartados: itens.length - novos.length };
}
