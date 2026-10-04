import { createHmac, timingSafeEqual } from "node:crypto";

// O cliente do WhatsApp abre o PDF sem login, então o link carrega uma assinatura
// HMAC com validade. Sem PDF_LINK_SECRET não gera link. Para revogar um link sem
// trocar o segredo, o orçamento guarda `linkRevogadoEm`: links emitidos antes
// dessa data (emissão = exp - TTL) deixam de valer.
export const TTL_MS = 7 * 86_400_000;

function segredo(): string {
  const s = process.env.PDF_LINK_SECRET;
  if (!s || s.length < 16) throw new Error("PDF_LINK_SECRET ausente ou curto (mín. 16 caracteres)");
  return s;
}

function assinar(id: string, exp: number): string {
  return createHmac("sha256", segredo()).update(`${id}.${exp}`).digest("base64url");
}

export function linkPdf(origem: string, id: string, agora = Date.now()): string {
  const exp = agora + TTL_MS;
  return `${origem}/api/pdf/${id}?exp=${exp}&sig=${assinar(id, exp)}`;
}

export function linkPdfValido(id: string, exp: string | null, sig: string | null, agora = Date.now()): boolean {
  const e = Number(exp);
  if (!sig || !Number.isFinite(e) || e < agora) return false;
  const esperado = Buffer.from(assinar(id, e));
  const recebido = Buffer.from(sig);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/** O link foi emitido antes da revogação do orçamento? (emissão = exp - TTL) */
export function linkRevogado(exp: number, revogadoEm: number | undefined): boolean {
  return revogadoEm !== undefined && exp - TTL_MS < revogadoEm;
}
