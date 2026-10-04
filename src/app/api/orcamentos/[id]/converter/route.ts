import { handle, lerJson, requireUser, texto, ident } from "@/lib/server/http";
import { converterEmVenda } from "@/lib/server/vendas";

export const POST = (req: Request, c: RouteContext<"/api/orcamentos/[id]/converter">) =>
  handle(async () => {
    const ctx = await requireUser(req);
    const b: Record<string, unknown> = await lerJson(req).catch(() => ({}));
    return converterEmVenda(ctx, ident((await c.params).id, "id"), texto(b.formaPagamento, "Forma de pagamento", 60, false));
  });
