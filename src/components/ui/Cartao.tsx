import type { ReactNode } from "react";

interface Props {
  titulo?: string;
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function Cartao({ titulo, acao, className = "", children }: Props) {
  return (
    <section className={`rounded-lg bg-white shadow-card ${className}`}>
      {titulo ? (
        <header className="flex items-center justify-between gap-3 border-b border-gray-300/60 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">{titulo}</h2>
          {acao}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}
