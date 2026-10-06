"use client";
import { collection, limit, query, where } from "firebase/firestore";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useColecao } from "@/hooks/useColecao";
import { api } from "@/lib/apiClient";
import { db } from "@/lib/firebase";
import type { Perfil, Usuario } from "@/types";
import Aviso from "./ui/Aviso";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import { inputCls } from "./ui/estilos";
import Selo from "./ui/Selo";

export default function ListaUsuarios() {
  const { loja, user } = useAuth();
  const toast = useToast();
  const lojaId = loja!.id;
  const { dados, erro: erroLista } = useColecao<Usuario>(`usuarios:${lojaId}`, () =>
    query(collection(db, "usuarios"), where("lojaId", "==", lojaId), limit(50)),
  );
  const [f, setF] = useState({ nome: "", email: "", senha: "", perfil: "vendedor" as Perfil });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await api("/api/usuarios", f);
      toast(`${f.nome} cadastrado.`);
      setF({ nome: "", email: "", senha: "", perfil: "vendedor" });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function alternar(id: string, ativo: boolean) {
    try {
      await api(`/api/usuarios/${id}`, { ativo }, "PATCH");
      toast(ativo ? "Acesso liberado." : "Acesso bloqueado.");
    } catch (err) {
      toast((err as Error).message, true);
    }
  }

  async function renomear(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    try {
      await api(`/api/usuarios/${editando.id}`, { nome: editando.nome }, "PATCH");
      toast("Nome alterado.");
      setEditando(null);
    } catch (err) {
      toast((err as Error).message, true);
    }
  }

  return (
    <div className="space-y-6">
      {erroLista ? <Aviso tipo="erro">{erroLista}</Aviso> : null}
      <ul className="divide-y divide-gray-300/60">
        {dados.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            {editando?.id === u.id ? (
              <form onSubmit={renomear} className="flex flex-wrap items-center gap-2">
                <input
                  value={editando.nome}
                  onChange={(e) => setEditando({ id: u.id, nome: e.target.value })}
                  maxLength={80}
                  aria-label="Nome do usuário"
                  className={inputCls + " w-64"}
                  autoFocus
                  required
                />
                <Botao type="submit">Salvar</Botao>
                <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
              </form>
            ) : (
            <span>
              <span className="font-semibold">{u.nome}</span> <Selo tom={u.perfil === "dono" ? "roxo" : "cinza"}>{u.perfil}</Selo>
              {!u.ativo ? <> <Selo tom="vermelho">bloqueado</Selo></> : null}
              <span className="block text-xs text-gray-600">{u.email}</span>
            </span>
            )}
            {editando?.id !== u.id ? (
              <span className="flex gap-2">
                <Botao variante="secundario" onClick={() => setEditando({ id: u.id, nome: u.nome })}>Editar nome</Botao>
                {u.id !== user?.uid ? (
                  <Botao variante="secundario" onClick={() => alternar(u.id, !u.ativo)}>{u.ativo ? "Bloquear" : "Liberar"}</Botao>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <form onSubmit={criar} className="space-y-4 rounded-md bg-gray-100 p-4">
        <h3 className="font-bold text-gray-900">Novo usuário</h3>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome"><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={80} className={inputCls} required /></Campo>
          <Campo rotulo="E-mail"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} required /></Campo>
          <Campo rotulo="Senha inicial" dica="Mínimo 8 caracteres. Combine com a pessoa."><input type="text" autoComplete="off" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} minLength={8} className={inputCls} required /></Campo>
          <Campo rotulo="Perfil">
            <select value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.target.value as Perfil })} className={inputCls}>
              <option value="vendedor">Vendedor (orçamentos e vendas)</option>
              <option value="dono">Dono (tudo)</option>
            </select>
          </Campo>
        </div>
        <div className="flex justify-end"><Botao type="submit" carregando={enviando}>Cadastrar</Botao></div>
      </form>
    </div>
  );
}
