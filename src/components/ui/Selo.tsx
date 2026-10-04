import type { ReactNode } from "react";

export type Tom = "cinza" | "roxo" | "verde" | "amarelo" | "vermelho";

const tons: Record<Tom, string> = {
  cinza: "bg-gray-300 text-gray-800",
  roxo: "bg-primary/10 text-primary",
  verde: "bg-green-100 text-green-700",
  amarelo: "bg-warning/20 text-yellow-800",
  vermelho: "bg-danger/10 text-danger",
};

export default function Selo({ tom = "cinza", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tons[tom]}`}>
      {children}
    </span>
  );
}
