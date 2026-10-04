import assert from "node:assert/strict";
import { test } from "node:test";
import { linkWhatsapp, telefoneWhatsapp } from "./whatsapp.ts";

test("telefone brasileiro", () => {
  assert.equal(telefoneWhatsapp("(35) 99999-0000"), "5535999990000");
  assert.equal(telefoneWhatsapp("35 3333-4444"), "553533334444");
  assert.equal(telefoneWhatsapp("+55 35 99999-0000"), "5535999990000");
  assert.equal(telefoneWhatsapp("123"), "");
  assert.equal(telefoneWhatsapp(undefined), "");
});

test("link com texto codificado e sem telefone", () => {
  assert.equal(linkWhatsapp("35999990000", "Olá & tchau"), "https://wa.me/5535999990000?text=Ol%C3%A1%20%26%20tchau");
  assert.equal(linkWhatsapp("", "x"), "https://wa.me/?text=x");
});
