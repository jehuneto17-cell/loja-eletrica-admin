import { bruto, parseMoeda, parseQuantidade, totaisDocumento, type TotaisDoc } from "./calc";
import type { Unidade } from "@/types";

/** Linha do formulário: textos digitados + preço já em centavos. */
export interface ItemForm {
  key: string;
  produtoId: string;
  descricao: string;
  unidade: Unidade;
  qtd: string; // "12,5"
  preco: number; // centavos, copiado do produto (ou do item já salvo)
  desc: string; // "5,00" (R$)
}

export interface LinhaCalc {
  quantidade: number; // milésimos, NaN se inválido
  desconto: number; // centavos, NaN se inválido
  total: number;
  erro?: string;
}

/** Converte o que foi digitado e calcula os totais. `invalido` = tem erro em alguma linha. */
export function calcularForm(itens: ItemForm[], descGeral: string) {
  const geral = descGeral.trim() ? parseMoeda(descGeral) : 0;
  const linhas: LinhaCalc[] = itens.map((i) => {
    const quantidade = parseQuantidade(i.qtd);
    const desconto = i.desc.trim() ? parseMoeda(i.desc) : 0;
    if (Number.isNaN(quantidade) || quantidade <= 0) return { quantidade, desconto, total: 0, erro: "Quantidade inválida" };
    if (Number.isNaN(desconto)) return { quantidade, desconto, total: 0, erro: "Desconto inválido" };
    const b = bruto({ quantidade, precoUnitario: i.preco });
    if (desconto > b) return { quantidade, desconto, total: 0, erro: "Desconto maior que o item" };
    return { quantidade, desconto, total: b - desconto };
  });
  const erroGeral = Number.isNaN(geral) ? "Desconto no total inválido" : undefined;
  const ok = linhas.every((l) => !l.erro) && !erroGeral;
  const totais: TotaisDoc = ok
    ? totaisDocumento(
        itens.map((i, n) => ({ quantidade: linhas[n].quantidade, precoUnitario: i.preco, desconto: linhas[n].desconto })),
        geral,
      )
    : { subtotal: 0, desconto: 0, total: 0, descontoPct: 0 };
  if (ok && totais.total < 0) return { linhas, totais, geral, erroGeral: "Desconto maior que o total", invalido: true };
  return { linhas, totais, geral, erroGeral, invalido: !ok };
}
