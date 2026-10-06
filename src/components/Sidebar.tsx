"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const itens = [
  { href: "/", rotulo: "Início", icone: "▦" },
  { href: "/orcamentos", rotulo: "Orçamentos", icone: "☰" },
  { href: "/produtos", rotulo: "Produtos", icone: "▣" },
  { href: "/clientes", rotulo: "Clientes", icone: "☺" },
  { href: "/estoque", rotulo: "Estoque", icone: "⇅" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "⚙", soDono: true },
];

export default function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const caminho = usePathname();
  const { loja, usuario, ehDono, sair } = useAuth();
  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));

  return (
    <>
      {aberta ? <div className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden" onClick={onFechar} /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gray-900 text-gray-400 transition-transform lg:translate-x-0 ${aberta ? "translate-x-0" : "-translate-x-full"}`}
      >
        {loja?.logoMenuUrl || loja?.logoUrl ? (
          <div className="m-3 rounded-lg bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo da loja (data URL ou link externo) */}
            <img src={loja.logoMenuUrl || loja.logoUrl} alt={loja.nome} className="mx-auto h-20 w-full object-contain" />
          </div>
        ) : (
          <div className="px-5 py-5 text-lg font-bold text-white">⚡ {loja?.nome ?? "Loja"}</div>
        )}
        <nav className="flex-1 space-y-1 px-3">
          {itens
            .filter((i) => !i.soDono || ehDono)
            .map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={onFechar}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${ativo(i.href) ? "bg-primary text-white" : "hover:bg-gray-800 hover:text-white"}`}
              >
                <span aria-hidden className="w-5 text-center">
                  {i.icone}
                </span>
                {i.rotulo}
              </Link>
            ))}
        </nav>
        <div className="border-t border-gray-800 p-4 text-sm">
          <p className="truncate font-medium text-white">{usuario?.nome}</p>
          <p className="mb-2 text-xs capitalize">{usuario?.perfil}</p>
          <button type="button" onClick={sair} className="text-gray-400 hover:text-white">
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
