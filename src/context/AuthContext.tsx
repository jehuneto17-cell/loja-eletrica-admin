"use client";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db } from "@/lib/firebase";
import type { Loja, Usuario } from "@/types";

type LojaComId = Loja & { id: string };

interface AuthState {
  user: User | null;
  usuario: Usuario | null; // null com user presente = sem acesso (sem perfil ou desativado)
  loja: LojaComId | null;
  carregando: boolean;
  ehDono: boolean;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authPronto, setAuthPronto] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<{ uid: string; usuario: Usuario | null } | null>(null);
  const [lojaEst, setLojaEst] = useState<{ id: string; loja: LojaComId | null } | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthPronto(true);
      }),
    [],
  );

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "usuarios", uid),
      (s) => setPerfil({ uid, usuario: s.exists() && s.data().ativo ? (s.data() as Usuario) : null }),
      () => setPerfil({ uid, usuario: null }), // desativado: a regra nega a leitura
    );
  }, [uid]);

  const usuario = perfil && perfil.uid === uid ? perfil.usuario : null;
  const lojaId = usuario?.lojaId;
  useEffect(() => {
    if (!lojaId) return;
    return onSnapshot(
      doc(db, "lojas", lojaId),
      (s) => setLojaEst({ id: lojaId, loja: s.exists() ? { id: s.id, ...(s.data() as Loja) } : null }),
      () => setLojaEst({ id: lojaId, loja: null }),
    );
  }, [lojaId]);

  const carregando =
    !authPronto || (!!user && perfil?.uid !== user.uid) || (!!lojaId && lojaEst?.id !== lojaId);

  const valor = useMemo<AuthState>(
    () => ({
      user,
      usuario,
      loja: lojaEst && lojaEst.id === lojaId ? lojaEst.loja : null,
      carregando,
      ehDono: usuario?.perfil === "dono",
      sair: () => signOut(auth),
    }),
    [user, usuario, lojaEst, lojaId, carregando],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
