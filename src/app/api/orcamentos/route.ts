import { handle, lerJson, requireUser } from "@/lib/server/http";
import { lerOrcamento, salvarOrcamento } from "@/lib/server/orcamentos";

export const POST = (req: Request) =>
  handle(async () => {
    const ctx = await requireUser(req);
    return salvarOrcamento(ctx, lerOrcamento(await lerJson(req)));
  });
