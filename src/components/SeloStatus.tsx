import type { StatusOrcamento } from "@/types";
import Selo, { type Tom } from "./ui/Selo";

const mapa: Record<StatusOrcamento, { rotulo: string; tom: Tom }> = {
  rascunho: { rotulo: "Rascunho", tom: "cinza" },
  enviado: { rotulo: "Enviado", tom: "roxo" },
  aprovado: { rotulo: "Aprovado", tom: "verde" },
  recusado: { rotulo: "Recusado", tom: "vermelho" },
  expirado: { rotulo: "Expirado", tom: "amarelo" },
};

export default function SeloStatus({ status }: { status: StatusOrcamento }) {
  const { rotulo, tom } = mapa[status];
  return <Selo tom={tom}>{rotulo}</Selo>;
}
