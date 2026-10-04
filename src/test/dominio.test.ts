// Roda no emulador: npm run test:emu
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-loja";
process.env.PDF_LINK_SECRET = "segredo-de-teste-123456";

const { adminDb, adminAuth, Timestamp } = await import("../lib/server/admin.ts");
const { ApiError, requireUser } = await import("../lib/server/http.ts");
const { lerOrcamento, salvarOrcamento, mudarStatus, duplicarOrcamento } = await import("../lib/server/orcamentos.ts");
const { converterEmVenda, cancelarVenda } = await import("../lib/server/vendas.ts");
const { lerMovimento, movimentarEstoque } = await import("../lib/server/estoque.ts");
const { lerProduto, salvarProduto, importarProdutos } = await import("../lib/server/produtos.ts");
const { criarUsuario, definirAtivo } = await import("../lib/server/usuarios.ts");
const { linkPdf, linkPdfValido } = await import("../lib/server/pdfLink.ts");

const db = adminDb();
const L = "loja1";
const dono = { uid: "dono1", lojaId: L, perfil: "dono" as const, nome: "Dono" };
const vend = { uid: "vend1", lojaId: L, perfil: "vendedor" as const, nome: "Vendedor" };
const outra = { uid: "dono2", lojaId: "loja2", perfil: "dono" as const, nome: "Outro" };

async function erro(p: Promise<unknown>, status: number) {
  await assert.rejects(p, (e: unknown) => e instanceof ApiError && e.status === status, `esperava ${status}`);
}
const prod = (extra: Record<string, unknown> = {}) =>
  lerProduto({ codigo: "CAB-25", nome: "Cabo 2,5mm", unidade: "m", precoVenda: 890, estoqueMinimo: 5000, ...extra });
const saldo = async (id: string) => (await db.doc(`produtos/${id}`).get()).data()!;
const movs = async (id: string) =>
  (await db.collection("movimentacoes").where("produtoId", "==", id).get()).docs.map((d) => d.data());
const orc = (produtoId: string, quantidade: number, extra: Record<string, unknown> = {}) =>
  lerOrcamento({ clienteId: "cli1", itens: [{ produtoId, quantidade }], ...extra });

let cabo: string;

before(async () => {
  await db.doc(`lojas/${L}`).set({
    nome: "Elétrica Teste", validadePadraoDias: 15, descontoMaxVendedorPct: 10,
    permiteVendaSemEstoque: false, ultimoNumeroOrcamento: 0, ultimoNumeroVenda: 0,
  });
  await db.doc("lojas/loja2").set({
    nome: "Outra", validadePadraoDias: 15, descontoMaxVendedorPct: 10,
    permiteVendaSemEstoque: false, ultimoNumeroOrcamento: 0, ultimoNumeroVenda: 0,
  });
  await db.doc("clientes/cli1").set({ lojaId: L, nome: "João", criadoEm: Timestamp.now() });
  cabo = (await salvarProduto(dono, prod())).id;
  await movimentarEstoque(dono, lerMovimento({ produtoId: cabo, tipo: "entrada", quantidade: 100000, motivo: "Compra" }));
});

