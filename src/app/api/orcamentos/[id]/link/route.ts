import { adminDb, type Doc } from "@/lib/server/admin";
import { ApiError, handle, requireUser, ident } from "@/lib/server/http";
import { linkPdf } from "@/lib/server/pdfLink";
import type { Orcamento } from "@/types";

export const POST = (req: Request, c: RouteContext<"/api/orcamentos/[id]/link">) =>
  handle(async () => {
    const ctx = await requireUser(req);
    const id = ident((await c.params).id, "id");
    const o = (await adminDb().doc(`orcamentos/${id}`).get()).data() as Doc<Orcamento> | undefined;
    if (!o || o.lojaId !== ctx.lojaId) throw new ApiError(404, "Orçamento não encontrado");
    return { url: linkPdf(new URL(req.url).origin, id) };
  });
