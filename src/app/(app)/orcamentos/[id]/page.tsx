"use client";
import { collection, limit, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import AcoesOrcamento from "@/components/AcoesOrcamento";
import CartaoVenda from "@/components/CartaoVenda";
import SeloStatus from "@/components/SeloStatus";
import Aviso from "@/components/ui/Aviso";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";
import Cartao from "@/components/ui/Cartao";
import Vazio from "@/components/ui/Vazio";
import { useAuth } from "@/context/AuthContext";
import { useColecao } from "@/hooks/useColecao";
import { useDocumento } from "@/hooks/useDocumento";
import { useAgora } from "@/hooks/useAgora";
import { useProdutos } from "@/hooks/useProdutos";
import { formatMoeda, formatQuantidade } from "@/lib/calc";
import { formatData } from "@/lib/datas";
import { db } from "@/lib/firebase";
import { statusDoOrcamento } from "@/lib/status";
import type { Cliente, ItemDocumento, Orcamento } from "@/types";

export default function OrcamentoPagina() {
  const { id } = useParams<{ id: string }>();
  const { loja } = useAuth();
  const orc = useDocumento<Orcamento>(`orcamentos/${id}`);
  const cliente = useDocumento<Cliente>(orc.dado ? `clientes/${orc.dado.clienteId}` : null);
  const itens = useColecao<ItemDocumento>(`orc-itens:${id}`, () => query(collection(db, "orcamentos", id, "itens"), orderBy("ordem"), limit(100)));
  const produtos = useProdutos().dados;
  const agora = useAgora();
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  if (orc.carregando) return <Carregando />;
  const o = orc.dado;
  if (!o || o.lojaId !== loja!.id) {
    return <Vazio texto="Orçamento não encontrado." acao={<Link href="/orcamentos" className="font-semibold text-primary">Voltar</Link>} />;
  }
  const status = statusDoOrcamento(o, agora);
  // regra 1: só avisa; o saldo só muda na venda
  // soma por produto: o servidor também soma linhas repetidas do mesmo produto
  const pedido = new Map<string, number>();
  if (!o.vendaId) itens.dados.forEach((i) => pedido.set(i.produtoId, (pedido.get(i.produtoId) ?? 0) + i.quantidade));
  const faltas = [...pedido]
    .map(([produtoId, qtd]) => ({ p: porId.get(produtoId), qtd }))
    .filter((x): x is { p: NonNullable<typeof x.p>; qtd: number } => !!x.p && x.qtd > x.p.estoqueAtual);

  return (
    <>
      <CabecalhoPagina
        titulo={o.numero}
        subtitulo={`${cliente.dado?.nome ?? "…"} · emitido em ${formatData(o.criadoEm)} · ${status === "expirado" ? "venceu" : "válido até"} ${formatData(o.validade)}`}
        acoes={<SeloStatus status={status} />}
      />
      <div className="space-y-4">
        {status === "expirado" ? <Aviso tipo="alerta">Orçamento vencido: não dá para converter em venda. Use “Duplicar” para gerar um novo com os preços de hoje.</Aviso> : null}
        {faltas.length ? (
          <Aviso tipo="alerta">
            Estoque insuficiente hoje: {faltas.map(({ p, qtd }) => `${p.nome} (pede ${formatQuantidade(qtd)}, tem ${formatQuantidade(p.estoqueAtual)})`).join("; ")}.
            {loja!.permiteVendaSemEstoque ? " A venda é permitida e o saldo ficará negativo." : " A venda será bloqueada até entrar mercadoria."}
          </Aviso>
        ) : null}

        <AcoesOrcamento orc={o} status={status} cliente={cliente.dado ?? undefined} nomeLoja={loja!.nome} />

        {o.vendaId ? <CartaoVenda vendaId={o.vendaId} /> : null}

        <Cartao titulo="Itens">
          {itens.carregando ? <Carregando /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-300 text-xs uppercase text-gray-600">
                  <tr><th className="py-2 pr-3">Produto</th><th className="py-2 pr-3 text-right">Qtd.</th><th className="hidden py-2 pr-3 text-right sm:table-cell">Preço</th><th className="hidden py-2 pr-3 text-right sm:table-cell">Desc.</th><th className="py-2 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-300/60">
                  {itens.dados.map((i) => (
                    <tr key={i.id}>
                      <td className="py-2 pr-3">{i.descricao}</td>
                      <td className="py-2 pr-3 text-right">{formatQuantidade(i.quantidade)} {i.unidade}</td>
                      <td className="hidden py-2 pr-3 text-right sm:table-cell">{formatMoeda(i.precoUnitario)}</td>
                      <td className="hidden py-2 pr-3 text-right sm:table-cell">{i.desconto ? formatMoeda(i.desconto) : "—"}</td>
                      <td className="py-2 text-right font-medium">{formatMoeda(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoeda(o.subtotal)}</span></div>
            {o.desconto ? <div className="flex justify-between"><span>Desconto no total</span><span>- {formatMoeda(o.desconto)}</span></div> : null}
            <div className="flex justify-between border-t border-gray-300 pt-2 text-lg font-bold"><span>Total</span><span>{formatMoeda(o.total)}</span></div>
          </div>
        </Cartao>

        {o.formaPagamento || o.observacoes ? (
          <Cartao titulo="Condições">
            {o.formaPagamento ? <p className="text-sm"><b>Pagamento:</b> {o.formaPagamento}</p> : null}
            {o.observacoes ? <p className="text-sm"><b>Observações:</b> {o.observacoes}</p> : null}
          </Cartao>
        ) : null}
      </div>
    </>
  );
}
