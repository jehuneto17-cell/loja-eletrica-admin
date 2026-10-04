import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="m-auto max-w-sm space-y-3 p-6 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-lg font-bold text-gray-900">Página não encontrada</h1>
      <p className="text-gray-600">O endereço não existe ou foi movido.</p>
      <Link href="/" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
        Ir para o início
      </Link>
    </div>
  );
}
