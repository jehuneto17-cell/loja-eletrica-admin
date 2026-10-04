// Aritmética de dinheiro e quantidade. Tudo inteiro: centavos e milésimos.
// Sem dependências, usado no cliente e no servidor.

export interface ItemCalc {
  quantidade: number; // milésimos
  precoUnitario: number; // centavos
  desconto: number; // centavos
}

/** Converte "8,90", "R$ 1.234,56" ou "8.9" em centavos. NaN se inválido. */
export function parseMoeda(texto: string): number {
  return parseDecimal(texto, 2);
}

/** Converte "12,5" em 12500 (milésimos). NaN se inválido. */
export function parseQuantidade(texto: string): number {
  return parseDecimal(texto, 3);
}

// String -> inteiro escalado, sem passar por float (1.005 * 100 erra em float).
function parseDecimal(texto: string, casas: number): number {
  let t = texto.replace(/R\$|\s/g, "");
  // com vírgula, o ponto é separador de milhar ("1.234,56")
  // "1.500" sem vírgula pode ser 1,5 ou 1500 (milhar): recusa em vez de adivinhar
  if (!t.includes(",") && /^\d{1,3}(\.\d{3})+$/.test(t)) return NaN;
  t = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(t);
  if (!m) return NaN;
  const dec = m[2] ?? "";
  if (dec.length > casas) return NaN; // não arredonda em silêncio
  return Number(m[1] + dec.padEnd(casas, "0"));
}

export function formatMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatQuantidade(milesimos: number): string {
  return (milesimos / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** Valor de entrada de formulário: centavos -> "8,90" */
export function moedaParaInput(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export function quantidadeParaInput(milesimos: number): string {
  return String(milesimos / 1000).replace(".", ",");
}

/** quantidade (milésimos) x preço (centavos) -> centavos, arredondado. */
export function bruto(i: Pick<ItemCalc, "quantidade" | "precoUnitario">): number {
  return Math.round((i.quantidade * i.precoUnitario) / 1000);
}

export function totalItem(i: ItemCalc): number {
  return bruto(i) - i.desconto;
}

export interface TotaisDoc {
  subtotal: number; // soma dos itens já com desconto por item
  desconto: number; // desconto no total
  total: number;
  descontoPct: number; // desconto efetivo (itens + total) sobre o bruto
}

export function totaisDocumento(itens: ItemCalc[], descontoGeral: number): TotaisDoc {
  const somaBruto = itens.reduce((s, i) => s + bruto(i), 0);
  const subtotal = itens.reduce((s, i) => s + totalItem(i), 0);
  const descontoTotal = itens.reduce((s, i) => s + i.desconto, 0) + descontoGeral;
  return {
    subtotal,
    desconto: descontoGeral,
    total: subtotal - descontoGeral,
    descontoPct: somaBruto > 0 ? (descontoTotal / somaBruto) * 100 : 0,
  };
}
