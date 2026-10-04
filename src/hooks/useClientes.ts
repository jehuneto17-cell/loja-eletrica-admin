"use client";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import type { Cliente } from "@/types";
import { useColecao } from "./useColecao";

// ponytail: mesma estratégia do catálogo (filtro no cliente, teto de 3000).
export function useClientes() {
  const lojaId = useAuth().loja!.id;
  return useColecao<Cliente>(`clientes:${lojaId}`, () =>
    query(collection(db, "clientes"), where("lojaId", "==", lojaId), orderBy("nome"), limit(3000)),
  );
}
