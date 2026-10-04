import { lerMovimento, movimentarEstoque } from "@/lib/server/estoque";
import { handle, lerJson, requireUser } from "@/lib/server/http";

export const POST = (req: Request) =>
  handle(async () => {
    const ctx = await requireUser(req, true);
    return movimentarEstoque(ctx, lerMovimento(await lerJson(req)));
  });
