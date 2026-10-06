import { ApiError, handle, lerJson, requireUser, ident } from "@/lib/server/http";
import { definirAtivo, renomearUsuario } from "@/lib/server/usuarios";

export const PATCH = (req: Request, c: RouteContext<"/api/usuarios/[uid]">) =>
  handle(async () => {
    const ctx = await requireUser(req, true);
    const { ativo, nome } = await lerJson(req);
    const uid = ident((await c.params).uid, "id");
    if (nome !== undefined) return renomearUsuario(ctx, uid, nome);
    if (typeof ativo !== "boolean") throw new ApiError(400, "Valor inválido");
    return definirAtivo(ctx, uid, ativo);
  });
