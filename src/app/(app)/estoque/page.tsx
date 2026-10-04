"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import ModalMovimento from "@/components/ModalMovimento";
import SeloEstoque from "@/components/SeloEstoque";
import Aviso from "@/components/ui/Aviso";
import Botao from "@/components/ui/Botao";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";
import Cartao from "@/components/ui/Cartao";
import { inputCls } from "@/components/ui/estilos";
import Vazio from "@/components/ui/Vazio";
import { useAuth } from "@/context/AuthContext";
import { useProdutos } from "@/hooks/useProdutos";
import { casa } from "@/lib/busca";
import { formatQuantidade } from "@/lib/calc";

const PAGINA = 100;

export default function Estoque() {
  const { ehDono } = useAuth();
  const { dados, carregando, erro } = useProdutos();
  const [aba, setAba] = useState<"baixo" | "todos">("baixo");
  const [busca, setBusca] = useState("");
  const [mostrar, setMostrar] = useState(PAGINA);
  const [movendo, setMovendo] = useState<string | null>(null);

  const lista = useMemo(
    () => dados.filter((p) => p.ativo && (aba === "todos" || p.abaixoDoMinimo) && (!busca || casa(busca, p.nome, p.codigo))),
    [dados, aba, busca],
  );
  const produto = dados.find((p) => p.id === movendo) ?? null;
  const qtdBaixo = dados.filter((p) => p.ativo && p.abaixoDoMinimo).length;

  return (
    <>
      <CabecalhoPagina titulo="Estoque" subtitulo={ehDono ? "Entradas, ajustes e perdas, sempre com motivo." : "Consulta de saldo. Só o dono movimenta o estoque."} />
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Cartao>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2" role="tablist">
            {([["baixo", `Abaixo do mínimo (${qtdBaixo})`], ["todos", "Todos"]] as const).map(([k, rotulo]) => (
              <button key={k} role="tab" aria-selected={aba === k} type="button" onClick={() => { setAba(k); setMostrar(PAGINA); }} className={`rounded-md px-3 py-2 text-sm font-semibold ${aba === k ? "bg-primary text-white" : "border border-gray-300 hover:bg-gray-100"}`}>
                {rotulo}
              </button>
            ))}
          </div>
          <input type="search" placeholder="Buscar produto" value={busca} onChange={(e) => { setBusca(e.target.value); setMostrar(PAGINA); }} className={`${inputCls} sm:ml-auto sm:w-64`} aria-label="Buscar produto" />
        </div>
        {carregando ? <Carregando /> : lista.length === 0 ? (
          <Vazio texto={aba === "baixo" ? "Nenhum produto abaixo do mínimo. 👍" : "Nada encontrado."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-300 text-xs uppercase text-gray-600">
                <tr><th className="py-2 pr-3">Produto</th><th className="py-2 pr-3">Saldo</th><th className="hidden py-2 pr-3 sm:table-cell">Mínimo</th><th className="py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-gray-300/60">
                {lista.slice(0, mostrar).map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-3">
                      <Link href={`/produtos/${p.id}`} className="font-semibold text-gray-900 hover:text-primary">{p.nome}</Link>
                      <span className="block text-xs text-gray-600">{p.codigo}</span>
                    </td>
                    <td className="py-3 pr-3"><SeloEstoque p={p} /></td>
                    <td className="hidden py-3 pr-3 sm:table-cell">{formatQuantidade(p.estoqueMinimo)} {p.unidade}</td>
                    <td className="py-3 text-right">{ehDono ? <Botao variante="secundario" onClick={() => setMovendo(p.id)}>Movimentar</Botao> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length > mostrar ? <button type="button" onClick={() => setMostrar((m) => m + PAGINA)} className="mt-3 w-full rounded-md border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100">Mostrar mais</button> : null}
          </div>
        )}
      </Cartao>
      {produto ? <ModalMovimento key={produto.id} produto={produto} onFechar={() => setMovendo(null)} /> : null}
    </>
  );
}
