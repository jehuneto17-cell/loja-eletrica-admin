"use client";
import FormLoja from "@/components/FormLoja";
import ListaUsuarios from "@/components/ListaUsuarios";
import Aviso from "@/components/ui/Aviso";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Cartao from "@/components/ui/Cartao";
import { useAuth } from "@/context/AuthContext";

export default function Configuracoes() {
  const { ehDono } = useAuth();
  if (!ehDono) return <Aviso>Só o dono acessa as configurações.</Aviso>;
  return (
    <>
      <CabecalhoPagina titulo="Configurações" />
      <div className="space-y-4">
        <Cartao titulo="Dados da loja e do PDF"><FormLoja /></Cartao>
        <Cartao titulo="Usuários"><ListaUsuarios /></Cartao>
      </div>
    </>
  );
}
