import assert from "node:assert/strict";
import { test } from "node:test";
import { bruto, parseMoeda, parseQuantidade, totaisDocumento, totalItem } from "./calc.ts";

test("parseMoeda", () => {
  assert.equal(parseMoeda("8,90"), 890);
  assert.equal(parseMoeda("R$ 1.234,56"), 123456);
  assert.equal(parseMoeda("8.9"), 890);
  assert.ok(Number.isNaN(parseMoeda("1.005"))); // sem vírgula o ponto é decimal: 3 casas, recusa
  assert.ok(Number.isNaN(parseMoeda("8,999"))); // não arredonda em silêncio
  assert.ok(Number.isNaN(parseMoeda("abc")));
  assert.ok(Number.isNaN(parseMoeda("-5")));
  assert.ok(Number.isNaN(parseMoeda("")));
});

test("parseQuantidade", () => {
  assert.equal(parseQuantidade("12,5"), 12500);
  assert.equal(parseQuantidade("3"), 3000);
  assert.equal(parseQuantidade("0,001"), 1);
  assert.ok(Number.isNaN(parseQuantidade("0,0001")));
  assert.ok(Number.isNaN(parseQuantidade("1.500"))); // ambíguo: 1,5 ou 1500
  assert.equal(parseQuantidade("1.500,5"), 1500500);
  assert.equal(parseQuantidade("1,500"), 1500);
  assert.equal(parseQuantidade("12.5"), 12500);
});

test("totais: 12,5 m a R$ 8,90 com desconto", () => {
  const item = { quantidade: 12500, precoUnitario: 890, desconto: 0 };
  assert.equal(bruto(item), 11125); // R$ 111,25
  const t = totaisDocumento(
    [item, { quantidade: 2000, precoUnitario: 1000, desconto: 500 }],
    1000,
  );
  assert.equal(totalItem({ quantidade: 2000, precoUnitario: 1000, desconto: 500 }), 1500);
  assert.equal(t.subtotal, 12625);
  assert.equal(t.total, 11625);
  // (500 + 1000) / (11125 + 2000) = 11,43%
  assert.ok(Math.abs(t.descontoPct - 11.428571) < 0.001);
});

test("documento vazio não divide por zero", () => {
  assert.deepEqual(totaisDocumento([], 0), { subtotal: 0, desconto: 0, total: 0, descontoPct: 0 });
});
