"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  texto: string;
  erro: boolean;
}

const Ctx = createContext<(texto: string, erro?: boolean) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);
  const mostrar = useCallback((texto: string, erro = false) => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, texto, erro }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), erro ? 6000 : 3500);
  }, []);

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {lista.map((t) => (
          <div
            key={t.id}
            role={t.erro ? "alert" : "status"}
            className={`pointer-events-auto max-w-md rounded-md px-4 py-3 text-sm font-medium text-white shadow-card ${t.erro ? "bg-danger" : "bg-gray-900"}`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
