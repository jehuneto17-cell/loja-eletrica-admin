import Link from "next/link";

interface Props {
  titulo: string;
  valor: string;
  detalhe?: string;
  href?: string;
  alerta?: boolean;
}

export default function CartaoNumero({ titulo, valor, detalhe, href, alerta }: Props) {
  const corpo = (
    <div className={`rounded-lg bg-white p-5 shadow-card ${alerta ? "ring-2 ring-warning" : ""}`}>
      <p className="text-sm text-gray-600">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
      {detalhe ? <p className="text-xs text-gray-600">{detalhe}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:opacity-90">
      {corpo}
    </Link>
  ) : (
    corpo
  );
}
