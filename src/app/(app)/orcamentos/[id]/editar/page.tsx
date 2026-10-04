"use client";
import { collection, limit, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import FormOrcamento from "@/components/FormOrcamento";
import Aviso from "@/components/ui/Aviso";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";
import Vazio from "@/components/ui/Vazio";
import { useAuth } from "@/context/AuthContext";
import { useColecao } from "@/hooks/useColecao";
import { useDocumento } from "@/hooks/useDocumento";
import { moedaParaInput, quantidadeParaInput } from "@/lib/calc";
import { db } from "@/lib/firebase";
import { statusDoOrcamento } from "@/lib/status";
import type { ItemDocumento, Orcamento } from "@/types";

export default function EditarOrcamento() {
  const { id } = useParams<{ id: string }>();
  const lojaId = useAuth().loja!.id;
  const orc = useDocumento<Orcamento>(`orcamentos/${id}`);
  const itens = useColecao<ItemDocumento>(`orc-itens:${id}`, () => query(collection(db, "orcamentos", id, "itens"), orderBy("ordem"), limit(100)));

  if (orc.carregando || itens.carregando) return <Carregando />;
  const o = orc.dado;
  if (!o || o.lojaId !== lojaId) {
    return <Vazio texto="Orçamento não encontrado." acao={<Link href="/orcamentos" className="font-semibold text-primary">Voltar</Link>} />;
  }
  if (statusDoOrcamento(o) !== "rascunho") {
    return (
      <div className="space-y-3">
        <Aviso tipo="alerta">Só rascunho pode ser editado. Duplique o orçamento para alterar.</Aviso>
        <Link href={`/orcamentos/${id}`} className="font-semibold text-primary">Voltar ao orçamento</Link>
      </div>
    );
  }
  return (
    <>
      <CabecalhoPagina titulo={`Editar ${o.numero}`} />
      <FormOrcamento
        key={id}
        inicial={{
          id,
          clienteId: o.clienteId,
          descontoGeral: o.desconto,
          formaPagamento: o.formaPagamento ?? "",
          observacoes: o.observacoes ?? "",
          itens: itens.dados.map((i) => ({
            key: i.id,
            produtoId: i.produtoId,
            descricao: i.descricao,
            unidade: i.unidade,
            qtd: quantidadeParaInput(i.quantidade),
            preco: i.precoUnitario,
            desc: i.desconto ? moedaParaInput(i.desconto) : "",
          })),
        }}
      />
    </>
  );
}
