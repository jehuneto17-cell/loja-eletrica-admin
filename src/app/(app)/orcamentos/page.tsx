"use client";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { useMemo, useState } from "react";
import SeloStatus from "@/components/SeloStatus";
import Aviso from "@/components/ui/Aviso";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";
import Cartao from "@/components/ui/Cartao";
import { inputCls } from "@/components/ui/estilos";
import Vazio from "@/components/ui/Vazio";
import { useAuth } from "@/context/AuthContext";
import { useAgora } from "@/hooks/useAgora";
import { useClientes } from "@/hooks/useClientes";
import { useColecao } from "@/hooks/useColecao";
import { casa } from "@/lib/busca";
import { formatMoeda } from "@/lib/calc";
import { formatData } from "@/lib/datas";
import { db } from "@/lib/firebase";
import { statusDoOrcamento } from "@/lib/status";
import type { Orcamento, StatusOrcamento } from "@/types";

const PAGINA = 100;
const DIA = 86_400_000;

export default function Orcamentos() {
  const lojaId = useAuth().loja!.id;
  const [qtd, setQtd] = useState(PAGINA);
  const [status, setStatus] = useState<"" | StatusOrcamento>("");
  const [periodo, setPeriodo] = useState("tudo");
  const [busca, setBusca] = useState("");
  const agora = useAgora();

  const { dados, carregando, erro } = useColecao<Orcamento>(`orc:${lojaId}:${qtd}`, () =>
    query(collection(db, "orcamentos"), where("lojaId", "==", lojaId), orderBy("criadoEm", "desc"), limit(qtd)),
  );
  const clientes = useClientes().dados;
  const nomes = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);

  const filtrados = useMemo(() => {
    const corte = periodo === "tudo" ? 0 : agora - Number(periodo) * DIA;
    return dados.filter(
      (o) =>
        (!status || statusDoOrcamento(o, agora) === status) &&
        o.criadoEm.toMillis() >= corte &&
        (!busca || casa(busca, o.numero, nomes.get(o.clienteId))),
    );
  }, [dados, status, periodo, busca, nomes, agora]);

  return (
    <>
      <CabecalhoPagina
        titulo="Orçamentos"
        acoes={<Link href="/orcamentos/novo" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">+ Novo orçamento</Link>}
      />
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Cartao>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_170px_170px]">
          <input type="search" placeholder="Buscar por número ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} className={inputCls} aria-label="Buscar orçamento" />
          <select value={status} onChange={(e) => setStatus(e.target.value as "" | StatusOrcamento)} className={inputCls} aria-label="Status">
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="enviado">Enviado</option>
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
            <option value="expirado">Expirado</option>
          </select>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={inputCls} aria-label="Período">
            <option value="tudo">Todo o período</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
        {carregando && !dados.length ? (
          <Carregando />
        ) : filtrados.length === 0 ? (
          <Vazio texto={dados.length ? "Nenhum orçamento com esse filtro." : "Nenhum orçamento ainda."} acao={dados.length ? undefined : <Link href="/orcamentos/novo" className="font-semibold text-primary">Criar o primeiro</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-300 text-xs uppercase text-gray-600">
                <tr><th className="py-2 pr-3">Número</th><th className="py-2 pr-3">Cliente</th><th className="py-2 pr-3">Status</th><th className="hidden py-2 pr-3 sm:table-cell">Data</th><th className="py-2 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-300/60">
                {filtrados.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-100">
                    <td className="py-3 pr-3"><Link href={`/orcamentos/${o.id}`} className="font-semibold text-gray-900 hover:text-primary">{o.numero}</Link></td>
                    <td className="py-3 pr-3">{nomes.get(o.clienteId) ?? "—"}</td>
                    <td className="py-3 pr-3"><SeloStatus status={statusDoOrcamento(o, agora)} /></td>
                    <td className="hidden py-3 pr-3 sm:table-cell">{formatData(o.criadoEm)}</td>
                    <td className="py-3 text-right font-medium">{formatMoeda(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dados.length >= qtd ? (
          <button type="button" onClick={() => setQtd((q) => q + PAGINA)} className="mt-3 w-full rounded-md border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100">
            Carregar mais antigos
          </button>
        ) : null}
      </Cartao>
    </>
  );
}
