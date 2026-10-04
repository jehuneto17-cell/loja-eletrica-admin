import { auth } from "./firebase";

/** Chama /api/* com o ID token do usuário logado. Lança Error com a mensagem do servidor. */
export async function api<T = unknown>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sessão expirada. Entre de novo.");
  const res = await fetch(path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.erro ?? "Erro inesperado. Tente de novo.");
  return json as T;
}
