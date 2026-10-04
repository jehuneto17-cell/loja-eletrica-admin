"use client";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ComId } from "@/hooks/useColecao";
import { db } from "@/lib/firebase";
import type { Cliente } from "@/types";
import Aviso from "./ui/Aviso";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import { inputCls } from "./ui/estilos";

interface Props {
  cliente?: ComId<Cliente>;
  /** chamado depois de gravar, com o id do cliente */
  onSalvo: (id: string, nome: string) => void;
  onCancelar?: () => void;
}

export default function FormCliente({ cliente, onSalvo, onCancelar }: Props) {
  const lojaId = useAuth().loja!.id;
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [telefone, setTelefone] = useState(cliente?.telefone ?? "");
  const [cpfCnpj, setCpfCnpj] = useState(cliente?.cpfCnpj ?? "");
  const [endereco, setEndereco] = useState(cliente?.endereco ?? "");
  const [observacoes, setObservacoes] = useState(cliente?.observacoes ?? "");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // pode estar dentro de um modal que está dentro de outro form
    if (!nome.trim()) return setErro("Informe o nome.");
    setErro("");
    setEnviando(true);
    const campos = {
      nome: nome.trim(),
      telefone: telefone.trim(),
      cpfCnpj: cpfCnpj.trim(),
      endereco: endereco.trim(),
      observacoes: observacoes.trim(),
    };
    try {
      if (cliente) {
        await updateDoc(doc(db, "clientes", cliente.id), campos);
        onSalvo(cliente.id, campos.nome);
      } else {
        const ref = await addDoc(collection(db, "clientes"), { ...campos, lojaId, criadoEm: serverTimestamp() });
        onSalvo(ref.id, campos.nome);
      }
    } catch {
      setErro("Não foi possível salvar o cliente. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome" className="sm:col-span-2"><input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className={inputCls} autoFocus /></Campo>
        <Campo rotulo="Telefone / WhatsApp"><input inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} className={inputCls} placeholder="(35) 99999-0000" /></Campo>
        <Campo rotulo="CPF / CNPJ (opcional)"><input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} maxLength={20} className={inputCls} /></Campo>
        <Campo rotulo="Endereço" className="sm:col-span-2"><input value={endereco} onChange={(e) => setEndereco(e.target.value)} maxLength={200} className={inputCls} /></Campo>
        <Campo rotulo="Observações" className="sm:col-span-2"><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={500} rows={2} className={inputCls} /></Campo>
      </div>
      <div className="flex justify-end gap-2">
        {onCancelar ? <Botao variante="secundario" onClick={onCancelar}>Cancelar</Botao> : null}
        <Botao type="submit" carregando={enviando}>Salvar</Botao>
      </div>
    </form>
  );
}
