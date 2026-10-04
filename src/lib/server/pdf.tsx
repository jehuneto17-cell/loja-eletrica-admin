import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Cliente, ItemDocumento, Loja, Orcamento } from "@/types";
import { formatMoeda, formatQuantidade } from "../calc.ts";
import { statusDoOrcamento } from "../status.ts";
import { adminDb, type Doc } from "./admin.ts";
import { ApiError, ident } from "./http.ts";
import { linkRevogado } from "./pdfLink.ts";

// PDF não passa pelo Tailwind: react-pdf tem o próprio StyleSheet (exceção da regra de estilos).
const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#212b36" },
  topo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  logo: { width: 64, height: 64, objectFit: "contain", marginRight: 12 },
  loja: { flexDirection: "row", alignItems: "center" },
  nomeLoja: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  cinza: { color: "#637381" },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#624bff", textAlign: "right" },
  caixa: { backgroundColor: "#f4f6f8", padding: 10, marginBottom: 14, borderRadius: 4 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#c4cdd5", paddingBottom: 4, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderColor: "#dfe3e8" },
  desc: { flex: 1 },
  qtd: { width: 62, textAlign: "right" },
  preco: { width: 66, textAlign: "right" },
  desct: { width: 56, textAlign: "right" },
  total: { width: 70, textAlign: "right" },
  totais: { marginTop: 12, alignSelf: "flex-end", width: 200 },
  linhaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grande: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  direita: { textAlign: "right" },
  margem14: { marginTop: 14 },
  margem6: { marginTop: 6 },
  rodape: { position: "absolute", bottom: 28, left: 36, right: 36, textAlign: "center", color: "#919eab", fontSize: 9 },
});

const data = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

// Hosts de onde o servidor aceita buscar o logo. Nunca passar a URL direto ao react-pdf:
// ele lê "file:" do disco e busca qualquer endereço (SSRF) sem timeout.
const HOSTS_LOGO = ["res.cloudinary.com", "firebasestorage.googleapis.com"];
const LOGO_MAX_BYTES = 500_000;

type LogoPdf = { data: Buffer; format: "png" | "jpg" };

export async function carregarLogo(url: string | undefined): Promise<LogoPdf | undefined> {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || !HOSTS_LOGO.includes(u.hostname)) return undefined;
    const r = await fetch(u, { signal: AbortSignal.timeout(3000), redirect: "error" });
    const tipo = r.headers.get("content-type") ?? "";
    const formato = tipo.startsWith("image/png") ? "png" : tipo.startsWith("image/jpeg") ? "jpg" : undefined;
    if (!r.ok || !formato) return undefined;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 0 && buf.length <= LOGO_MAX_BYTES ? { data: buf, format: formato } : undefined;
  } catch {
    return undefined; // logo é enfeite: qualquer falha gera o PDF sem ele
  }
}

interface Dados {
  loja: Doc<Loja>;
  logo?: LogoPdf;
  orc: Doc<Orcamento>;
  cliente?: Doc<Cliente>;
  itens: ItemDocumento[];
}

