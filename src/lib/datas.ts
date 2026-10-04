import type { Timestamp } from "firebase/firestore";

export const formatData = (t: Timestamp | undefined) =>
  t ? t.toDate().toLocaleDateString("pt-BR") : "—";

export const formatDataHora = (t: Timestamp | undefined) =>
  t ? t.toDate().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const inicioDoDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const inicioDoMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
