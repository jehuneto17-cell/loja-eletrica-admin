"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import type { ComId } from "@/hooks/useColecao";
import { api } from "@/lib/apiClient";
import { formatMoeda } from "@/lib/calc";
import { formatData } from "@/lib/datas";
import { linkWhatsapp } from "@/lib/whatsapp";
import type { Cliente, Orcamento, StatusOrcamento } from "@/types";
import Botao from "./ui/Botao";

interface Props {
  orc: ComId<Orcamento>;
  status: StatusOrcamento; // já com "expirado" calculado
  cliente?: Cliente;
  nomeLoja: string;
}

const linkCls = "inline-flex min-h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100";

export default function AcoesOrcamento({ orc, status, cliente, nomeLoja }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [ocupado, setOcupado] = useState("");

  /** Executa com spinner e toast de erro. Devolve true se deu certo. */
  async function rodar(nome: string, fn: () => Promise<void>): Promise<boolean> {
    setOcupado(nome);
    try {
      await fn();
      return true;
    } catch (e) {
      toast((e as Error).message, true);
      return false;
    } finally {
      setOcupado("");
    }
  }

  const mudar = (novo: StatusOrcamento) => () =>
    rodar(novo, async () => {
      await api(`/api/orcamentos/${orc.id}/status`, { status: novo });
      toast(`Marcado como ${novo}.`);
    });

  // abre a aba na hora do clique (senão o navegador bloqueia) e preenche depois do link assinado
  async function abrirLink(nome: string, montar: (urlPdf: string) => string) {
    const aba = window.open("", "_blank");
    return rodar(nome, async () => {
      try {
        const { url } = await api<{ url: string }>(`/api/orcamentos/${orc.id}/link`, {});
        const destino = montar(url);
        if (aba) aba.location.href = destino;
        else window.location.href = destino;
      } catch (e) {
        aba?.close();
        throw e;
      }
    });
  }

  const pdf = () => abrirLink("pdf", (u) => u);

  const whatsapp = () =>
    abrirLink("whatsapp", (u) => {
      const texto = `Olá${cliente ? `, ${cliente.nome.split(" ")[0]}` : ""}! Segue o orçamento ${orc.numero} da ${nomeLoja}: ${formatMoeda(orc.total)}, válido até ${formatData(orc.validade)}.\n${u}`;
      return linkWhatsapp(cliente?.telefone, texto);
    }).then((ok) => {
      // mandar no WhatsApp conta como "enviado" (se falhar, o botão "Marcar enviado" continua lá)
      if (ok && status === "rascunho") {
        api(`/api/orcamentos/${orc.id}/status`, { status: "enviado" }).catch((e: Error) =>
          toast(`Não marcou como enviado: ${e.message}`, true),
        );
      }
    });

  const duplicar = () =>
    rodar("duplicar", async () => {
      const r = await api<{ id: string; numero: string }>(`/api/orcamentos/${orc.id}/duplicar`, {});
      toast(`Criado ${r.numero} com os preços de hoje.`);
      router.push(`/orcamentos/${r.id}`);
    });

  const converter = () =>
    rodar("converter", async () => {
      const r = await api<{ numero: string; negativos: unknown[] }>(`/api/orcamentos/${orc.id}/converter`, {});
      toast(`${r.numero} registrada e estoque baixado.${r.negativos.length ? " Saldo ficou negativo em algum item." : ""}`);
    });

  const aberto = status === "rascunho" || status === "enviado" || (status === "aprovado" && !orc.vendaId);
  const semVenda = !orc.vendaId;

  return (
    <div className="flex flex-wrap gap-2">
      {status === "rascunho" ? <Link href={`/orcamentos/${orc.id}/editar`} className={linkCls}>Editar</Link> : null}
      {status === "rascunho" ? <Botao variante="secundario" carregando={ocupado === "enviado"} onClick={mudar("enviado")}>Marcar enviado</Botao> : null}
      {(status === "rascunho" || status === "enviado") && semVenda ? <Botao variante="secundario" carregando={ocupado === "aprovado"} onClick={mudar("aprovado")}>Aprovar</Botao> : null}
      {aberto && semVenda ? <Botao carregando={ocupado === "converter"} onClick={converter}>Converter em venda</Botao> : null}
      {(status === "rascunho" || status === "enviado" || status === "aprovado") && semVenda ? <Botao variante="fantasma" carregando={ocupado === "recusado"} onClick={mudar("recusado")}>Recusar</Botao> : null}
      <Botao variante="secundario" carregando={ocupado === "pdf"} onClick={pdf}>PDF</Botao>
      <Botao variante="secundario" carregando={ocupado === "whatsapp"} onClick={whatsapp}>WhatsApp</Botao>
      <Botao variante="secundario" carregando={ocupado === "duplicar"} onClick={duplicar}>Duplicar</Botao>
    </div>
  );
}
