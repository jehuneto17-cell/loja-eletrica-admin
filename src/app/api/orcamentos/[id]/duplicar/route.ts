import { handle, requireUser, ident } from "@/lib/server/http";
import { duplicarOrcamento } from "@/lib/server/orcamentos";

export const POST = (req: Request, c: RouteContext<"/api/orcamentos/[id]/duplicar">) =>
  handle(async () => duplicarOrcamento(await requireUser(req), ident((await c.params).id, "id")));
