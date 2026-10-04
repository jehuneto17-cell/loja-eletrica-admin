"use client";
import { doc, updateDoc } from "firebase/firestore";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { db } from "@/lib/firebase";
import Aviso from "./ui/Aviso";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import { inputCls } from "./ui/estilos";

export default function FormLoja() {
  const loja = useAuth().loja!;
  const toast = useToast();
  const [f, setF] = useState({
    nome: loja.nome,
    cnpj: loja.cnpj ?? "",
    telefone: loja.telefone ?? "",
    endereco: loja.endereco ?? "",
    logoUrl: loja.logoUrl ?? "",
    textoRodapePdf: loja.textoRodapePdf ?? "",
    validade: String(loja.validadePadraoDias),
    descMax: String(loja.descontoMaxVendedorPct),
    semEstoque: loja.permiteVendaSemEstoque,
  });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const validade = Number(f.validade);
    const descMax = Number(f.descMax.replace(",", "."));
    if (!f.nome.trim()) return setErro("Informe o nome da loja.");
    if (!Number.isInteger(validade) || validade < 1 || validade > 365) return setErro("Validade padrão: de 1 a 365 dias.");
    if (!Number.isFinite(descMax) || descMax < 0 || descMax > 100) return setErro("Limite de desconto: de 0 a 100%.");
    if (f.logoUrl && !/^https:\/\/(res\.cloudinary\.com|firebasestorage\.googleapis\.com)\//.test(f.logoUrl.trim())) {
      return setErro("O logo precisa estar no Cloudinary ou no Firebase Storage (link https://res.cloudinary.com/… ou https://firebasestorage.googleapis.com/…).");
    }
    setErro("");
    setEnviando(true);
    try {
      await updateDoc(doc(db, "lojas", loja.id), {
        nome: f.nome.trim(),
        cnpj: f.cnpj.trim(),
        telefone: f.telefone.trim(),
        endereco: f.endereco.trim(),
        logoUrl: f.logoUrl.trim(),
        textoRodapePdf: f.textoRodapePdf.trim(),
        validadePadraoDias: validade,
        descontoMaxVendedorPct: descMax,
        permiteVendaSemEstoque: f.semEstoque,
      });
      toast("Configurações salvas.");
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome da loja"><input value={f.nome} onChange={(e) => set("nome", e.target.value)} maxLength={120} className={inputCls} /></Campo>
        <Campo rotulo="CNPJ"><input value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} maxLength={20} className={inputCls} /></Campo>
        <Campo rotulo="Telefone"><input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} maxLength={30} className={inputCls} /></Campo>
        <Campo rotulo="Endereço"><input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} maxLength={200} className={inputCls} /></Campo>
        <Campo rotulo="Link do logo (PNG ou JPG, até 500 KB)" dica="Aparece no PDF do orçamento. Aceita links do Cloudinary e do Firebase Storage." className="sm:col-span-2"><input value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} className={inputCls} placeholder="https://res.cloudinary.com/…/logo.png" /></Campo>
        <Campo rotulo="Texto do rodapé do PDF" className="sm:col-span-2"><input value={f.textoRodapePdf} onChange={(e) => set("textoRodapePdf", e.target.value)} maxLength={200} className={inputCls} placeholder="Ex.: Preços sujeitos a alteração sem aviso." /></Campo>
        <Campo rotulo="Validade padrão do orçamento (dias)"><input inputMode="numeric" value={f.validade} onChange={(e) => set("validade", e.target.value)} className={inputCls} /></Campo>
        <Campo rotulo="Desconto máximo do vendedor (%)" dica="Acima disso só o dono salva o orçamento."><input inputMode="decimal" value={f.descMax} onChange={(e) => set("descMax", e.target.value)} className={inputCls} /></Campo>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={f.semEstoque} onChange={(e) => set("semEstoque", e.target.checked)} />
        <span>Permitir vender sem estoque suficiente <span className="block text-xs text-gray-600">O saldo fica negativo e aparece em destaque. Desmarcado, a venda é bloqueada.</span></span>
      </label>
      <div className="flex justify-end"><Botao type="submit" carregando={enviando}>Salvar</Botao></div>
    </form>
  );
}
