import type { ReactNode } from "react";

type Tipo = "erro" | "alerta" | "info";

const estilos: Record<Tipo, string> = {
  erro: "border-danger/30 bg-danger/10 text-danger",
  alerta: "border-warning/50 bg-warning/15 text-yellow-900",
  info: "border-info/40 bg-info/10 text-gray-800",
};

export default function Aviso({ tipo = "info", children }: { tipo?: Tipo; children: ReactNode }) {
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${estilos[tipo]}`}>
      {children}
    </div>
  );
}
