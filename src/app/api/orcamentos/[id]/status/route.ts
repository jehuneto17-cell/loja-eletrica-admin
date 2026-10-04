import { handle, lerJson, requireUser, ApiError, ident } from "@/lib/server/http";
import { mudarStatus } from "@/lib/server/orcamentos";
import { PROXIMOS_STATUS } from "@/lib/status";
import type { StatusOrcamento } from "@/types";

export const POST = (req: Request, c: RouteContext<"/api/orcamentos/[id]/status">) =>
  handle(async () => {
    const ctx = await requireUser(req);
    const { status } = await lerJson(req);
    if (typeof status !== "string" || !Object.hasOwn(PROXIMOS_STATUS, status)) throw new ApiError(400, "Status inválido");
    return mudarStatus(ctx, ident((await c.params).id, "id"), status as StatusOrcamento);
  });
