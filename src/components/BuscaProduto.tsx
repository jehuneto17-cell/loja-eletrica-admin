"use client";
import { useMemo, useState } from "react";
import { useProdutos } from "@/hooks/useProdutos";
import type { ComId } from "@/hooks/useColecao";
import { casa } from "@/lib/busca";
import { formatMoeda } from "@/lib/calc";
import type { Produto } from "@/types";
import SeloEstoque from "./SeloEstoque";
import { inputCls } from "./ui/estilos";

export default function BuscaProduto({ onEscolher }: { onEscolher: (p: ComId<Produto>) => void }) {
  const { dados, carregando } = useProdutos();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const achados = useMemo(
    () => (busca ? dados.filter((p) => p.ativo && casa(busca, p.nome, p.codigo, p.marca)).slice(0, 8) : []),
    [dados, busca],
  );

  return (
    <div className="relative">
      <input
        aria-label="Adicionar produto"
        placeholder={carregando ? "Carregando produtos…" : "Buscar produto por nome ou código para adicionar"}
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className={inputCls}
      />
      {aberto && busca ? (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-card" role="listbox">
          {achados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-600">Nenhum produto ativo encontrado.</li>
          ) : (
            achados.map((p) => (
              <li key={p.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onEscolher(p); setBusca(""); setAberto(false); }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-100"
                >
                  <span>
                    <span className="font-medium">{p.nome}</span>
                    <span className="block text-xs text-gray-600">{p.codigo} · <SeloEstoque p={p} /></span>
                  </span>
                  <span className="font-semibold">{formatMoeda(p.precoVenda)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
