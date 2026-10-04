"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import FormOrcamento from "@/components/FormOrcamento";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";

function Conteudo() {
  const cliente = useSearchParams().get("cliente") ?? "";
  return (
    <>
      <CabecalhoPagina titulo="Novo orçamento" subtitulo="Cliente, itens e total. Dá para gerar o PDF e enviar no WhatsApp em seguida." />
      <FormOrcamento inicial={{ clienteId: cliente, itens: [], descontoGeral: 0, formaPagamento: "", observacoes: "" }} />
    </>
  );
}

export default function NovoOrcamento() {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}
