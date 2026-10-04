import { handle, lerJson, requireUser, ident } from "@/lib/server/http";
import { cancelarVenda } from "@/lib/server/vendas";

export const POST = (req: Request, c: RouteContext<"/api/vendas/[id]/cancelar">) =>
  handle(async () => {
    const ctx = await requireUser(req, true);
    return cancelarVenda(ctx, ident((await c.params).id, "id"), (await lerJson(req)).motivo);
  });
