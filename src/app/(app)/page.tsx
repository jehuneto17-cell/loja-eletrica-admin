"use client";
import { collection, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import Link from "next/link";
import CartaoNumero from "@/components/CartaoNumero";
import SeloStatus from "@/components/SeloStatus";
import Aviso from "@/components/ui/Aviso";
import Cartao from "@/components/ui/Cartao";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";
import Vazio from "@/components/ui/Vazio";
import { useAuth } from "@/context/AuthContext";
import { useAgora } from "@/hooks/useAgora";
import { useColecao } from "@/hooks/useColecao";
import { formatMoeda, formatQuantidade } from "@/lib/calc";
import { formatData, inicioDoDia, inicioDoMes } from "@/lib/datas";
import { db } from "@/lib/firebase";
import { statusDoOrcamento } from "@/lib/status";
import type { Orcamento, Produto, Venda } from "@/types";

export default function Inicio() {
  const { loja } = useAuth();
  const lojaId = loja!.id;
  const agora = useAgora();
  // recalcula ao virar o dia/mês (a key da consulta muda junto e o listener é refeito)
  const mes = inicioDoMes(new Date(agora));
  const dia = inicioDoDia(new Date(agora));

  const orcs = useColecao<Orcamento>(`orc-mes:${lojaId}:${mes.getTime()}`, () =>
    query(
      collection(db, "orcamentos"),
      where("lojaId", "==", lojaId),
      where("criadoEm", ">=", Timestamp.fromDate(mes)),
      orderBy("criadoEm", "desc"),
      limit(500),
    ),
  );
  const vendas = useColecao<Venda>(`ven-dia:${lojaId}:${dia.getTime()}`, () =>
    query(
      collection(db, "vendas"),
      where("lojaId", "==", lojaId),
      where("criadoEm", ">=", Timestamp.fromDate(dia)),
      orderBy("criadoEm", "desc"),
      limit(200),
    ),
  );
  const baixos = useColecao<Produto>(`baixo:${lojaId}`, () =>
    query(
      collection(db, "produtos"),
      where("lojaId", "==", lojaId),
      where("abaixoDoMinimo", "==", true),
      orderBy("nome"),
      limit(50),
    ),
  );

  const vendasOk = vendas.dados.filter((v) => v.status === "concluida");
  const totalVendas = vendasOk.reduce((s, v) => s + v.total, 0);
  const totalOrc = orcs.dados.reduce((s, o) => s + o.total, 0);
  const ativosBaixos = baixos.dados.filter((p) => p.ativo);
  const erro = orcs.erro ?? vendas.erro ?? baixos.erro;

  return (
    <>
      <CabecalhoPagina
        titulo="Início"
        subtitulo={`Resumo de ${mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
        acoes={
          <Link href="/orcamentos/novo" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            + Novo orçamento
          </Link>
        }
      />
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {orcs.carregando || vendas.carregando || baixos.carregando ? <Carregando /> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <CartaoNumero titulo="Orçamentos no mês" valor={String(orcs.dados.length)} detalhe={`${formatMoeda(totalOrc)} em propostas`} href="/orcamentos" />
        <CartaoNumero titulo="Vendas hoje" valor={formatMoeda(totalVendas)} detalhe={`${vendasOk.length} venda(s)`} />
        <CartaoNumero
          titulo="Estoque baixo"
          valor={baixos.dados.length >= 50 ? "50+" : String(ativosBaixos.length)}
          detalhe="produtos no mínimo ou abaixo"
          href="/estoque"
          alerta={ativosBaixos.length > 0}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Orçamentos recentes" acao={<Link href="/orcamentos" className="text-sm font-semibold text-primary">Ver todos</Link>}>
          {orcs.dados.length === 0 ? (
            <Vazio texto="Nenhum orçamento neste mês ainda." />
          ) : (
            <ul className="divide-y divide-gray-300/60">
              {orcs.dados.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <Link href={`/orcamentos/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-gray-100">
                    <span>
                      <span className="font-semibold">{o.numero}</span>
                      <span className="block text-xs text-gray-600">{formatData(o.criadoEm)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <SeloStatus status={statusDoOrcamento(o)} />
                      <span className="w-24 text-right font-medium">{formatMoeda(o.total)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Produtos acabando" acao={<Link href="/estoque" className="text-sm font-semibold text-primary">Estoque</Link>}>
          {ativosBaixos.length === 0 ? (
            <Vazio texto="Nenhum produto abaixo do mínimo." />
          ) : (
            <ul className="divide-y divide-gray-300/60">
              {ativosBaixos.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="font-semibold">{p.nome}</span>
                    <span className="block text-xs text-gray-600">{p.codigo}</span>
                  </span>
                  <span className={`font-semibold ${p.estoqueAtual <= 0 ? "text-danger" : "text-yellow-800"}`}>
                    {formatQuantidade(p.estoqueAtual)} {p.unidade}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
