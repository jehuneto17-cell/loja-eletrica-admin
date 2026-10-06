import assert from "node:assert/strict";
import { test } from "node:test";
import { lerPlanilha, linhasDeMatriz } from "./importacao.ts";

test("cabeçalhos com acento e sinônimos; Excel em português", () => {
  const { linhas, faltando } = lerPlanilha([
    { "Código": "cab-25", Produto: "Cabo 2,5mm", Unidade: "M", "Preço": "R$ 8,90", "Estoque mínimo": "50", Saldo: "12,5" },
  ]);
  assert.deepEqual(faltando, []);
  assert.deepEqual(linhas[0].dados, {
    codigo: "CAB-25", nome: "Cabo 2,5mm", categoria: "", marca: "", unidade: "m",
    precoVenda: 890, estoqueMinimo: 50000, estoqueInicial: 12500, ativo: true,
  });
});

test("coluna obrigatória ausente", () => {
  assert.deepEqual(lerPlanilha([{ nome: "x", preco: "1" }]).faltando, ["codigo"]);
});

test("erros por linha, sem derrubar as boas", () => {
  const { linhas } = lerPlanilha([
    { codigo: "A", nome: "Ok", preco: "1,00", unidade: "" }, // Papa sempre devolve todas as colunas
    { codigo: "A", nome: "Repetido", preco: "1,00", unidade: "" },
    { codigo: "B", nome: "Preço ruim", preco: "abc", unidade: "" },
    { codigo: "C", nome: "Unidade ruim", preco: "1", unidade: "litro" },
    { codigo: "", nome: "Sem código", preco: "1" },
    { codigo: "", nome: "", preco: "" },
    { codigo: "D", nome: "Três casas no preço", preco: "1,005", unidade: "" },
    { codigo: "E", nome: "Preço zero", preco: "0", unidade: "" },
  ]);
  assert.ok(linhas[0].dados);
  assert.match(linhas[1].erro!, /repetido/);
  assert.match(linhas[2].erro!, /Preço/);
  assert.match(linhas[3].erro!, /Unidade/);
  assert.match(linhas[4].erro!, /código/);
  assert.equal(linhas[5].erro, "Linha vazia");
  assert.match(linhas[6].erro!, /Preço/);
  assert.match(linhas[7].erro!, /Preço/);
  assert.deepEqual(linhas.map((l) => l.linha), [2, 3, 4, 5, 6, 7, 8, 9]);
});

test("Excel: matriz vira linhas; número vira texto com vírgula", () => {
  const rows = linhasDeMatriz([
    ["Código", "Produto", "Preço", "Saldo", null],
    [221, "Cabo de cobre", 8.9, 1500, null],
    [null, null, null, null, null], // linha vazia no meio some
    ["DJ-20", "Disjuntor 20A", 25, 0.1 + 0.2, null],
  ]);
  assert.deepEqual(rows[0], { "Código": "221", Produto: "Cabo de cobre", "Preço": "8,9", Saldo: "1500", coluna5: "" });
  assert.equal(rows.length, 2);
  const { linhas } = lerPlanilha(rows);
  assert.equal(linhas[0].dados?.precoVenda, 890);
  assert.equal(linhas[0].dados?.estoqueInicial, 1500000);
  assert.equal(linhas[1].dados?.estoqueInicial, 300);
});

test("Excel: planilha só com cabeçalho ou vazia", () => {
  assert.deepEqual(linhasDeMatriz([["codigo", "nome", "preco"]]), []);
  assert.deepEqual(linhasDeMatriz([]), []);
});
