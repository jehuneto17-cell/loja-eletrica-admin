"use client";
import { onSnapshot, type Query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

export type ComId<T> = T & { id: string };

interface Estado<T> {
  key: string | null;
  dados: ComId<T>[];
  erro?: string;
}

/**
 * Lista em tempo real. `key` identifica a consulta (null = não consultar);
 * trocar a key reinscreve. Sempre use query com limit().
 * Ao trocar a key, `dados` mantém a lista anterior até chegar a nova (sem piscar
 * nem perder a rolagem em "carregar mais"); `carregando` fica true nesse intervalo.
 */
export function useColecao<T>(key: string | null, build: () => Query) {
  const [estado, setEstado] = useState<Estado<T>>({ key: null, dados: [] });
  const buildRef = useRef(build);
  useEffect(() => {
    buildRef.current = build;
  });

  useEffect(() => {
    if (!key) return;
    return onSnapshot(
      buildRef.current(),
      (snap) => setEstado({ key, dados: snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })) }),
      (e) => setEstado({ key, dados: [], erro: e.message }),
    );
  }, [key]);

  const pronto = estado.key === key;
  return {
    dados: estado.dados,
    carregando: key !== null && !pronto,
    erro: pronto ? estado.erro : undefined,
  };
}
