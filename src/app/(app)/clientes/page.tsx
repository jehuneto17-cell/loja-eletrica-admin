"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Aviso from "@/components/ui/Aviso";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Carregando from "@/components/ui/Carregando";
import Cartao from "@/components/ui/Cartao";
import { inputCls } from "@/components/ui/estilos";
import Vazio from "@/components/ui/Vazio";
import { useClientes } from "@/hooks/useClientes";
import { casa } from "@/lib/busca";

const PAGINA = 100;

export default function Clientes() {
  const { dados, carregando, erro } = useClientes();
  const [busca, setBusca] = useState("");
  const [mostrar, setMostrar] = useState(PAGINA);
  const filtrados = useMemo(
    () => dados.filter((c) => !busca || casa(busca, c.nome, c.telefone, c.cpfCnpj)),
    [dados, busca],
  );

  return (
    <>
      <CabecalhoPagina
        titulo="Clientes"
        subtitulo={`${dados.length} cadastrados`}
        acoes={<Link href="/clientes/novo" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">+ Novo cliente</Link>}
      />
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Cartao>
        <input
          type="search"
          placeholder="Buscar por nome, telefone ou CPF/CNPJ"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setMostrar(PAGINA); }}
          className={`${inputCls} mb-4`}
          aria-label="Buscar cliente"
        />
        {carregando ? (
          <Carregando />
        ) : filtrados.length === 0 ? (
          <Vazio texto={dados.length ? "Nenhum cliente com essa busca." : "Nenhum cliente cadastrado ainda."} />
        ) : (
          <ul className="divide-y divide-gray-300/60">
            {filtrados.slice(0, mostrar).map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-gray-100">
                  <span className="font-semibold text-gray-900">{c.nome}</span>
                  <span className="text-sm text-gray-600">{c.telefone || "sem telefone"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {filtrados.length > mostrar ? (
          <button type="button" onClick={() => setMostrar((m) => m + PAGINA)} className="mt-3 w-full rounded-md border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-100">
            Mostrar mais ({filtrados.length - mostrar} restantes)
          </button>
        ) : null}
      </Cartao>
    </>
  );
}
