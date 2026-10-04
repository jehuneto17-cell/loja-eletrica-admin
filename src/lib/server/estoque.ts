import type { Produto } from "@/types";
import { abaixoDoMinimo } from "../status.ts";
import { adminDb, Timestamp, type Doc } from "./admin.ts";
import { ApiError, ident, inteiro, texto, type Ctx } from "./http.ts";

export type TipoManual = "entrada" | "ajuste" | "perda";

export interface MovimentoEntrada {
  produtoId: string;
  tipo: TipoManual;
  quantidade?: number; // entrada e perda, milésimos, > 0
  novoSaldo?: number; // ajuste: saldo contado, milésimos
  motivo: string;
}

export function lerMovimento(b: Record<string, unknown>): MovimentoEntrada {
  if (b.tipo !== "entrada" && b.tipo !== "ajuste" && b.tipo !== "perda") {
    throw new ApiError(400, "Tipo inválido");
  }
  return {
    produtoId: ident(b.produtoId, "Produto"),
    tipo: b.tipo,
    quantidade: b.tipo === "ajuste" ? undefined : inteiro(b.quantidade, "Quantidade", 1, 1_000_000_000),
    novoSaldo: b.tipo === "ajuste" ? inteiro(b.novoSaldo, "Saldo contado", 0, 1_000_000_000) : undefined,
    motivo: texto(b.motivo, "Motivo", 200), // regra 4: sempre com motivo
  };
}

/** Entrada, ajuste e perda. Só dono (regra 9). Saldo e movimentação na mesma transação. */
export async function movimentarEstoque(ctx: Ctx, m: MovimentoEntrada) {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`produtos/${m.produtoId}`);
    const p = (await tx.get(ref)).data() as Doc<Produto> | undefined;
    if (!p || p.lojaId !== ctx.lojaId) throw new ApiError(404, "Produto não encontrado");

    const delta =
      m.tipo === "entrada" ? m.quantidade! : m.tipo === "perda" ? -m.quantidade! : m.novoSaldo! - p.estoqueAtual;
    if (delta === 0) throw new ApiError(400, "O saldo já é esse");
    // perda maior que o saldo quase sempre é erro de digitação (50 em vez de 5): pede confirmação pelo ajuste
    if (m.tipo === "perda" && -delta > Math.max(p.estoqueAtual, 0)) {
      throw new ApiError(409, "A perda é maior que o saldo. Confira a quantidade, ou faça um ajuste de inventário.");
    }
    const saldoApos = p.estoqueAtual + delta;

    tx.update(ref, { estoqueAtual: saldoApos, abaixoDoMinimo: abaixoDoMinimo(saldoApos, p.estoqueMinimo) });
    tx.set(db.collection("movimentacoes").doc(), {
      lojaId: ctx.lojaId,
      produtoId: m.produtoId,
      tipo: m.tipo,
      quantidade: delta,
      saldoApos,
      motivo: m.motivo,
      usuarioId: ctx.uid,
      usuarioNome: ctx.nome,
      criadoEm: Timestamp.now(),
    });
    return { saldoApos };
  });
}
