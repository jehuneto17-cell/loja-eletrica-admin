"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";
import Botao from "./ui/Botao";
import Carregando from "./ui/Carregando";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, usuario, loja, carregando, sair } = useAuth();
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!carregando && !user) router.replace("/login");
  }, [carregando, user, router]);

  if (carregando || !user) return <Carregando />;

  if (!usuario || !loja) {
    return (
      <div className="m-auto max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-lg font-bold text-gray-900">Sem acesso</h1>
        <p className="text-gray-600">
          Seu usuário não está liberado nesta loja. Peça ao dono para ativar o seu acesso.
        </p>
        <Botao onClick={sair}>Sair</Botao>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar aberta={menu} onFechar={() => setMenu(false)} />
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-300/60 bg-white px-4 py-3 lg:hidden">
        <button type="button" aria-label="Abrir menu" onClick={() => setMenu(true)} className="rounded p-1 text-xl text-gray-700">
          ☰
        </button>
        {loja.logoMenuUrl || loja.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo da loja (data URL ou link externo)
          <img src={loja.logoMenuUrl || loja.logoUrl} alt={loja.nome} className="h-9 max-w-48 object-contain" />
        ) : (
          <span className="font-bold text-gray-900">⚡ {loja.nome}</span>
        )}
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
