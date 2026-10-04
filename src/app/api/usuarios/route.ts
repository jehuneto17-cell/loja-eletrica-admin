import { handle, lerJson, requireUser } from "@/lib/server/http";
import { criarUsuario } from "@/lib/server/usuarios";

export const POST = (req: Request) =>
  handle(async () => criarUsuario(await requireUser(req, true), await lerJson(req)));
