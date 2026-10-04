// Roda no emulador: npm run test:emu
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-rules",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const dono = () => env.authenticatedContext("dono1").firestore();
const vend = () => env.authenticatedContext("vend1").firestore();
const outro = () => env.authenticatedContext("dono2").firestore();
const anon = () => env.unauthenticatedContext().firestore();

before(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "usuarios/dono1"), { lojaId: "L1", perfil: "dono", ativo: true, nome: "D" });
    await setDoc(doc(db, "usuarios/vend1"), { lojaId: "L1", perfil: "vendedor", ativo: true, nome: "V" });
    await setDoc(doc(db, "usuarios/off1"), { lojaId: "L1", perfil: "vendedor", ativo: false, nome: "O" });
    await setDoc(doc(db, "usuarios/dono2"), { lojaId: "L2", perfil: "dono", ativo: true, nome: "D2" });
    await setDoc(doc(db, "lojas/L1"), { nome: "A", ultimoNumeroOrcamento: 0, ultimoNumeroVenda: 0, validadePadraoDias: 15, descontoMaxVendedorPct: 10, permiteVendaSemEstoque: false });
    await setDoc(doc(db, "produtos/p1"), { lojaId: "L1", nome: "Cabo", estoqueAtual: 1000, precoVenda: 890 });
    await setDoc(doc(db, "orcamentos/o1"), { lojaId: "L1", total: 100 });
    await setDoc(doc(db, "orcamentos/o1/itens/i1"), { produtoId: "p1" });
    await setDoc(doc(db, "vendas/v1"), { lojaId: "L1", total: 100 });
    await setDoc(doc(db, "movimentacoes/m1"), { lojaId: "L1", produtoId: "p1" });
    await setDoc(doc(db, "clientes/c1"), { lojaId: "L1", nome: "João" });
  });
});
after(() => env.cleanup());

describe("leitura", () => {
  test("anônimo não lê nada", async () => {
    await assertFails(getDoc(doc(anon(), "produtos/p1")));
    await assertFails(getDoc(doc(anon(), "lojas/L1")));
  });
  test("usuário desativado não lê", async () => {
    await assertFails(getDoc(doc(env.authenticatedContext("off1").firestore(), "produtos/p1")));
  });
  test("vendedor lê produtos, orçamentos (e itens), vendas, movimentações da própria loja", async () => {
    for (const p of ["produtos/p1", "orcamentos/o1", "orcamentos/o1/itens/i1", "vendas/v1", "movimentacoes/m1", "clientes/c1", "lojas/L1"]) {
      await assertSucceeds(getDoc(doc(vend(), p)));
    }
  });
  test("outra loja não lê nada", async () => {
    for (const p of ["produtos/p1", "orcamentos/o1", "orcamentos/o1/itens/i1", "vendas/v1", "movimentacoes/m1", "clientes/c1", "lojas/L1"]) {
      await assertFails(getDoc(doc(outro(), p)));
    }
  });
  test("query por lojaId da própria loja funciona; da alheia falha", async () => {
    await assertSucceeds(getDocs(query(collection(vend(), "produtos"), where("lojaId", "==", "L1"))));
    await assertFails(getDocs(query(collection(outro(), "produtos"), where("lojaId", "==", "L1"))));
  });
  test("usuários: vendedor só lê o próprio; dono lê os da loja; dono de outra loja não", async () => {
    await assertSucceeds(getDoc(doc(vend(), "usuarios/vend1")));
    await assertFails(getDoc(doc(vend(), "usuarios/dono1")));
    await assertSucceeds(getDoc(doc(dono(), "usuarios/vend1")));
    await assertFails(getDoc(doc(outro(), "usuarios/vend1")));
  });
});

describe("escrita: o cliente nunca mexe em estoque, preço, venda, status ou perfil", () => {
  test("produto: nem o dono escreve (vai pela API)", async () => {
    await assertFails(updateDoc(doc(dono(), "produtos/p1"), { estoqueAtual: 99999 }));
    await assertFails(updateDoc(doc(dono(), "produtos/p1"), { precoVenda: 1 }));
    await assertFails(setDoc(doc(dono(), "produtos/novo"), { lojaId: "L1", nome: "x" }));
  });
  test("orçamento, venda, movimentação, usuário: ninguém escreve", async () => {
    await assertFails(updateDoc(doc(dono(), "orcamentos/o1"), { total: 1 }));
    await assertFails(setDoc(doc(dono(), "orcamentos/o2"), { lojaId: "L1" }));
    await assertFails(updateDoc(doc(dono(), "vendas/v1"), { status: "cancelada" }));
    await assertFails(addDoc(collection(dono(), "movimentacoes"), { lojaId: "L1" }));
    await assertFails(updateDoc(doc(vend(), "usuarios/vend1"), { perfil: "dono" }));
    await assertFails(updateDoc(doc(dono(), "usuarios/vend1"), { perfil: "dono" }));
  });
  test("loja: dono edita dados, não os contadores; vendedor não edita", async () => {
    await assertSucceeds(updateDoc(doc(dono(), "lojas/L1"), { nome: "Nova", validadePadraoDias: 7 }));
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { ultimoNumeroOrcamento: 50 }));
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { ultimoNumeroVenda: 50 }));
    await assertFails(updateDoc(doc(vend(), "lojas/L1"), { nome: "Hack" }));
    await assertFails(updateDoc(doc(outro(), "lojas/L1"), { nome: "Hack" }));
  });
  test("cliente: cria e edita na própria loja; não troca de loja nem escreve na alheia", async () => {
    await assertSucceeds(setDoc(doc(vend(), "clientes/c2"), { lojaId: "L1", nome: "Maria" }));
    await assertSucceeds(updateDoc(doc(vend(), "clientes/c2"), { telefone: "35999990000" }));
    await assertFails(updateDoc(doc(vend(), "clientes/c2"), { lojaId: "L2" }));
    await assertFails(setDoc(doc(vend(), "clientes/c3"), { lojaId: "L2", nome: "X" }));
    await assertFails(setDoc(doc(vend(), "clientes/c4"), { lojaId: "L1", nome: "" }));
    await assertFails(updateDoc(doc(outro(), "clientes/c1"), { nome: "Hack" }));
    await assertFails(setDoc(doc(anon(), "clientes/c5"), { lojaId: "L1", nome: "X" }));
  });
});