function Orcamento({ d }: { d: Dados }) {
  const { loja, logo, orc, cliente, itens } = d;
  const status = statusDoOrcamento(orc);
  return (
    <Document title={orc.numero} author={loja.nome}>
      <Page size="A4" style={s.page}>
        <View style={s.topo}>
          <View style={s.loja}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
            {logo ? <Image src={logo} style={s.logo} /> : null}
            <View>
              <Text style={s.nomeLoja}>{loja.nome}</Text>
              {loja.cnpj ? <Text style={s.cinza}>CNPJ {loja.cnpj}</Text> : null}
              {loja.telefone ? <Text style={s.cinza}>{loja.telefone}</Text> : null}
              {loja.endereco ? <Text style={s.cinza}>{loja.endereco}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.titulo}>ORÇAMENTO {orc.numero}</Text>
            <Text style={s.direita}>Emitido em {data(orc.criadoEm.toMillis())}</Text>
            <Text style={s.direita}>
              {status === "expirado" ? "Vencido em " : "Válido até "}
              {data(orc.validade.toMillis())}
            </Text>
          </View>
        </View>

        <View style={s.caixa}>
          <Text style={s.cinza}>Cliente</Text>
          <Text>{cliente?.nome ?? "—"}</Text>
          {cliente?.telefone ? <Text>{cliente.telefone}</Text> : null}
          {cliente?.endereco ? <Text>{cliente.endereco}</Text> : null}
        </View>

        <View style={s.th}>
          <Text style={s.desc}>Item</Text>
          <Text style={s.qtd}>Qtd.</Text>
          <Text style={s.preco}>Preço</Text>
          <Text style={s.desct}>Desc.</Text>
          <Text style={s.total}>Total</Text>
        </View>
        {itens.map((i, n) => (
          <View key={n} style={s.tr} wrap={false}>
            <Text style={s.desc}>{i.descricao}</Text>
            <Text style={s.qtd}>
              {formatQuantidade(i.quantidade)} {i.unidade}
            </Text>
            <Text style={s.preco}>{formatMoeda(i.precoUnitario)}</Text>
            <Text style={s.desct}>{i.desconto ? formatMoeda(i.desconto) : "—"}</Text>
            <Text style={s.total}>{formatMoeda(i.total)}</Text>
          </View>
        ))}

        <View style={s.totais} wrap={false}>
          <View style={s.linhaTotal}>
            <Text>Subtotal</Text>
            <Text>{formatMoeda(orc.subtotal)}</Text>
          </View>
          {orc.desconto > 0 ? (
            <View style={s.linhaTotal}>
              <Text>Desconto</Text>
              <Text>- {formatMoeda(orc.desconto)}</Text>
            </View>
          ) : null}
          <View style={[s.linhaTotal, s.grande]}>
            <Text>Total</Text>
            <Text>{formatMoeda(orc.total)}</Text>
          </View>
        </View>

        {orc.formaPagamento ? <Text style={s.margem14}>Pagamento: {orc.formaPagamento}</Text> : null}
        {orc.observacoes ? <Text style={s.margem6}>Obs.: {orc.observacoes}</Text> : null}
        {loja.textoRodapePdf ? <Text style={s.rodape}>{loja.textoRodapePdf}</Text> : null}
      </Page>
    </Document>
  );
}

/** `exp` é o vencimento do link usado; serve para checar se o orçamento revogou links daquela época. */
export async function gerarPdf(orcamentoId: string, exp?: number): Promise<{ buffer: Buffer; nome: string }> {
  const db = adminDb();
  const orcSnap = await db.doc(`orcamentos/${ident(orcamentoId, "id")}`).get();
  const orc = orcSnap.data() as Doc<Orcamento> | undefined;
  // mesmo erro para "não existe" e "link revogado": não revela qual dos dois
  if (!orc || (exp !== undefined && linkRevogado(exp, orc.linkRevogadoEm))) {
    throw new ApiError(403, "Link inválido ou vencido");
  }
  const [lojaSnap, clienteSnap, itensSnap] = await Promise.all([
    db.doc(`lojas/${orc.lojaId}`).get(),
    db.doc(`clientes/${orc.clienteId}`).get(),
    orcSnap.ref.collection("itens").orderBy("ordem").get(),
  ]);
  const loja = lojaSnap.data() as Doc<Loja>;
  const d: Dados = {
    loja,
    logo: await carregarLogo(loja.logoUrl),
    orc,
    cliente: clienteSnap.data() as Doc<Cliente> | undefined,
    itens: itensSnap.docs.map((i) => i.data() as ItemDocumento),
  };
  return { buffer: await renderToBuffer(<Orcamento d={d} />), nome: `${orc.numero}.pdf` };
}
