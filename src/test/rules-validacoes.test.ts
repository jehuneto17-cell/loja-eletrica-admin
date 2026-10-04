// Regras novas: logo (SSRF), tipos da loja, campos de cliente. Roda no emulador: npm run test:emu
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-rules-validacoes",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});
const dono = () => env.authenticatedContext("dono1").firestore();
const vend = () => env.authenticatedContext("vend1").firestore();

before(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "usuarios/dono1"), { lojaId: "L1", perfil: "dono", ativo: true, nome: "D" });
    await setDoc(doc(db, "usuarios/vend1"), { lojaId: "L1", perfil: "vendedor", ativo: true, nome: "V" });
    await setDoc(doc(db, "lojas/L1"), {
      nome: "A", ultimoNumeroOrcamento: 0, ultimoNumeroVenda: 0, validadePadraoDias: 15,
      descontoMaxVendedorPct: 10, permiteVendaSemEstoque: false,
    });
    await setDoc(doc(db, "clientes/c1"), { lojaId: "L1", nome: "João" });
  });
});
after(() => env.cleanup());

describe("loja", () => {
  test("logo: só https de Cloudinary/Firebase Storage (o servidor busca essa URL ao gerar o PDF)", async () => {
    await assertSucceeds(updateDoc(doc(dono(), "lojas/L1"), { logoUrl: "https://res.cloudinary.com/x/logo.png" }));
    await assertSucceeds(updateDoc(doc(dono(), "lojas/L1"), { logoUrl: "" }));
    for (const ruim of [
      "file:///etc/passwd",
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:8080/x",
      "https://evil.example.com/logo.png",
      "https://res.cloudinary.com.evil.com/x.png",
      "https://evil.com/?https://res.cloudinary.com/x",
    ]) {
      await assertFails(updateDoc(doc(dono(), "lojas/L1"), { logoUrl: ruim }));
    }
  });

  test("tipos e faixas dos campos de que o servidor depende", async () => {
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { validadePadraoDias: 0 }));
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { validadePadraoDias: 400 }));
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { validadePadraoDias: "15" }));
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { descontoMaxVendedorPct: "sem limite" }));
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { descontoMaxVendedorPct: 150 }));
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { permiteVendaSemEstoque: "sim" }));
    await assertFails(updateDoc(doc(dono(), "lojas/L1"), { nome: "" }));
    await assertSucceeds(updateDoc(doc(dono(), "lojas/L1"), { validadePadraoDias: 30, descontoMaxVendedorPct: 12.5 }));
  });
});

describe("cliente e travas", () => {
  test("só os campos conhecidos, com tamanho limitado", async () => {
    await assertFails(setDoc(doc(vend(), "clientes/x1"), { lojaId: "L1", nome: "Ok", admin: true }));
    await assertFails(setDoc(doc(vend(), "clientes/x2"), { lojaId: "L1", nome: "n".repeat(121) }));
    await assertFails(setDoc(doc(vend(), "clientes/x3"), { lojaId: "L1", nome: "Ok", observacoes: "o".repeat(501) }));
    await assertFails(updateDoc(doc(vend(), "clientes/c1"), { campoExtra: "x" }));
    await assertSucceeds(setDoc(doc(vend(), "clientes/x4"), { lojaId: "L1", nome: "Ok", telefone: "35 9999-0000" }));
  });

  test("travas de código não são acessíveis ao cliente", async () => {
    await assertFails(getDoc(doc(dono(), "codigos/L1__X")));
    await assertFails(setDoc(doc(dono(), "codigos/L1__X"), { produtoId: "p1" }));
  });
});
