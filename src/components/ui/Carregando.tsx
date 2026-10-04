export default function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-10 text-gray-600">
      <span className="size-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      {texto}
    </div>
  );
}
