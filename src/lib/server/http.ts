import { adminAuth, adminDb, type Doc } from "./admin.ts";
import type { Perfil, Usuario } from "@/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Ctx {
  uid: string;
  lojaId: string;
  perfil: Perfil;
  nome: string;
}

/** Padrão /api: token no header -> verifica -> carrega usuário ativo -> (opcional) exige dono. */
export async function requireUser(req: Request, soDono = false): Promise<Ctx> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) throw new ApiError(401, "Não autenticado");
  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    throw new ApiError(401, "Sessão inválida");
  }
  const snap = await adminDb().doc(`usuarios/${uid}`).get();
  const u = snap.data() as Doc<Usuario> | undefined;
  if (!u || !u.ativo) throw new ApiError(403, "Usuário sem acesso");
  if (soDono && u.perfil !== "dono") throw new ApiError(403, "Só o dono pode fazer isso");
  return { uid, lojaId: u.lojaId, perfil: u.perfil, nome: u.nome };
}

export async function lerJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch {
    // cai no erro abaixo
  }
  throw new ApiError(400, "Corpo inválido");
}

/** Transforma ApiError em resposta JSON; qualquer outro erro vira 500 sem vazar detalhe. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ erro: e.message }, { status: e.status });
    // duas operações disputando o mesmo documento: o Firestore desiste depois de algumas tentativas
    const code = (e as { code?: unknown }).code;
    if (code === 10 || code === "aborted" || /too much contention|transaction.*abort/i.test(String((e as Error).message))) {
      return Response.json({ erro: "Outra operação estava mexendo nisso ao mesmo tempo. Tente de novo." }, { status: 409 });
    }
    console.error(e);
    return Response.json({ erro: "Erro interno" }, { status: 500 });
  }
}

// --- validadores (a entrada vem do cliente, nunca confiar) ---

/** Id de documento/usuário vindo do cliente: sem "/" nem nada que vire caminho do Firestore. */
export function ident(v: unknown, nome: string): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) throw new ApiError(400, `${nome} inválido`);
  return v;
}

export function objeto(v: unknown, nome: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ApiError(400, `${nome} inválido`);
  return v as Record<string, unknown>;
}

export function inteiro(v: unknown, nome: string, min = 0, max = 1e12): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) {
    throw new ApiError(400, `${nome} inválido`);
  }
  return v;
}

export function texto(v: unknown, nome: string, max = 200, obrigatorio = true): string {
  if (v === undefined || v === null || v === "") {
    if (obrigatorio) throw new ApiError(400, `${nome} é obrigatório`);
    return "";
  }
  if (typeof v !== "string" || v.length > max) throw new ApiError(400, `${nome} inválido`);
  const t = v.trim();
  if (obrigatorio && !t) throw new ApiError(400, `${nome} é obrigatório`);
  return t;
}