describe("produtos e estoque", () => {
  test("código repetido na loja é recusado", async () => {
    await erro(salvarProduto(dono, prod({ nome: "Outro" })), 409);
  });
  test("movimentação exige motivo e entrada positiva", () => {
    assert.throws(() => lerMovimento({ produtoId: "x", tipo: "perda", quantidade: 1, motivo: "" }), ApiError);
    assert.throws(() => lerMovimento({ produtoId: "x", tipo: "entrada", quantidade: -5, motivo: "x" }), ApiError);
  });
  test("saldo inicial gravou movimentação", async () => {
    const m = await movs(cabo);
    assert.equal(m.length, 1);
    assert.equal((await saldo(cabo)).estoqueAtual, 100000);
    assert.equal((await saldo(cabo)).abaixoDoMinimo, false);
  });
  test("perda abaixo do mínimo liga o alerta; ajuste calcula a diferença", async () => {
    const p = (await salvarProduto(dono, prod({ codigo: "TOM-10", nome: "Tomada", unidade: "un", precoVenda: 1500, estoqueMinimo: 3000 }))).id;
    await movimentarEstoque(dono, lerMovimento({ produtoId: p, tipo: "entrada", quantidade: 10000, motivo: "Compra" }));
    await movimentarEstoque(dono, lerMovimento({ produtoId: p, tipo: "perda", quantidade: 8000, motivo: "Quebrou" }));
    assert.equal((await saldo(p)).abaixoDoMinimo, true);
    const r = await movimentarEstoque(dono, lerMovimento({ produtoId: p, tipo: "ajuste", novoSaldo: 9000, motivo: "Contagem" }));
    assert.equal(r.saldoApos, 9000);
    assert.equal((await saldo(p)).abaixoDoMinimo, false);
    const m = await movs(p);
    assert.deepEqual(m.map((x) => x.tipo).sort(), ["ajuste", "entrada", "perda"]);
    assert.equal(m.find((x) => x.tipo === "ajuste")!.quantidade, 7000);
    await erro(movimentarEstoque(dono, lerMovimento({ produtoId: p, tipo: "ajuste", novoSaldo: 9000, motivo: "igual" })), 400);
  });
  test("outra loja não mexe no produto", async () => {
    await erro(movimentarEstoque(outra, lerMovimento({ produtoId: cabo, tipo: "perda", quantidade: 1, motivo: "x" })), 404);
  });
  test("importação cria com saldo inicial e atualiza sem mexer no saldo", async () => {
    const r = await importarProdutos(dono, [
      lerProduto({ codigo: "DJ-20", nome: "Disjuntor 20A", unidade: "un", precoVenda: 2500, estoqueMinimo: 2000, estoqueInicial: 5000 }),
      lerProduto({ codigo: "cab-25", nome: "Cabo 2,5mm flex", unidade: "m", precoVenda: 990, estoqueMinimo: 5000 }),
    ]);
    assert.deepEqual(r, { criados: 1, atualizados: 1 });
    const c = await saldo(cabo);
    assert.equal(c.nome, "Cabo 2,5mm flex");
    assert.equal(c.estoqueAtual, 100000);
    await salvarProduto(dono, prod({ id: cabo, nome: "Cabo 2,5mm", precoVenda: 890 })); // volta
  });
});

describe("orçamento", () => {
  test("numeração sequencial, total em centavos e estoque intacto (regra 1)", async () => {
    const a = await salvarOrcamento(vend, orc(cabo, 12500));
    const b = await salvarOrcamento(vend, orc(cabo, 1000));
    assert.equal(a.numero, "ORC-0001");
    assert.equal(b.numero, "ORC-0002");
    const o = (await db.doc(`orcamentos/${a.id}`).get()).data()!;
    assert.equal(o.total, 11125);
    assert.equal(o.status, "rascunho");
    assert.equal((await saldo(cabo)).estoqueAtual, 100000);
  });
  test("vendedor passa do limite de desconto => 403; dono pode", async () => {
    await erro(salvarOrcamento(vend, orc(cabo, 10000, { descontoGeral: 2000 })), 403); // 22%
    const ok = await salvarOrcamento(dono, orc(cabo, 10000, { descontoGeral: 2000 }));
    assert.ok(ok.id);
    await salvarOrcamento(vend, orc(cabo, 10000, { descontoGeral: 500 })); // 5,6%: passa
  });
  test("desconto maior que o item é recusado", async () => {
    await erro(
      salvarOrcamento(dono, lerOrcamento({ clienteId: "cli1", itens: [{ produtoId: cabo, quantidade: 1000, desconto: 99999 }] })),
      400,
    );
  });
  test("cliente ou produto de outra loja é recusado", async () => {
    await db.doc("clientes/clix").set({ lojaId: "loja2", nome: "X", criadoEm: Timestamp.now() });
    await erro(salvarOrcamento(dono, lerOrcamento({ clienteId: "clix", itens: [{ produtoId: cabo, quantidade: 1000 }] })), 400);
    await erro(salvarOrcamento(outra, orc(cabo, 1000)), 400);
  });
  test("preço copiado: mudar o produto não altera orçamento editado; duplicar usa preço novo (regras 5 e 6)", async () => {
    const a = await salvarOrcamento(dono, orc(cabo, 1000)); // 8,90
    await salvarProduto(dono, prod({ id: cabo, precoVenda: 1000 }));
    await salvarOrcamento(dono, { ...orc(cabo, 2000), id: a.id }); // edita: mantém 8,90
    assert.equal((await db.doc(`orcamentos/${a.id}`).get()).data()!.total, 1780);
    const d = await duplicarOrcamento(dono, a.id);
    assert.equal((await db.doc(`orcamentos/${d.id}`).get()).data()!.total, 2000); // 10,00 x 2
    await salvarProduto(dono, prod({ id: cabo, precoVenda: 890 }));
  });
  test("transições de status e orçamento vencido (regra 6)", async () => {
    const a = await salvarOrcamento(vend, orc(cabo, 1000));
    await mudarStatus(vend, a.id, "enviado");
    await erro(mudarStatus(vend, a.id, "rascunho"), 409);
    await mudarStatus(vend, a.id, "recusado");
    await erro(mudarStatus(vend, a.id, "aprovado"), 409);
    await erro(converterEmVenda(vend, a.id), 409); // recusado não vira venda

    const v = await salvarOrcamento(vend, orc(cabo, 1000));
    await db.doc(`orcamentos/${v.id}`).update({ validade: Timestamp.fromMillis(Date.now() - 1000) });
    await erro(mudarStatus(vend, v.id, "enviado"), 409);
    await erro(converterEmVenda(vend, v.id), 409);
    await erro(salvarOrcamento(vend, { ...orc(cabo, 1000), id: v.id }), 409);
    assert.ok((await duplicarOrcamento(vend, v.id)).id); // vencido pode ser duplicado
  });
  test("outra loja não enxerga o orçamento", async () => {
    const a = await salvarOrcamento(dono, orc(cabo, 1000));
    await erro(mudarStatus(outra, a.id, "enviado"), 404);
    await erro(converterEmVenda(outra, a.id), 404);
    await erro(duplicarOrcamento(outra, a.id), 404);
  });
});

