import type { ReactNode } from "react";

export default function Vazio({ texto, acao }: { texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center text-gray-600">
      <p>{texto}</p>
      {acao}
    </div>
  );
}
