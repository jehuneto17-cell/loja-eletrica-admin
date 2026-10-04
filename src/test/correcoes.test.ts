// Cobre as correções da revisão de código, da auditoria de segurança e do QA. Roda no emulador: npm run test:emu
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-loja";
process.env.PDF_LINK_SECRET = "segredo-de-teste-123456";

const { adminDb, Timestamp } = await import("../lib/server/admin.ts");
const { ApiError, handle } = await import("../lib/server/http.ts");
const { lerOrcamento, salvarOrcamento, mudarStatus, duplicarOrcamento } = await import("../lib/server/orcamentos.ts");
const { converterEmVenda, cancelarVenda } = await import("../lib/server/vendas.ts");
const { lerMovimento, movimentarEstoque } = await import("../lib/server/estoque.ts");
const { lerProduto, salvarProduto, importarProdutos } = await import("../lib/server/produtos.ts");
const { linkRevogado, TTL_MS } = await import("../lib/server/pdfLink.ts");

const db = adminDb();
const L = "loja-correcoes"; // loja própria: não mistura com dominio.test.ts
const dono = { uid: "dono-c", lojaId: L, perfil: "dono" as const, nome: "Dono" };
const vend = { uid: "vend-c", lojaId: L, perfil: "vendedor" as const, nome: "Vendedor" };

async function erro(p: Promise<unknown>, status: number) {
  await assert.rejects(p, (e: unknown) => e instanceof ApiError && e.status === status, `esperava ${status}`);
}
const prod = (extra: Record<string, unknown> = {}) =>
  lerProduto({ codigo: "CAB-25", nome: "Cabo 2,5mm", unidade: "m", precoVenda: 890, estoqueMinimo: 5000, ...extra });
const doc = async (path: string) => (await db.doc(path).get()).data()!;
const movs = async (id: string) =>
  (await db.collection("movimentacoes").where("produtoId", "==", id).get()).docs.map((d) => d.data());
const orc = (produtoId: string, quantidade: number, extra: Record<string, unknown> = {}) =>
  lerOrcamento({ clienteId: "cli-c", itens: [{ produtoId, quantidade }], ...extra });
const vendaSemEstoque = (v: boolean) => db.doc(`lojas/${L}`).update({ permiteVendaSemEstoque: v });

let cabo: string;
before(async () => {
  await db.doc(`lojas/${L}`).set({
    nome: "Loja Correções", validadePadraoDias: 15, descontoMaxVendedorPct: 10,
    permiteVendaSemEstoque: false, ultimoNumeroOrcamento: 0, ultimoNumeroVenda: 0,
  });
  await db.doc("clientes/cli-c").set({ lojaId: L, nome: "João", criadoEm: Timestamp.now() });
  cabo = (await salvarProduto(dono, prod({ estoqueInicial: 100000 }))).id;
});

describe("produtos", () => {
  test("3 cadastros simultâneos do mesmo código: só 1 produto", async () => {
    const r = await Promise.allSettled([1, 2, 3].map((n) => salvarProduto(dono, prod({ codigo: "CORRIDA-1", nome: `P${n}` }))));
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    const q = await db.collection("produtos").where("lojaId", "==", L).where("codigo", "==", "CORRIDA-1").get();
    assert.equal(q.size, 1);
  });

  test("produto novo com saldo inicial grava produto e movimentação juntos, com o nome de quem fez", async () => {
    const { id } = await salvarProduto(dono, prod({ codigo: "INI-1", nome: "Com saldo", estoqueInicial: 7000 }));
    assert.equal((await doc(`produtos/${id}`)).estoqueAtual, 7000);
    const m = await movs(id);
    assert.equal(m.length, 1);
    assert.equal(m[0].motivo, "Saldo inicial");
    assert.equal(m[0].usuarioNome, "Dono");
  });

  test("categoria e marca podem ser limpas na edição", async () => {
    const { id } = await salvarProduto(dono, prod({ codigo: "CAT-1", nome: "Cat", categoria: "Cabos", marca: "X" }));
    assert.equal((await doc(`produtos/${id}`)).categoria, "Cabos");
    await salvarProduto(dono, prod({ id, codigo: "CAT-1", nome: "Cat", categoria: "", marca: "" }));
    const p = await doc(`produtos/${id}`);
    assert.equal(p.categoria, undefined);
    assert.equal(p.marca, undefined);
  });

  test("trocar o código libera o antigo e trava o novo", async () => {
    const { id } = await salvarProduto(dono, prod({ codigo: "TROCA-A", nome: "Troca" }));
    await salvarProduto(dono, prod({ id, codigo: "TROCA-B", nome: "Troca" }));
    await salvarProduto(dono, prod({ codigo: "TROCA-A", nome: "Reusa o antigo" }));
    await erro(salvarProduto(dono, prod({ codigo: "TROCA-B", nome: "Duplicado" })), 409);
  });

  test("importação: não reativa produto inativo e é tudo ou nada", async () => {
    const id = (await salvarProduto(dono, prod({ codigo: "IMP-IN", nome: "Inativo", ativo: false }))).id;
    await importarProdutos(dono, [lerProduto({ codigo: "IMP-IN", nome: "Inativo v2", unidade: "m", precoVenda: 500, estoqueMinimo: 0 })]);
    assert.equal((await doc(`produtos/${id}`)).ativo, false);
    assert.equal((await doc(`produtos/${id}`)).nome, "Inativo v2");
    await erro(
      importarProdutos(dono, [
        lerProduto({ codigo: "IMP-NOVO", nome: "Novo", unidade: "m", precoVenda: 500 }),
        lerProduto({ codigo: "IMP-NOVO", nome: "Repetido", unidade: "m", precoVenda: 500 }),
      ]),
      400,
    );
    assert.equal((await db.collection("produtos").where("codigo", "==", "IMP-NOVO").get()).size, 0);
  });

  test("entrada malformada e valores absurdos são 400, não 500", () => {
    const e400 = (e: unknown) => e instanceof ApiError && e.status === 400;
    assert.throws(() => lerProduto(null), e400);
    assert.throws(() => lerProduto({ codigo: "X", nome: "Y", unidade: "m", precoVenda: 0 }), e400);
    assert.throws(() => lerProduto({ codigo: "X", nome: "Y", unidade: "m", precoVenda: 1e10 }), e400);
    assert.throws(() => lerProduto({ id: "a/b", codigo: "X", nome: "Y", unidade: "m", precoVenda: 100 }), e400);
  });
});

