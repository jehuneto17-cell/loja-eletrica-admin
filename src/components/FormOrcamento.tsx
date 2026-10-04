"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useProdutos } from "@/hooks/useProdutos";
import { api } from "@/lib/apiClient";
import { formatMoeda, moedaParaInput, parseQuantidade, quantidadeParaInput } from "@/lib/calc";
import { calcularForm, type ItemForm } from "@/lib/orcamentoForm";
import BuscaProduto from "./BuscaProduto";
import LinhaItemOrcamento from "./LinhaItemOrcamento";
import SeletorCliente from "./SeletorCliente";
import Aviso from "./ui/Aviso";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import Cartao from "./ui/Cartao";
import { inputCls } from "./ui/estilos";

export interface InicialOrcamento {
  id?: string;
  clienteId: string;
  itens: ItemForm[];
  descontoGeral: number; // centavos
  formaPagamento: string;
  observacoes: string;
}

const FORMAS = ["Pix", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Boleto"];

export default function FormOrcamento({ inicial }: { inicial: InicialOrcamento }) {
  const { loja, usuario, ehDono } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { dados: produtos } = useProdutos();
  const [clienteId, setClienteId] = useState(inicial.clienteId);
  const [itens, setItens] = useState<ItemForm[]>(inicial.itens);
  const [descGeral, setDescGeral] = useState(inicial.descontoGeral ? moedaParaInput(inicial.descontoGeral) : "");
  const [forma, setForma] = useState(inicial.formaPagamento);
  const [obs, setObs] = useState(inicial.observacoes);
  const [dias, setDias] = useState(inicial.id ? "" : String(loja!.validadePadraoDias));
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const c = calcularForm(itens, descGeral);
  const limite = loja!.descontoMaxVendedorPct;
  const passaDoLimite = !ehDono && !c.invalido && c.totais.descontoPct > limite;

  function adicionar(p: { id: string; nome: string; unidade: ItemForm["unidade"]; precoVenda: number }) {
    setItens((l) => {
      // mesmo produto de novo: soma 1 na linha existente (o aviso de estoque fica por produto)
      if (l.some((i) => i.produtoId === p.id)) {
        return l.map((i) => {
          const q = parseQuantidade(i.qtd);
          return i.produtoId === p.id && !Number.isNaN(q) ? { ...i, qtd: quantidadeParaInput(q + 1000) } : i;
        });
      }
      return [...l, { key: crypto.randomUUID(), produtoId: p.id, descricao: p.nome, unidade: p.unidade, qtd: "1", preco: p.precoVenda, desc: "" }];
    });
  }

  async function salvar(depois: "detalhe" | "vender") {
    if (!clienteId) return setErro("Escolha o cliente.");
    if (!itens.length) return setErro("Adicione pelo menos um produto.");
    if (c.invalido) return setErro("Corrija os campos em vermelho antes de salvar.");
    const diasNum = dias.trim() ? Number(dias) : undefined;
    if (diasNum !== undefined && (!Number.isInteger(diasNum) || diasNum < 1 || diasNum > 365)) {
      return setErro("Validade: de 1 a 365 dias.");
    }
    setErro("");
    setEnviando(true);
    let salvoId: string | undefined;
    try {
      const r = await api<{ id: string; numero: string; avisos: { descricao: string }[] }>("/api/orcamentos", {
        id: inicial.id,
        clienteId,
        itens: itens.map((i, n) => ({ produtoId: i.produtoId, quantidade: c.linhas[n].quantidade, desconto: c.linhas[n].desconto })),
        descontoGeral: c.geral,
        validadeDias: diasNum,
        formaPagamento: forma,
        observacoes: obs,
      });
      salvoId = r.id;
      if (depois === "vender") {
        await api(`/api/orcamentos/${r.id}/converter`, { formaPagamento: forma });
        toast(`${r.numero} virou venda.`);
      } else {
        toast(`${r.numero} salvo.${r.avisos.length ? " Atenção: item sem estoque suficiente." : ""}`);
      }
      router.push(`/orcamentos/${r.id}`);
    } catch (e) {
      const msg = (e as Error).message;
      if (salvoId) {
        // já salvou: segue para o detalhe (onde "Converter" existe) em vez de deixar o formulário criar outro ORC
        toast(`${msg} O orçamento ficou salvo como rascunho.`, true);
        router.push(`/orcamentos/${salvoId}`);
        return;
      }
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Cartao titulo="Cliente">
        <SeletorCliente clienteId={clienteId} onEscolher={setClienteId} />
      </Cartao>

      <Cartao titulo="Itens">
        <BuscaProduto onEscolher={adicionar} />
        <div className="mt-3">
          {itens.length ? (
            <div className="hidden gap-2 border-b border-gray-300 pb-2 text-xs uppercase text-gray-600 sm:grid sm:grid-cols-[1fr_96px_96px_96px_96px_32px]">
              <span>Produto</span><span>Qtd.</span><span className="text-right">Preço</span><span>Desconto</span><span className="text-right">Total</span><span />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-gray-600">Busque um produto acima para adicionar ao orçamento.</p>
          )}
          {itens.map((i, n) => (
            <LinhaItemOrcamento
              key={i.key}
              item={i}
              calc={c.linhas[n]}
              produto={porId.get(i.produtoId)}
              onChange={(patch) => setItens((l) => l.map((x) => (x.key === i.key ? { ...x, ...patch } : x)))}
              onRemover={() => setItens((l) => l.filter((x) => x.key !== i.key))}
            />
          ))}
        </div>

        <div className="mt-4 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoeda(c.totais.subtotal)}</span></div>
          <Campo rotulo="Desconto no total (R$)" erro={c.erroGeral}>
            <input inputMode="decimal" value={descGeral} onChange={(e) => setDescGeral(e.target.value)} placeholder="0,00" className={inputCls} />
          </Campo>
          <div className="flex justify-between border-t border-gray-300 pt-2 text-lg font-bold"><span>Total</span><span>{formatMoeda(c.totais.total)}</span></div>
          {!c.invalido && c.totais.descontoPct > 0 ? (
            <p className={`text-xs ${passaDoLimite ? "font-semibold text-danger" : "text-gray-600"}`}>
              Desconto total: {c.totais.descontoPct.toFixed(1)}%{!ehDono ? ` (seu limite é ${limite}%)` : ""}
            </p>
          ) : null}
        </div>
        {passaDoLimite ? <div className="mt-3"><Aviso tipo="alerta">Desconto acima do seu limite de {limite}%. Só o dono pode salvar assim — reduza o desconto ou peça a ele.</Aviso></div> : null}
      </Cartao>

      <Cartao titulo="Condições">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Validade (dias)" dica={inicial.id ? "Em branco mantém a validade atual; se preencher, conta a partir da criação do orçamento" : undefined}>
            <input inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} className={inputCls} />
          </Campo>
          <Campo rotulo="Forma de pagamento" className="sm:col-span-2">
            <input list="formas" value={forma} onChange={(e) => setForma(e.target.value)} maxLength={60} className={inputCls} placeholder="Ex.: Pix" />
            <datalist id="formas">{FORMAS.map((f) => <option key={f} value={f} />)}</datalist>
          </Campo>
          <Campo rotulo="Observações" className="sm:col-span-3">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={1000} rows={2} className={inputCls} />
          </Campo>
        </div>
      </Cartao>

      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="secundario" onClick={() => router.back()}>Cancelar</Botao>
        {!inicial.id ? <Botao variante="secundario" carregando={enviando} onClick={() => salvar("vender")}>Salvar e vender</Botao> : null}
        <Botao carregando={enviando} onClick={() => salvar("detalhe")}>Salvar orçamento</Botao>
      </div>
      <p className="text-right text-xs text-gray-600">
        Logado como {usuario?.nome}. “Salvar e vender” já dá baixa no estoque; “Salvar” só guarda o rascunho.
      </p>
    </div>
  );
}