describe("venda", () => {
  test("converter baixa estoque, grava movimentação e vincula (regra 2); duas vezes não", async () => {
    const o = await salvarOrcamento(vend, orc(cabo, 12500));
    const antes = (await saldo(cabo)).estoqueAtual;
    const v = await converterEmVenda(vend, o.id, "Pix");
    assert.match(v.numero, /^VEN-\d{4}$/);
    assert.equal((await saldo(cabo)).estoqueAtual, antes - 12500);
    const m = (await movs(cabo)).filter((x) => x.vendaId === v.vendaId);
    assert.equal(m.length, 1);
    assert.equal(m[0].tipo, "venda");
    assert.equal(m[0].quantidade, -12500);
    assert.equal(m[0].saldoApos, antes - 12500);
    const od = (await db.doc(`orcamentos/${o.id}`).get()).data()!;
    assert.equal(od.status, "aprovado");
    assert.equal(od.vendaId, v.vendaId);
    const itens = await db.collection(`vendas/${v.vendaId}/itens`).get();
    assert.equal(itens.size, 1);
    await erro(converterEmVenda(vend, o.id), 409);
    await erro(mudarStatus(vend, o.id, "recusado"), 409); // já virou venda
  });
  test("mesmo produto em 2 itens baixa o total certo", async () => {
    const o = await salvarOrcamento(vend, lerOrcamento({
      clienteId: "cli1",
      itens: [{ produtoId: cabo, quantidade: 1000 }, { produtoId: cabo, quantidade: 2000 }],
    }));
    const antes = (await saldo(cabo)).estoqueAtual;
    await converterEmVenda(vend, o.id);
    assert.equal((await saldo(cabo)).estoqueAtual, antes - 3000);
  });
  test("sem estoque: bloqueia; com permissão, fica negativo e avisa (regra 8)", async () => {
    const p = (await salvarProduto(dono, prod({ codigo: "RARO", nome: "Raro", unidade: "un", precoVenda: 100, estoqueMinimo: 0 }))).id;
    await movimentarEstoque(dono, lerMovimento({ produtoId: p, tipo: "entrada", quantidade: 1000, motivo: "x" }));
    const a = await salvarOrcamento(vend, orc(p, 3000));
    assert.equal(a.avisos[0].faltam, 2000);
    await erro(converterEmVenda(vend, a.id), 409);
    assert.equal((await saldo(p)).estoqueAtual, 1000);
    await db.doc(`lojas/${L}`).update({ permiteVendaSemEstoque: true });
    const v = await converterEmVenda(vend, a.id);
    assert.equal(v.negativos.length, 1);
    assert.equal((await saldo(p)).estoqueAtual, -2000);
    await db.doc(`lojas/${L}`).update({ permiteVendaSemEstoque: false });
  });
  test("duas vendas simultâneas da última unidade: só uma passa", async () => {
    const p = (await salvarProduto(dono, prod({ codigo: "ULT", nome: "Última", unidade: "un", precoVenda: 100, estoqueMinimo: 0 }))).id;
    await movimentarEstoque(dono, lerMovimento({ produtoId: p, tipo: "entrada", quantidade: 1000, motivo: "x" }));
    const [a, b] = await Promise.all([salvarOrcamento(vend, orc(p, 1000)), salvarOrcamento(vend, orc(p, 1000))]);
    const r = await Promise.allSettled([converterEmVenda(vend, a.id), converterEmVenda(vend, b.id)]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal((await saldo(p)).estoqueAtual, 0);
  });
  test("cancelar devolve o estoque com estorno, sem apagar nada (regra 3)", async () => {
    const o = await salvarOrcamento(vend, orc(cabo, 4000));
    const v = await converterEmVenda(vend, o.id);
    const meio = (await saldo(cabo)).estoqueAtual;
    await cancelarVenda(dono, v.vendaId, "Cliente desistiu");
    assert.equal((await saldo(cabo)).estoqueAtual, meio + 4000);
    const m = (await movs(cabo)).filter((x) => x.vendaId === v.vendaId).map((x) => x.tipo).sort();
    assert.deepEqual(m, ["estorno", "venda"]);
    assert.equal((await db.doc(`vendas/${v.vendaId}`).get()).data()!.status, "cancelada");
    assert.equal((await db.doc(`orcamentos/${o.id}`).get()).data()!.vendaId, undefined);
    await erro(cancelarVenda(dono, v.vendaId, "de novo"), 409);
    await erro(cancelarVenda(outra, v.vendaId, "x"), 404);
  });
});

describe("autenticação e usuários", () => {
  async function tokenDe(uid: string): Promise<string> {
    const custom = await adminAuth().createCustomToken(uid);
    const r = await fetch(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
    );
    return (await r.json()).idToken;
  }
  const req = (t?: string) => new Request("http://x/api", { headers: t ? { authorization: `Bearer ${t}` } : {} });

  before(async () => {
    await db.doc("usuarios/dono1").set({ lojaId: L, nome: "Dono", email: "d@x.com", perfil: "dono", ativo: true });
    await db.doc("usuarios/vend1").set({ lojaId: L, nome: "Vend", email: "v@x.com", perfil: "vendedor", ativo: true });
  });

  test("sem token, token lixo, vendedor em rota de dono, desativado", async () => {
    await erro(requireUser(req()), 401);
    await erro(requireUser(req("lixo")), 401);
    assert.equal((await requireUser(req(await tokenDe("dono1")), true)).perfil, "dono");
    await requireUser(req(await tokenDe("vend1")));
    await erro(requireUser(req(await tokenDe("vend1")), true), 403);
    await erro(requireUser(req(await tokenDe("sem-perfil"))), 403);
    await db.doc("usuarios/vend1").update({ ativo: false });
    await erro(requireUser(req(await tokenDe("vend1"))), 403);
    await db.doc("usuarios/vend1").update({ ativo: true });
  });
  test("dono cria vendedor; e-mail repetido e senha curta falham; não desativa a si", async () => {
    const { uid } = await criarUsuario(dono, { nome: "Maria", email: "maria@x.com", senha: "senha-boa-1", perfil: "vendedor" });
    assert.equal((await db.doc(`usuarios/${uid}`).get()).data()!.perfil, "vendedor");
    await erro(criarUsuario(dono, { nome: "M2", email: "maria@x.com", senha: "senha-boa-1", perfil: "vendedor" }), 409);
    await erro(criarUsuario(dono, { nome: "M3", email: "m3@x.com", senha: "curta", perfil: "vendedor" }), 400);
    await erro(definirAtivo(dono, dono.uid, false), 400);
    await definirAtivo(dono, uid, false);
    assert.equal((await db.doc(`usuarios/${uid}`).get()).data()!.ativo, false);
    await erro(definirAtivo(outra, uid, true), 404);
  });
});

describe("link do PDF", () => {
  test("assinatura válida, adulterada e vencida", () => {
    const u = new URL(linkPdf("http://x", "abc"));
    const exp = u.searchParams.get("exp");
    const sig = u.searchParams.get("sig");
    assert.equal(linkPdfValido("abc", exp, sig), true);
    assert.equal(linkPdfValido("outro", exp, sig), false); // id trocado
    assert.equal(linkPdfValido("abc", String(Number(exp) + 1), sig), false); // validade trocada
    assert.equal(linkPdfValido("abc", exp, null), false);
    assert.equal(linkPdfValido("abc", exp, sig, Number(exp) + 1), false); // vencido
  });
});
