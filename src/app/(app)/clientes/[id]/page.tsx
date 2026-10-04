"use client";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import FormCliente from "@/components/FormCliente";
import SeloStatus from "@/components/SeloStatus";
import Aviso from "@/components/ui/Aviso";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";
import Cartao from "@/components/ui/Cartao";
import Selo from "@/components/ui/Selo";
import Vazio from "@/components/ui/Vazio";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useColecao } from "@/hooks/useColecao";
import { useDocumento } from "@/hooks/useDocumento";
import { formatMoeda } from "@/lib/calc";
import { formatData } from "@/lib/datas";
import { db } from "@/lib/firebase";
import { statusDoOrcamento } from "@/lib/status";
import type { Cliente, Orcamento, Venda } from "@/types";

export default function ClientePagina() {
  const { id } = useParams<{ id: string }>();
  const novo = id === "novo";
  const router = useRouter();
  const toast = useToast();
  const lojaId = useAuth().loja!.id;
  const { dado, carregando } = useDocumento<Cliente>(novo ? null : `clientes/${id}`);
  const orcs = useColecao<Orcamento>(novo ? null : `cli-orc:${lojaId}:${id}`, () =>
    query(collection(db, "orcamentos"), where("lojaId", "==", lojaId), where("clienteId", "==", id), orderBy("criadoEm", "desc"), limit(50)),
  );
  const vendas = useColecao<Venda>(novo ? null : `cli-ven:${lojaId}:${id}`, () =>
    query(collection(db, "vendas"), where("lojaId", "==", lojaId), where("clienteId", "==", id), orderBy("criadoEm", "desc"), limit(50)),
  );

  if (!novo && carregando) return <Carregando />;
  if (!novo && (!dado || dado.lojaId !== lojaId)) {
    return <Vazio texto="Cliente não encontrado." acao={<Link href="/clientes" className="font-semibold text-primary">Voltar</Link>} />;
  }

  return (
    <>
      <CabecalhoPagina
        titulo={novo ? "Novo cliente" : dado!.nome}
        acoes={
          <>
            <Link href="/clientes" className="inline-flex min-h-10 items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100">Voltar</Link>
            {!novo ? <Link href={`/orcamentos/novo?cliente=${id}`} className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">Novo orçamento</Link> : null}
          </>
        }
      />
      <div className="space-y-4">
        <Cartao titulo="Dados">
          <FormCliente
            key={dado?.id ?? "novo"}
            cliente={dado ?? undefined}
            onSalvo={() => {
              toast("Cliente salvo.");
              if (novo) router.push("/clientes");
            }}
          />
        </Cartao>
        {!novo ? (
          <>
            <Cartao titulo="Orçamentos">
              {orcs.erro ? <Aviso tipo="erro">{orcs.erro}</Aviso> : orcs.carregando ? <Carregando /> : orcs.dados.length === 0 ? <Vazio texto="Nenhum orçamento para este cliente." /> : (
                <ul className="divide-y divide-gray-300/60">
                  {orcs.dados.map((o) => (
                    <li key={o.id}>
                      <Link href={`/orcamentos/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-gray-100">
                        <span><b>{o.numero}</b> <span className="text-xs text-gray-600">{formatData(o.criadoEm)}</span></span>
                        <span className="flex items-center gap-3"><SeloStatus status={statusDoOrcamento(o)} /><span className="w-24 text-right font-medium">{formatMoeda(o.total)}</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
            <Cartao titulo="Vendas">
              {vendas.erro ? <Aviso tipo="erro">{vendas.erro}</Aviso> : vendas.carregando ? <Carregando /> : vendas.dados.length === 0 ? <Vazio texto="Nenhuma venda para este cliente." /> : (
                <ul className="divide-y divide-gray-300/60">
                  {vendas.dados.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                      <span><b>{v.numero}</b> <span className="text-xs text-gray-600">{formatData(v.criadoEm)}</span></span>
                      <span className="flex items-center gap-3">
                        <Selo tom={v.status === "concluida" ? "verde" : "vermelho"}>{v.status === "concluida" ? "Concluída" : "Cancelada"}</Selo>
                        <span className="w-24 text-right font-medium">{formatMoeda(v.total)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </>
        ) : null}
      </div>
    </>
  );
}
