import { handle, lerJson, requireUser } from "@/lib/server/http";
import { lerProduto, salvarProduto } from "@/lib/server/produtos";

export const POST = (req: Request) =>
  handle(async () => {
    const ctx = await requireUser(req, true);
    return salvarProduto(ctx, lerProduto(await lerJson(req)));
  });