describe("estoque", () => {
  test("perda maior que o saldo é recusada; igual ao saldo passa", async () => {
    const { id } = await salvarProduto(dono, prod({ codigo: "PERDA-1", nome: "Perda", unidade: "un", estoqueInicial: 5000 }));
    await erro(movimentarEstoque(dono, lerMovimento({ produtoId: id, tipo: "perda", quantidade: 50000, motivo: "digitou 50" })), 409);
    assert.equal((await doc(`produtos/${id}`)).estoqueAtual, 5000);
    await movimentarEstoque(dono, lerMovimento({ produtoId: id, tipo: "perda", quantidade: 5000, motivo: "tudo" }));
    assert.equal((await doc(`produtos/${id}`)).estoqueAtual, 0);
  });

  test("saldo negativo entra no alerta mesmo com mínimo 0 (regra 8)", async () => {
    const { id } = await salvarProduto(dono, prod({ codigo: "NEG-1", nome: "Neg", unidade: "un", estoqueMinimo: 0, estoqueInicial: 1000 }));
    assert.equal((await doc(`produtos/${id}`)).abaixoDoMinimo, false);
    await vendaSemEstoque(true);
    const o = await salvarOrcamento(vend, orc(id, 3000));
    await converterEmVenda(vend, o.id);
    await vendaSemEstoque(false);
    const p = await doc(`produtos/${id}`);
    assert.equal(p.estoqueAtual, -2000);
    assert.equal(p.abaixoDoMinimo, true);
  });
});

