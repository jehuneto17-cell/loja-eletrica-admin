"use client";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import type { Produto } from "@/types";
import { useColecao } from "./useColecao";

// ponytail: carrega o catálogo inteiro (até 3000) e filtra no cliente, porque o
// Firestore não faz "contém". Passando disso, trocar por busca no servidor (Algolia/Typesense).
export const LIMITE_CATALOGO = 3000;

export function useProdutos() {
  const lojaId = useAuth().loja!.id;
  return useColecao<Produto>(`produtos:${lojaId}`, () =>
    query(collection(db, "produtos"), where("lojaId", "==", lojaId), orderBy("nome"), limit(LIMITE_CATALOGO)),
  );
}
