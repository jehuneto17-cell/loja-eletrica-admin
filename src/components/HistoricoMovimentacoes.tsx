"use client";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useColecao } from "@/hooks/useColecao";
import { formatQuantidade } from "@/lib/calc";
import { formatDataHora } from "@/lib/datas";
import { db } from "@/lib/firebase";
import type { Movimentacao } from "@/types";
import Aviso from "./ui/Aviso";
import Carregando from "./ui/Carregando";
import Vazio from "./ui/Vazio";

const rotulos: Record<Movimentacao["tipo"], string> = {
  entrada: "Entrada",
  venda: "Venda",
  ajuste: "Ajuste",
  perda: "Perda",
  estorno: "Estorno",
};

export default function HistoricoMovimentacoes({ produtoId }: { produtoId: string }) {
  const lojaId = useAuth().loja!.id;
  const { dados, carregando, erro } = useColecao<Movimentacao>(`mov:${lojaId}:${produtoId}`, () =>
    query(
      collection(db, "movimentacoes"),
      where("lojaId", "==", lojaId),
      where("produtoId", "==", produtoId),
      orderBy("criadoEm", "desc"),
      limit(50),
    ),
  );

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (carregando) return <Carregando />;
  if (!dados.length) return <Vazio texto="Sem movimentações ainda." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-gray-300 text-xs uppercase text-gray-600">
          <tr>
            <th className="py-2 pr-3">Quando</th>
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3 text-right">Qtd.</th>
            <th className="py-2 pr-3 text-right">Saldo</th>
            <th className="py-2">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-300/60">
          {dados.map((m) => (
            <tr key={m.id}>
              <td className="py-2 pr-3 whitespace-nowrap">
                {formatDataHora(m.criadoEm)}
                {m.usuarioNome ? <span className="block text-xs text-gray-600">{m.usuarioNome}</span> : null}
              </td>
              <td className="py-2 pr-3">{rotulos[m.tipo]}</td>
              <td className={`py-2 pr-3 text-right font-medium ${m.quantidade < 0 ? "text-danger" : "text-green-700"}`}>
                {m.quantidade > 0 ? "+" : ""}
                {formatQuantidade(m.quantidade)}
              </td>
              <td className="py-2 pr-3 text-right">{formatQuantidade(m.saldoApos)}</td>
              <td className="py-2">{m.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
