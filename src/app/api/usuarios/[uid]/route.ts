import { ApiError, handle, lerJson, requireUser, ident } from "@/lib/server/http";
import { definirAtivo } from "@/lib/server/usuarios";

export const PATCH = (req: Request, c: RouteContext<"/api/usuarios/[uid]">) =>
  handle(async () => {
    const ctx = await requireUser(req, true);
    const { ativo } = await lerJson(req);
    if (typeof ativo !== "boolean") throw new ApiError(400, "Valor inválido");
    return definirAtivo(ctx, ident((await c.params).uid, "id"), ativo);
  });
