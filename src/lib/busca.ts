/** Minúsculas e sem acento: "Disjuntor Monopolar" casa com "disjuntor monopolar" e "monopolár". */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Todos os termos digitados precisam aparecer em algum dos campos. */
export function casa(termo: string, ...campos: (string | undefined)[]): boolean {
  const alvo = normalizar(campos.filter(Boolean).join(" "));
  return normalizar(termo)
    .split(/\s+/)
    .every((t) => alvo.includes(t));
}
