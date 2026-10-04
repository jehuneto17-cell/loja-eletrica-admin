import { ApiError } from "@/lib/server/http";
import { gerarPdf } from "@/lib/server/pdf";
import { linkPdfValido } from "@/lib/server/pdfLink";

// Público de propósito: quem recebe o link no WhatsApp não tem login.
// A proteção é a assinatura HMAC com validade (ver pdfLink.ts).
export async function GET(req: Request, c: RouteContext<"/api/pdf/[id]">) {
  const { id } = await c.params;
  const q = new URL(req.url).searchParams;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !linkPdfValido(id, q.get("exp"), q.get("sig"))) {
    return Response.json({ erro: "Link inválido ou vencido" }, { status: 403 });
  }
  try {
    const { buffer, nome } = await gerarPdf(id, Number(q.get("exp")));
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${nome}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ erro: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ erro: "Erro interno" }, { status: 500 });
  }
}
