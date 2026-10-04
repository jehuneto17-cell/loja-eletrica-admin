"use client";
import { useState, type FormEvent } from "react";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/apiClient";
import { formatQuantidade, parseQuantidade, quantidadeParaInput } from "@/lib/calc";
import type { Produto } from "@/types";
import Aviso from "./ui/Aviso";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import { inputCls } from "./ui/estilos";
import Modal from "./ui/Modal";

type Tipo = "entrada" | "ajuste" | "perda";

const motivoPadrao: Record<Tipo, string> = { entrada: "Entrada de mercadoria", ajuste: "", perda: "" };

interface Props {
  produto: (Produto & { id: string }) | null;
  onFechar: () => void;
}

export default function ModalMovimento({ produto, onFechar }: Props) {
  // quem monta com key={produto.id} começa limpo a cada produto
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState(motivoPadrao.entrada);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();

  if (!produto) return null;

  function trocarTipo(t: Tipo) {
    setTipo(t);
    setMotivo(motivoPadrao[t]);
    setValor("");
    setErro("");
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!produto) return;
    const q = parseQuantidade(valor);
    if (Number.isNaN(q) || (tipo !== "ajuste" && q <= 0)) {
      setErro(tipo === "ajuste" ? "Informe o saldo contado (ex.: 12,5)." : "Informe uma quantidade maior que zero (ex.: 12,5).");
      return;
    }
    if (!motivo.trim()) {
      setErro("Informe o motivo.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const r = await api<{ saldoApos: number }>("/api/estoque", {
        produtoId: produto.id,
        tipo,
        motivo,
        ...(tipo === "ajuste" ? { novoSaldo: q } : { quantidade: q }),
      });
      toast(`Saldo de ${produto.nome}: ${formatQuantidade(r.saldoApos)} ${produto.unidade}`);
      onFechar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal aberto titulo="Movimentar estoque" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <p className="font-semibold">{produto.nome}</p>
          <p className="text-sm text-gray-600">
            Saldo atual: {formatQuantidade(produto.estoqueAtual)} {produto.unidade}
          </p>
        </div>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de movimentação">
          {(["entrada", "ajuste", "perda"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => trocarTipo(t)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold capitalize ${tipo === t ? "border-primary bg-primary/10 text-primary" : "border-gray-300"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <Campo
          rotulo={tipo === "ajuste" ? `Saldo contado (${produto.unidade})` : `Quantidade (${produto.unidade})`}
          dica={tipo === "ajuste" ? `Hoje o sistema tem ${quantidadeParaInput(produto.estoqueAtual)}. O ajuste registra só a diferença.` : "Aceita decimal, ex.: 12,5"}
        >
          <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={inputCls} autoFocus />
        </Campo>
        <Campo rotulo="Motivo">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className={inputCls} placeholder={tipo === "perda" ? "Ex.: quebrou no transporte" : "Ex.: contagem da prateleira"} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={enviando}>
            Registrar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
