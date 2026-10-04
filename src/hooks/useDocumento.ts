"use client";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { ComId } from "./useColecao";

interface Estado<T> {
  path: string | null;
  dado: ComId<T> | null;
  erro?: string;
}

/** Documento em tempo real. dado = null quando não existe. */
export function useDocumento<T>(path: string | null) {
  const [estado, setEstado] = useState<Estado<T>>({ path: null, dado: null });

  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      doc(db, path),
      (s) => setEstado({ path, dado: s.exists() ? { id: s.id, ...(s.data() as T) } : null }),
      (e) => setEstado({ path, dado: null, erro: e.message }),
    );
  }, [path]);

  const pronto = estado.path === path;
  return {
    dado: pronto ? estado.dado : null,
    carregando: path !== null && !pronto,
    erro: pronto ? estado.erro : undefined,
  };
}
