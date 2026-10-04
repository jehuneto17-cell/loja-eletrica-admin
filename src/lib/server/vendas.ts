import { FieldValue } from "firebase-admin/firestore";
import type { ItemDocumento, Loja, Orcamento, Produto, Venda } from "@/types";
import { abaixoDoMinimo, numeroDoc, statusDoOrcamento } from "../status.ts";
import { adminDb, Timestamp, type Doc } from "./admin.ts";
import { ApiError, ident, texto, type Ctx } from "./http.ts";
import { avisosDeEstoque } from "./orcamentos.ts";

/**
 * Converte orçamento em venda: cria a venda, baixa o estoque e grava as
 * movimentações numa única transação. Regras 1, 2, 8.
 */
export async function converterEmVenda(ctx: Ctx, orcamentoId: string, formaPagamento?: string) {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const orcRef = db.doc(`orcamentos/${ident(orcamentoId, "id")}`);
    const lojaRef = db.doc(`lojas/${ctx.lojaId}`);

    // --- leituras ---
    const [orcSnap, lojaSnap] = await tx.getAll(orcRef, lojaRef);
    const o = orcSnap.data() as Doc<Orcamento> | undefined;
    const loja = lojaSnap.data() as Doc<Loja> | undefined;
    if (!o || o.lojaId !== ctx.lojaId || !loja) throw new ApiError(404, "Orçamento não encontrado");
    if (o.vendaId) throw new ApiError(409, "Esse orçamento já virou venda");
    const atual = statusDoOrcamento(o, Date.now());
    if (atual === "expirado") throw new ApiError(409, "Orçamento vencido. Duplique para atualizar os preços.");
    if (atual === "recusado") throw new ApiError(409, "Orçamento recusado não vira venda");

    const itens = (await tx.get(orcRef.collection("itens"))).docs.map((d) => d.data() as ItemDocumento);
    if (!itens.length) throw new ApiError(409, "Orçamento sem itens");
    const ids = [...new Set(itens.map((i) => i.produtoId))];
    const prodSnaps = await tx.getAll(...ids.map((id) => db.doc(`produtos/${id}`)));
    const produtos = new Map(prodSnaps.map((s) => [s.id, s.data() as Doc<Produto> | undefined]));
    for (const [, p] of produtos) {
      if (!p || p.lojaId !== ctx.lojaId) throw new ApiError(409, "Produto do orçamento não existe mais");
    }

    // regra 8: sem estoque só passa se a loja permitir
    const avisos = avisosDeEstoque(itens, produtos);
    if (avisos.length && !loja.permiteVendaSemEstoque) {
      throw new ApiError(409, `Sem estoque: ${avisos.map((a) => a.descricao).join(", ")}`);
    }

    // --- escritas ---
    const n = loja.ultimoNumeroVenda + 1;
    const numero = numeroDoc("VEN", n);
    const agora = Timestamp.now();
    const vendaRef = db.collection("vendas").doc();
    tx.update(lojaRef, { ultimoNumeroVenda: n });
    const venda: Doc<Venda> = {
      lojaId: ctx.lojaId,
      numero,
      orcamentoId,
      clienteId: o.clienteId,
      usuarioId: ctx.uid,
      total: o.total,
      formaPagamento: formaPagamento || o.formaPagamento,
      status: "concluida",
      criadoEm: agora,
    };
    tx.set(vendaRef, venda);

    // saldo corrente por produto: o mesmo produto pode estar em 2 itens
    const saldo = new Map(ids.map((id) => [id, produtos.get(id)!.estoqueAtual]));
    for (const it of itens) {
      tx.set(vendaRef.collection("itens").doc(), it);
      const novo = saldo.get(it.produtoId)! - it.quantidade;
      saldo.set(it.produtoId, novo);
      tx.set(db.collection("movimentacoes").doc(), {
        lojaId: ctx.lojaId,
        produtoId: it.produtoId,
        tipo: "venda",
        quantidade: -it.quantidade,
        saldoApos: novo,
        motivo: `Venda ${numero}`,
        vendaId: vendaRef.id,
        usuarioId: ctx.uid,
        usuarioNome: ctx.nome,
        criadoEm: agora,
      });
    }
    for (const [id, novo] of saldo) {
      tx.update(db.doc(`produtos/${id}`), {
        estoqueAtual: novo,
        abaixoDoMinimo: abaixoDoMinimo(novo, produtos.get(id)!.estoqueMinimo),
      });
    }
    tx.update(orcRef, { status: "aprovado", vendaId: vendaRef.id });

    return { vendaId: vendaRef.id, numero, negativos: avisos };
  });
}

/** Regra 3: cancelar devolve o estoque com movimentação "estorno"; nada é apagado. Só dono. */
export async function cancelarVenda(ctx: Ctx, vendaId: string, motivoTexto: unknown) {
  const motivo = texto(motivoTexto, "Motivo", 200);
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const vendaRef = db.doc(`vendas/${ident(vendaId, "id")}`);
    const vSnap = await tx.get(vendaRef);
    const v = vSnap.data() as Doc<Venda> | undefined;
    if (!v || v.lojaId !== ctx.lojaId) throw new ApiError(404, "Venda não encontrada");
    if (v.status === "cancelada") throw new ApiError(409, "Venda já cancelada");

    const itens = (await tx.get(vendaRef.collection("itens"))).docs.map((d) => d.data() as ItemDocumento);
    const ids = [...new Set(itens.map((i) => i.produtoId))];
    const prodSnaps = await tx.getAll(...ids.map((id) => db.doc(`produtos/${id}`)));
    const produtos = new Map(prodSnaps.map((s) => [s.id, s.data() as Doc<Produto> | undefined]));

    const agora = Timestamp.now();
    const saldo = new Map(ids.map((id) => [id, produtos.get(id)?.estoqueAtual ?? 0]));
    for (const it of itens) {
      if (!produtos.get(it.produtoId)) continue; // produto nunca é apagado; defesa
      const novo = saldo.get(it.produtoId)! + it.quantidade;
      saldo.set(it.produtoId, novo);
      tx.set(db.collection("movimentacoes").doc(), {
        lojaId: ctx.lojaId,
        produtoId: it.produtoId,
        tipo: "estorno",
        quantidade: it.quantidade,
        saldoApos: novo,
        motivo: `Cancelamento ${v.numero}: ${motivo}`,
        vendaId,
        usuarioId: ctx.uid,
        usuarioNome: ctx.nome,
        criadoEm: agora,
      });
    }
    for (const [id, novo] of saldo) {
      const p = produtos.get(id);
      if (!p) continue;
      tx.update(db.doc(`produtos/${id}`), {
        estoqueAtual: novo,
        abaixoDoMinimo: abaixoDoMinimo(novo, p.estoqueMinimo),
      });
    }
    tx.update(vendaRef, { status: "cancelada" });
    if (v.orcamentoId) tx.update(db.doc(`orcamentos/${v.orcamentoId}`), { vendaId: FieldValue.delete() });
    return { status: "cancelada" };
  });
}
