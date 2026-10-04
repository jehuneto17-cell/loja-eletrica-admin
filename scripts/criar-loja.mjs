// Cria a loja e o primeiro usuário dono (não existe cadastro público).
//
//   CRIAR_LOJA_SENHA="senha-forte-1" node scripts/criar-loja.mjs --loja "Elétrica Silva" --nome "João" --email joao@loja.com [--demo]
// (a senha vai por variável de ambiente para não ficar no histórico do terminal; --senha também funciona)
//
// Produção: defina FIREBASE_SERVICE_ACCOUNT_JSON (e NEXT_PUBLIC_FIREBASE_PROJECT_ID).
// Emulador: defina FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST.
// --demo cria alguns produtos e um cliente de exemplo.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    loja: { type: "string" },
    nome: { type: "string" },
    email: { type: "string" },
    senha: { type: "string" },
    demo: { type: "boolean", default: false },
  },
});
a.senha ??= process.env.CRIAR_LOJA_SENHA;
for (const k of ["loja", "nome", "email", "senha"]) {
  if (!a[k]) {
    console.error(`Falta --${k}`);
    process.exit(1);
  }
}
if (a.senha.length < 8) {
  console.error("A senha precisa de pelo menos 8 caracteres");
  process.exit(1);
}

const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
initializeApp(json ? { credential: cert(JSON.parse(json)) } : { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore();

const lojaRef = db.collection("lojas").doc();
const { uid } = await getAuth().createUser({ email: a.email, password: a.senha, displayName: a.nome });
await lojaRef.set({
  nome: a.loja,
  validadePadraoDias: 15,
  descontoMaxVendedorPct: 10,
  permiteVendaSemEstoque: false, // confirmar com o dono
  ultimoNumeroOrcamento: 0,
  ultimoNumeroVenda: 0,
});
await db.doc(`usuarios/${uid}`).set({ lojaId: lojaRef.id, nome: a.nome, email: a.email, perfil: "dono", ativo: true });

if (a.demo) {
  const produtos = [
    ["CAB-25", "Cabo flexível 2,5mm", "Cabos", "m", 890, 50000, 300000],
    ["DJ-20", "Disjuntor monopolar 20A", "Disjuntores", "un", 2500, 5000, 40000],
    ["TOM-10", "Tomada 10A 2P+T", "Tomadas", "un", 1500, 10000, 8000], // já abaixo do mínimo
  ];
  for (const [codigo, nome, categoria, unidade, precoVenda, estoqueMinimo, estoqueAtual] of produtos) {
    const ref = db.collection("produtos").doc();
    await ref.set({
      lojaId: lojaRef.id, codigo, nome, categoria, unidade, precoVenda, estoqueMinimo, estoqueAtual,
      abaixoDoMinimo: estoqueMinimo > 0 && estoqueAtual <= estoqueMinimo, ativo: true,
    });
    await db.collection("movimentacoes").add({
      lojaId: lojaRef.id, produtoId: ref.id, tipo: "entrada", quantidade: estoqueAtual, saldoApos: estoqueAtual,
      motivo: "Saldo inicial (demo)", usuarioId: uid, criadoEm: Timestamp.now(),
    });
  }
  await db.collection("clientes").add({ lojaId: lojaRef.id, nome: "Maria Souza", telefone: "(35) 99999-0000", criadoEm: Timestamp.now() });
}
console.log(`Loja ${lojaRef.id} criada. Dono: ${a.email}`);
