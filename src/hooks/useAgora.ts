"use client";
import { useEffect, useState } from "react";

/** Relógio que se atualiza a cada minuto e ao voltar para a aba (PWA aberto de um dia para o outro). */
export function useAgora(): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const atualizar = () => setAgora(Date.now());
    const t = setInterval(atualizar, 60_000);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, []);
  return agora;
}
