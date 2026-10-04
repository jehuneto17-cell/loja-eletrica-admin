/** Só dígitos; sem DDI (10 ou 11 dígitos) assume Brasil (55). Vazio se não parecer telefone. */
export function telefoneWhatsapp(tel: string | undefined): string {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 13) return d;
  return "";
}

/** wa.me com texto pronto. Sem telefone válido abre o WhatsApp para escolher o contato. */
export function linkWhatsapp(tel: string | undefined, texto: string): string {
  return `https://wa.me/${telefoneWhatsapp(tel)}?text=${encodeURIComponent(texto)}`;
}