describe("orçamento", () => {
  test("aprovado e vencido não converte (preço congelado); duplicar renova", async () => {
    const o = await salvarOrcamento(vend, orc(cabo, 1000));
    await mudarStatus(vend, o.id, "aprovado");
    await db.doc(`orcamentos/${o.id}`).update({ validade: Timestamp.fromMillis(Date.now() - 1000) });
    await erro(converterEmVenda(vend, o.id), 409);
    assert.ok((await duplicarOrcamento(vend, o.id)).id);
  });

  test("venda cancelada de orçamento vencido não volta a converter", async () => {
    const o = await salvarOrcamento(vend, orc(cabo, 1000));
    const v = await converterEmVenda(vend, o.id);
    await cancelarVenda(dono, v.vendaId, "teste");
    await db.doc(`orcamentos/${o.id}`).update({ validade: Timestamp.fromMillis(Date.now() - 1000) });
    await erro(converterEmVenda(vend, o.id), 409);
  });

  test("editar conta a validade desde a criação, não desde agora", async () => {
    const o = await salvarOrcamento(vend, orc(cabo, 1000));
    const criado = (await doc(`orcamentos/${o.id}`)).criadoEm.toMillis() - 20 * 86_400_000;
    await db.doc(`orcamentos/${o.id}`).update({ criadoEm: Timestamp.fromMillis(criado) });
    await salvarOrcamento(vend, { ...orc(cabo, 1000, { validadeDias: 30 }), id: o.id });
    const v = (await doc(`orcamentos/${o.id}`)).validade.toMillis();
    assert.ok(Math.abs(v - (criado + 30 * 86_400_000)) < 1000);
  });

  test("duplicar: preço que caiu limita o desconto; produto inativo é descartado", async () => {
    const a = (await salvarProduto(dono, prod({ codigo: "DUP-A", nome: "A", unidade: "un", precoVenda: 10000, estoqueInicial: 9000 }))).id;
    const b = (await salvarProduto(dono, prod({ codigo: "DUP-B", nome: "B", unidade: "un", precoVenda: 500, estoqueInicial: 9000 }))).id;
    const o = await salvarOrcamento(dono, lerOrcamento({
      clienteId: "cli-c",
      itens: [{ produtoId: a, quantidade: 1000, desconto: 2000 }, { produtoId: b, quantidade: 1000 }],
      descontoGeral: 300,
    }));
    await salvarProduto(dono, prod({ id: a, codigo: "DUP-A", nome: "A", unidade: "un", precoVenda: 1500 }));
    await salvarProduto(dono, prod({ id: b, codigo: "DUP-B", nome: "B", unidade: "un", precoVenda: 500, ativo: false }));
    const d = await duplicarOrcamento(dono, o.id);
    assert.equal(d.descartados, 1);
    // item A: R$ 15,00 com desconto limitado a R$ 15,00 = 0; desconto geral limitado ao subtotal (0)
    assert.equal((await doc(`orcamentos/${d.id}`)).total, 0);
  });

  test("itens saem na ordem digitada", async () => {
    const ids: string[] = [];
    for (const n of [1, 2, 3, 4]) ids.push((await salvarProduto(dono, prod({ codigo: `ORD-${n}`, nome: `Item ${n}`, unidade: "un" }))).id);
    const o = await salvarOrcamento(dono, lerOrcamento({
      clienteId: "cli-c",
      itens: [ids[3], ids[0], ids[2], ids[1]].map((p) => ({ produtoId: p, quantidade: 1000 })),
    }));
    const q = await db.collection(`orcamentos/${o.id}/itens`).orderBy("ordem").get();
    assert.deepEqual(q.docs.map((d) => d.data().descricao), ["Item 4", "Item 1", "Item 3", "Item 2"]);
  });

  test("editar mantém nome, unidade e preço copiados mesmo se o produto mudou", async () => {
    const p = (await salvarProduto(dono, prod({ codigo: "UN-1", nome: "Cabo antigo", unidade: "m", precoVenda: 100, estoqueInicial: 9000 }))).id;
    const o = await salvarOrcamento(dono, orc(p, 1000));
    await salvarProduto(dono, prod({ id: p, codigo: "UN-1", nome: "Cabo novo", unidade: "rolo", precoVenda: 9999 }));
    await salvarOrcamento(dono, { ...orc(p, 2000), id: o.id });
    const it = (await db.collection(`orcamentos/${o.id}/itens`).get()).docs[0].data();
    assert.deepEqual([it.descricao, it.unidade, it.precoUnitario], ["Cabo antigo", "m", 100]);
  });

  test("item de valor zero é 400", async () => {
    const p = (await salvarProduto(dono, prod({ codigo: "ZERO-1", nome: "Barato", unidade: "un", precoVenda: 1 }))).id;
    await erro(salvarOrcamento(dono, orc(p, 1)), 400); // 0,001 un x R$ 0,01 = R$ 0,00
  });

  test("entrada malformada e ids com barra são 400, não 500", async () => {
    const e400 = (e: unknown) => e instanceof ApiError && e.status === 400;
    assert.throws(() => lerOrcamento({ clienteId: "cli-c", itens: [null] }), e400);
    assert.throws(() => lerOrcamento({ clienteId: "a/b", itens: [{ produtoId: "x", quantidade: 1 }] }), e400);
    for (const id of ["a/b", "../x", "", "x".repeat(200)]) {
      await erro(converterEmVenda(vend, id), 400);
      await erro(mudarStatus(vend, id, "enviado"), 400);
      await erro(duplicarOrcamento(vend, id), 400);
      await erro(cancelarVenda(dono, id, "x"), 400);
    }
  });
});

describe("link do PDF", () => {
  test("editar e recusar revogam os links já enviados", async () => {
    const o = await salvarOrcamento(dono, orc(cabo, 1000));
    assert.equal((await doc(`orcamentos/${o.id}`)).linkRevogadoEm, undefined);
    await salvarOrcamento(dono, { ...orc(cabo, 2000), id: o.id });
    const rev1 = (await doc(`orcamentos/${o.id}`)).linkRevogadoEm;
    assert.ok(rev1 > 0);
    await mudarStatus(dono, o.id, "recusado");
    assert.ok((await doc(`orcamentos/${o.id}`)).linkRevogadoEm >= rev1);
  });

  test("link emitido antes da revogação não vale; depois, vale", () => {
    const agora = Date.now();
    const exp = agora + TTL_MS;
    assert.equal(linkRevogado(exp, undefined), false);
    assert.equal(linkRevogado(exp, agora - 1000), false);
    assert.equal(linkRevogado(exp, agora + 1000), true);
  });
});

describe("respostas de erro", () => {
  test("conflito de concorrência vira 409; erro desconhecido vira 500 sem vazar detalhe", async () => {
    const r1 = await handle(async () => { throw Object.assign(new Error("10 ABORTED: Too much contention"), { code: 10 }); });
    assert.equal(r1.status, 409);
    const log = console.error;
    console.error = () => {};
    const r2 = await handle(async () => { throw new Error("segredo interno"); });
    console.error = log;
    assert.equal(r2.status, 500);
    assert.equal((await r2.json()).erro, "Erro interno");
  });
});
