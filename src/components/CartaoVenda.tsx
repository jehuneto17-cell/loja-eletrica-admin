"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useDocumento } from "@/hooks/useDocumento";
import { api } from "@/lib/apiClient";
import { formatMoeda } from "@/lib/calc";
import { formatDataHora } from "@/lib/datas";
import type { Venda } from "@/types";
import Aviso from "./ui/Aviso";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import Cartao from "./ui/Cartao";
import { inputCls } from "./ui/estilos";
import Modal from "./ui/Modal";
import Selo from "./ui/Selo";

/** Venda vinculada ao orçamento; só o dono cancela (devolve o estoque). */
export default function CartaoVenda({ vendaId }: { vendaId: string }) {
  const { ehDono } = useAuth();
  const toast = useToast();
  const { dado: v, erro: erroLeitura } = useDocumento<Venda>(`vendas/${vendaId}`);
  const [abrir, setAbrir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cancelar() {
    if (!motivo.trim()) return setErro("Informe o motivo do cancelamento.");
    setEnviando(true);
    setErro("");
    try {
      await api(`/api/vendas/${vendaId}/cancelar`, { motivo });
      toast("Venda cancelada e estoque devolvido.");
      setAbrir(false);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (erroLeitura) return <Aviso tipo="erro">Não foi possível carregar a venda: {erroLeitura}</Aviso>;
  if (!v) return null;
  return (
    <Cartao
      titulo={`Venda ${v.numero}`}
      acao={<Selo tom={v.status === "concluida" ? "verde" : "vermelho"}>{v.status === "concluida" ? "Concluída" : "Cancelada"}</Selo>}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          {formatDataHora(v.criadoEm)} · {formatMoeda(v.total)}
          {v.formaPagamento ? ` · ${v.formaPagamento}` : ""}
        </span>
        {ehDono && v.status === "concluida" ? <Botao variante="perigo" onClick={() => setAbrir(true)}>Cancelar venda</Botao> : null}
      </div>
      <Modal aberto={abrir} titulo={`Cancelar ${v.numero}`} onFechar={() => setAbrir(false)}>
        <div className="space-y-4">
          <Aviso tipo="alerta">O estoque dos itens volta ao saldo, com uma movimentação “estorno”. Nada é apagado.</Aviso>
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
          <Campo rotulo="Motivo"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className={inputCls} autoFocus /></Campo>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setAbrir(false)}>Voltar</Botao>
            <Botao variante="perigo" carregando={enviando} onClick={cancelar}>Cancelar venda</Botao>
          </div>
        </div>
      </Modal>
    </Cartao>
  );
}
