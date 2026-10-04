import type { Perfil, Usuario } from "@/types";
import { adminAuth, adminDb, type Doc } from "./admin.ts";
import { ApiError, texto, type Ctx } from "./http.ts";

/** Dono cria vendedor (ou outro dono). Não existe cadastro público. */
export async function criarUsuario(ctx: Ctx, b: Record<string, unknown>) {
  const nome = texto(b.nome, "Nome", 80);
  const email = texto(b.email, "E-mail", 120).toLowerCase();
  const senha = texto(b.senha, "Senha", 100);
  if (senha.length < 8) throw new ApiError(400, "A senha precisa de pelo menos 8 caracteres");
  if (b.perfil !== "dono" && b.perfil !== "vendedor") throw new ApiError(400, "Perfil inválido");
  const perfil: Perfil = b.perfil;

  let uid: string;
  try {
    uid = (await adminAuth().createUser({ email, password: senha, displayName: nome })).uid;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/email-already-exists") throw new ApiError(409, "Esse e-mail já está em uso");
    if (code === "auth/invalid-email") throw new ApiError(400, "E-mail inválido");
    throw e;
  }
  try {
    const u: Usuario = { lojaId: ctx.lojaId, nome, email, perfil, ativo: true };
    await adminDb().doc(`usuarios/${uid}`).set(u);
  } catch (e) {
    await adminAuth().deleteUser(uid); // não deixa conta sem perfil
    throw e;
  }
  return { uid };
}

export async function definirAtivo(ctx: Ctx, uid: string, ativo: boolean) {
  if (uid === ctx.uid) throw new ApiError(400, "Você não pode desativar o próprio acesso");
  const ref = adminDb().doc(`usuarios/${uid}`);
  const u = (await ref.get()).data() as Doc<Usuario> | undefined;
  if (!u || u.lojaId !== ctx.lojaId) throw new ApiError(404, "Usuário não encontrado");
  await ref.update({ ativo });
  if (!ativo) await adminAuth().revokeRefreshTokens(uid);
  return { ativo };
}
