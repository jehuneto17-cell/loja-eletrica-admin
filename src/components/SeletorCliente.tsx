"use client";
import { useMemo, useState } from "react";
import { useClientes } from "@/hooks/useClientes";
import { casa } from "@/lib/busca";
import FormCliente from "./FormCliente";
import Botao from "./ui/Botao";
import { inputCls } from "./ui/estilos";
import Modal from "./ui/Modal";

interface Props {
  clienteId: string;
  onEscolher: (id: string) => void;
}

export default function SeletorCliente({ clienteId, onEscolher }: Props) {
  const { dados } = useClientes();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState(false);
  const atual = dados.find((c) => c.id === clienteId);
  const achados = useMemo(
    () => dados.filter((c) => !busca || casa(busca, c.nome, c.telefone, c.cpfCnpj)).slice(0, 8),
    [dados, busca],
  );

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          aria-label="Cliente"
          placeholder="Buscar cliente por nome ou telefone"
          value={aberto ? busca : (atual?.nome ?? "")}
          onFocus={() => { setAberto(true); setBusca(""); }}
          onChange={(e) => setBusca(e.target.value)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          className={inputCls}
        />
        <Botao variante="secundario" onClick={() => setNovo(true)} className="shrink-0">+ Novo</Botao>
      </div>
      {aberto ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-card" role="listbox">
          {achados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-600">Nenhum cliente. Use “+ Novo”.</li>
          ) : (
            achados.map((c) => (
              <li key={c.id} role="option" aria-selected={c.id === clienteId}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onEscolher(c.id); setAberto(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100">
                  <span className="font-medium">{c.nome}</span>
                  {c.telefone ? <span className="ml-2 text-gray-600">{c.telefone}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      <Modal aberto={novo} titulo="Cadastro rápido de cliente" onFechar={() => setNovo(false)}>
        <FormCliente
          onSalvo={(id) => { onEscolher(id); setNovo(false); }}
          onCancelar={() => setNovo(false)}
        />
      </Modal>
    </div>
  );
}
