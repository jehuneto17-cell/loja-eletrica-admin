import type { StatusOrcamento } from "@/types";

/**
 * Orçamento vencido vira "expirado" na leitura, sem job agendado.
 * Vale para rascunho, enviado e também aprovado que ainda não virou venda:
 * senão um orçamento aprovado converteria para sempre com preço congelado.
 */
export function statusEfetivo(
  status: StatusOrcamento,
  validadeMs: number,
  agoraMs: number = Date.now(),
  temVenda = false,
): StatusOrcamento {
  const pendente = status === "rascunho" || status === "enviado" || (status === "aprovado" && !temVenda);
  return pendente && validadeMs < agoraMs ? "expirado" : status;
}

/** Atalho para um documento de orçamento (cliente ou servidor). */
export function statusDoOrcamento(
  o: { status: StatusOrcamento; validade: { toMillis(): number }; vendaId?: string },
  agoraMs: number = Date.now(),
): StatusOrcamento {
  return statusEfetivo(o.status, o.validade.toMillis(), agoraMs, !!o.vendaId);
}

/** Transições permitidas. Aprovado -> recusado só sem venda (checado no servidor). */
export const PROXIMOS_STATUS: Record<StatusOrcamento, StatusOrcamento[]> = {
  rascunho: ["enviado", "aprovado", "recusado"],
  enviado: ["aprovado", "recusado"],
  aprovado: ["recusado"],
  recusado: [],
  expirado: [],
};

/** Saldo negativo (venda sem estoque, regra 8) também entra no alerta, mesmo com mínimo 0. */
export function abaixoDoMinimo(estoqueAtual: number, estoqueMinimo: number): boolean {
  return estoqueAtual < 0 || (estoqueMinimo > 0 && estoqueAtual <= estoqueMinimo);
}

export function numeroDoc(prefixo: "ORC" | "VEN", n: number): string {
  return `${prefixo}-${String(n).padStart(4, "0")}`;
}
