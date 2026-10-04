"use client";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Aviso from "@/components/ui/Aviso";
import Botao from "@/components/ui/Botao";
import Campo from "@/components/ui/Campo";
import { inputCls } from "@/components/ui/estilos";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";

function mensagem(e: unknown): string {
  const code = (e as { code?: string }).code;
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "E-mail ou senha incorretos.";
  }
  if (code === "auth/too-many-requests") return "Muitas tentativas. Espere alguns minutos.";
  if (code === "auth/network-request-failed") return "Sem conexão. Tente de novo.";
  return "Não foi possível entrar. Tente de novo.";
}

export default function LoginPage() {
  const { user, usuario, carregando } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!carregando && user && usuario) router.replace("/");
  }, [carregando, user, usuario, router]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="m-auto w-full max-w-sm p-4">
      <form onSubmit={entrar} className="space-y-4 rounded-lg bg-white p-6 shadow-card">
        <div className="text-center">
          <div className="text-3xl">⚡</div>
          <h1 className="text-xl font-bold text-gray-900">Orçamentos e Estoque</h1>
          <p className="text-sm text-gray-600">Entre com o e-mail e a senha que o dono cadastrou.</p>
        </div>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <Campo rotulo="E-mail">
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Campo>
        <Campo rotulo="Senha">
          <input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
        </Campo>
        <Botao type="submit" carregando={enviando} className="w-full">
          Entrar
        </Botao>
      </form>
    </div>
  );
}
