import { formatQuantidade } from "@/lib/calc";
import type { Produto } from "@/types";
import Selo from "./ui/Selo";

/** Saldo com cor: negativo = vermelho em destaque (regra 8), no mínimo ou abaixo = amarelo. */
export default function SeloEstoque({ p }: { p: Pick<Produto, "estoqueAtual" | "estoqueMinimo" | "unidade" | "abaixoDoMinimo"> }) {
  const texto = `${formatQuantidade(p.estoqueAtual)} ${p.unidade}`;
  if (p.estoqueAtual < 0) return <Selo tom="vermelho">{texto} (negativo)</Selo>;
  if (p.abaixoDoMinimo) return <Selo tom="amarelo">{texto} · baixo</Selo>;
  return <span className="font-medium">{texto}</span>;
}
