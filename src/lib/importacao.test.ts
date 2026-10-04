import assert from "node:assert/strict";
import { test } from "node:test";
import { lerPlanilha } from "./importacao.ts";

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
