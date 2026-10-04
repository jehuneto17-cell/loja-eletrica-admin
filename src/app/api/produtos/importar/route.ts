import { ApiError, handle, lerJson, requireUser } from "@/lib/server/http";
import { importarProdutos, lerProduto } from "@/lib/server/produtos";

export const POST = (req: Request) =>
  handle(async () => {
    const ctx = await requireUser(req, true);
    const { linhas } = await lerJson(req);
    if (!Array.isArray(linhas)) throw new ApiError(400, "Linhas inválidas");
    return importarProdutos(ctx, linhas.map((l) => lerProduto(l)));
  });
