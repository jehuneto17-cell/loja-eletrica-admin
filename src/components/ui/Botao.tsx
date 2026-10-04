import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const cores: Record<Variante, string> = {
  primario: "bg-primary text-white hover:bg-primary/90",
  secundario: "border border-gray-300 bg-white text-gray-800 hover:bg-gray-100",
  perigo: "bg-danger text-white hover:bg-danger/90",
  fantasma: "text-gray-700 hover:bg-gray-200",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
}

export default function Botao({ variante = "primario", carregando, disabled, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || carregando}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${cores[variante]} ${className}`}
      {...rest}
    >
      {carregando ? "Aguarde…" : children}
    </button>
  );
}
