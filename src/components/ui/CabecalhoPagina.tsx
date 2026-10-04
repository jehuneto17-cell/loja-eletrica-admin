import type { ReactNode } from "react";

interface Props {
  titulo: string;
  subtitulo?: string;
  acoes?: ReactNode;
}

export default function CabecalhoPagina({ titulo, subtitulo, acoes }: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{titulo}</h1>
        {subtitulo ? <p className="text-sm text-gray-600">{subtitulo}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </div>
  );
}
