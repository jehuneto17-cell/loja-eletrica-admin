import type { ReactNode } from "react";

interface Props {
  rotulo: string;
  erro?: string;
  dica?: string;
  className?: string;
  children: ReactNode;
}

export default function Campo({ rotulo, erro, dica, className = "", children }: Props) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{rotulo}</span>
      {children}
      {dica && !erro ? <span className="mt-1 block text-xs text-gray-600">{dica}</span> : null}
      {erro ? <span className="mt-1 block text-xs text-danger">{erro}</span> : null}
    </label>
  );
}
