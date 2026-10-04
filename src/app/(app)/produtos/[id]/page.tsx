"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import HistoricoMovimentacoes from "@/components/HistoricoMovimentacoes";
import ModalMovimento from "@/components/ModalMovimento";
import SeloEstoque from "@/components/SeloEstoque";
import Aviso from "@/components/ui/Aviso";
import Botao from "@/components/ui/Botao";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Campo from "@/components/ui/Campo";
import Carregando from "@/components/ui/Carregando";
import Cartao from "@/components/ui/Cartao";
import { inputCls } from "@/components/ui/estilos";
import Vazio from "@/components/ui/Vazio";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useDocumento } from "@/hooks/useDocumento";
import { api } from "@/lib/apiClient";
import { moedaParaInput, parseMoeda, parseQuantidade, quantidadeParaInput } from "@/lib/calc";
import type { Produto, Unidade } from "@/types";

const unidades: Unidade[] = ["un", "m", "rolo", "cx", "kg"];

interface Form {
  codigo: string;
  nome: string;
  categoria: string;
  marca: string;
  unidade: Unidade;
  preco: string;
  minimo: string;
  inicial: string;
  ativo: boolean;
}

const vazio: Form = { codigo: "", nome: "", categoria: "", marca: "", unidade: "un", preco: "", minimo: "0", inicial: "", ativo: true };

function doProduto(p: Produto): Form {
  return {
    codigo: p.codigo,
    nome: p.nome,
    categoria: p.categoria ?? "",
    marca: p.marca ?? "",
    unidade: p.unidade,
    preco: moedaParaInput(p.precoVenda),
    minimo: quantidadeParaInput(p.estoqueMinimo),
    inicial: "",
    ativo: p.ativo,
  };
}

export default function ProdutoPagina() {
  const { id } = useParams<{ id: string }>();
  const novo = id === "novo";
  const { dado, carregando, erro } = useDocumento<Produto>(novo ? null : `produtos/${id}`);
  const { loja } = useAuth();

  if (!novo && carregando) return <Carregando />;
  if (!novo && (erro || !dado || dado.lojaId !== loja!.id)) {
    return <Vazio texto="Produto não encontrado." acao={<Link href="/produtos" className="font-semibold text-primary">Voltar</Link>} />;
  }
  // key: ao chegar o dado do servidor o formulário reinicia com os valores certos
  return <Formulario key={dado ? `${dado.id}-${dado.precoVenda}-${dado.nome}` : "novo"} id={novo ? undefined : id} produto={dado} />;
}

function Formulario({ id, produto }: { id?: string; produto: (Produto & { id: string }) | null }) {
  const { ehDono } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<Form>(produto ? doProduto(produto) : vazio);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mov, setMov] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const leitura = !ehDono; // regra 9: vendedor não altera produto nem preço

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const preco = parseMoeda(f.preco);
    const minimo = parseQuantidade(f.minimo || "0");
    const inicial = f.inicial ? parseQuantidade(f.inicial) : 0;
    if (!f.codigo.trim() || !f.nome.trim()) return setErro("Código e nome são obrigatórios.");
    if (Number.isNaN(preco)) return setErro("Preço inválido. Use o formato 8,90.");
    if (Number.isNaN(minimo)) return setErro("Estoque mínimo inválido (ex.: 10 ou 12,5).");
    if (Number.isNaN(inicial)) return setErro("Estoque inicial inválido (ex.: 10 ou 12,5).");
    setErro("");
    setEnviando(true);
    try {
      await api<{ id: string }>("/api/produtos", {
        id,
        codigo: f.codigo,
        nome: f.nome,
        categoria: f.categoria,
        marca: f.marca,
        unidade: f.unidade,
        precoVenda: preco,
        estoqueMinimo: minimo,
        ativo: f.ativo,
        estoqueInicial: !id && inicial > 0 ? inicial : undefined, // o servidor grava produto + saldo juntos
      });
      toast("Produto salvo.");
      router.push("/produtos");
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo={id ? produto!.nome : "Novo produto"}
        subtitulo={id ? `Código ${produto!.codigo}` : undefined}
        acoes={
          <>
            <Link href="/produtos" className="inline-flex min-h-10 items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100">
              Voltar
            </Link>
            {id && ehDono ? <Botao onClick={() => setMov(true)}>Movimentar estoque</Botao> : null}
          </>
        }
      />
      <div className="space-y-4">
        <Cartao titulo="Dados do produto">
          <form onSubmit={salvar} className="space-y-4">
            {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
            {leitura ? <Aviso>Só o dono altera produtos e preços.</Aviso> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Código / SKU"><input value={f.codigo} onChange={(e) => set("codigo", e.target.value)} disabled={leitura} maxLength={40} className={inputCls} /></Campo>
              <Campo rotulo="Nome"><input value={f.nome} onChange={(e) => set("nome", e.target.value)} disabled={leitura} maxLength={120} className={inputCls} /></Campo>
              <Campo rotulo="Categoria"><input value={f.categoria} onChange={(e) => set("categoria", e.target.value)} disabled={leitura} maxLength={60} className={inputCls} placeholder="Ex.: Cabos" /></Campo>
              <Campo rotulo="Marca"><input value={f.marca} onChange={(e) => set("marca", e.target.value)} disabled={leitura} maxLength={60} className={inputCls} /></Campo>
              <Campo rotulo="Unidade">
                <select value={f.unidade} onChange={(e) => set("unidade", e.target.value as Unidade)} disabled={leitura} className={inputCls}>
                  {unidades.map((u) => <option key={u}>{u}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Preço de venda (R$)"><input inputMode="decimal" value={f.preco} onChange={(e) => set("preco", e.target.value)} disabled={leitura} className={inputCls} placeholder="8,90" /></Campo>
              <Campo rotulo="Estoque mínimo" dica="Avisa quando o saldo chegar nesse valor. Aceita decimal."><input inputMode="decimal" value={f.minimo} onChange={(e) => set("minimo", e.target.value)} disabled={leitura} className={inputCls} /></Campo>
              {!id ? (
                <Campo rotulo="Estoque inicial (opcional)" dica="Vira uma entrada 'Saldo inicial' no histórico."><input inputMode="decimal" value={f.inicial} onChange={(e) => set("inicial", e.target.value)} className={inputCls} /></Campo>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} disabled={leitura} />
              Produto ativo (aparece nos novos orçamentos)
            </label>
            {!leitura ? (
              <div className="flex justify-end">
                <Botao type="submit" carregando={enviando}>Salvar</Botao>
              </div>
            ) : null}
          </form>
        </Cartao>

        {id && produto ? (
          <Cartao titulo="Estoque" acao={<SeloEstoque p={produto} />}>
            <HistoricoMovimentacoes produtoId={id} />
          </Cartao>
        ) : null}
      </div>
      {mov && produto ? <ModalMovimento produto={produto} onFechar={() => setMov(false)} /> : null}
    </>
  );
}
