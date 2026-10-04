"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import SeloEstoque from "@/components/SeloEstoque";
import Selo from "@/components/ui/Selo";
import Aviso from "@/components/ui/Aviso";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";
import Cartao from "@/components/ui/Cartao";
import { inputCls } from "@/components/ui/estilos";
import Vazio from "@/components/ui/Vazio";
import { useAuth } from "@/context/AuthContext";
import { useProdutos } from "@/hooks/useProdutos";
import { casa } from "@/lib/busca";
import { formatMoeda } from "@/lib/calc";

const PAGINA = 100;
const linkBtn =
  "inline-flex min-h-10 items-center rounded-md px-4 py-2 text-sm font-semibold ";

export default function Produtos() {
  const { ehDono } = useAuth();
  const { dados, carregando, erro } = useProdutos();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [soBaixo, setSoBaixo] = useState(false);
  const [mostrar, setMostrar] = useState(PAGINA);

  const categorias = useMemo(
    () => [...new Set(dados.map((p) => p.categoria).filter(Boolean))].sort() as string[],
    [dados],
  );
  const filtrados = useMemo(
    () =>
      dados.filter(
        (p) =>
          (!busca || casa(busca, p.nome, p.codigo, p.marca)) &&
          (!categoria || p.categoria === categoria) &&
          (!soBaixo || p.abaixoDoMinimo),
      ),
    [dados, busca, categoria, soBaixo],
  );

  return (
    <>
      <CabecalhoPagina
        titulo="Produtos"
        subtitulo={`${dados.length} cadastrados`}
        acoes={
          ehDono ? (
            <>
              <Link href="/produtos/importar" className={linkBtn + "border border-gray-300 bg-white text-gray-800 hover:bg-gray-100"}>
                Importar planilha
              </Link>
              <Link href="/produtos/novo" className={linkBtn + "bg-primary text-white hover:bg-primary/90"}>
                + Novo produto
              </Link>
            </>
          ) : null
        }
      />
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Cartao>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <input
            type="search"
            placeholder="Buscar por nome, código ou marca"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setMostrar(PAGINA); }}
            className={inputCls}
            aria-label="Buscar produto"
          />
          <select value={categoria} onChange={(e) => { setCategoria(e.target.value); setMostrar(PAGINA); }} className={inputCls} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soBaixo} onChange={(e) => setSoBaixo(e.target.checked)} />
            Só estoque baixo
          </label>
        </div>

        {carregando ? (
          <Carregando />
        ) : filtrados.length === 0 ? (
          <Vazio texto={dados.length ? "Nada encontrado com esse filtro." : "Nenhum produto cadastrado ainda."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-300 text-xs uppercase text-gray-600">
                <tr>
                  <th className="py-2 pr-3">Produto</th>
                  <th className="hidden py-2 pr-3 sm:table-cell">Categoria</th>
                  <th className="py-2 pr-3">Saldo</th>
                  <th className="py-2 text-right">Preço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300/60">
                {filtrados.slice(0, mostrar).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-100">
                    <td className="py-3 pr-3">
                      <Link href={`/produtos/${p.id}`} className="font-semibold text-gray-900 hover:text-primary">
                        {p.nome}
                      </Link>
                      <span className="block text-xs text-gray-600">
                        {p.codigo}
                        {p.marca ? ` · ${p.marca}` : ""} {!p.ativo ? <Selo>Inativo</Selo> : null}
                      </span>
                    </td>
                    <td className="hidden py-3 pr-3 sm:table-cell">{p.categoria ?? "—"}</td>
                    <td className="py-3 pr-3"><SeloEstoque p={p} /></td>
                    <td className="py-3 text-right font-medium">{formatMoeda(p.precoVenda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length > mostrar ? (
              <button type="button" onClick={() => setMostrar((m) => m + PAGINA)} className="mt-3 w-full rounded-md border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100">
                Mostrar mais ({filtrados.length - mostrar} restantes)
              </button>
            ) : null}
          </div>
        )}
      </Cartao>
    </>
  );
}
