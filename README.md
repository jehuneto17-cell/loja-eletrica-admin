# Orçamentos e Estoque — loja de elétrica

Web app (PWA) para montar orçamentos, converter em venda e controlar estoque.
Fluxo: **orçamento → venda → baixa de estoque**. Especificação: `MVP — Sistema de Orçamentos e Estoque para Loja de Elétrica.md`.

Stack: Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · Firebase (Auth + Firestore) · `firebase-admin` nas rotas `/api` · `@react-pdf/renderer`. Visual baseado no Dash UI (Figma).

## Como o dinheiro e o estoque são protegidos

- Valores em **centavos** e quantidades em **milésimos** (inteiros). `src/lib/calc.ts`.
- O navegador **só lê** o Firestore e só escreve `clientes` e os dados da loja. Produtos, estoque, orçamentos, vendas, movimentações e usuários são escritos **só pelo servidor** (`src/lib/server/*`, rotas `src/app/api/*`), em transação. Regras em `firestore.rules`.
- Toda rota `/api` confere o token (`firebase-admin`), o usuário ativo e o perfil (dono/vendedor) antes de agir (`src/lib/server/http.ts`).

## Rodar local (com emuladores, sem tocar em produção)

```powershell
npm install
firebase emulators:start --only firestore,auth --project demo-loja   # terminal 1
# terminal 2 (com FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 e FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 definidos):
node scripts/criar-loja.mjs --loja "Elétrica Teste" --nome "Dono" --email dono@teste.com --senha "senha12345" --demo
npm run dev                                                          # usa .env.local (emulador)
```

## Testes

```powershell
npm test          # unidade: cálculo, importação, WhatsApp
npm run test:emu  # emulador: regras de negócio, concorrência, permissões, regras do Firestore
npx tsc --noEmit; npx eslint src; npx next build
```

`docs/QA-PLAN.md` tem o plano de QA e a evidência dos testes por HTTP (feitos pelo agente de QA da Fábrica), com o status das correções no final.

## Publicar (Vercel + Firebase)

1. Criar o projeto Firebase (Auth por e-mail/senha ligado, Firestore) e o repositório Git do app. Esta pasta é um repositório próprio.
2. Variáveis na Vercel — `NEXT_PUBLIC_FIREBASE_*` como **Config**; `FIREBASE_SERVICE_ACCOUNT_JSON` e `PDF_LINK_SECRET` (32+ caracteres aleatórios) como **Secret**.
   **Nunca** cadastrar `NEXT_PUBLIC_USE_EMULATOR`, `FIRESTORE_EMULATOR_HOST` ou `FIREBASE_AUTH_EMULATOR_HOST` (o login passaria a aceitar token falso).
3. `firebase deploy --only firestore:rules,firestore:indexes` (projeto novo não tem nada publicado).
4. Criar a loja e o dono: `FIREBASE_SERVICE_ACCOUNT_JSON=… CRIAR_LOJA_SENHA=… node scripts/criar-loja.mjs --loja "…" --nome "…" --email …`. Não existe cadastro público; os vendedores o dono cadastra em Configurações.
5. Logo da loja: em Configurações, escolha a foto (PNG/JPG). Ela é reduzida no navegador (até 500 px) e guardada na própria loja; o PDF usa direto, sem buscar nada na rede. Links antigos do Cloudinary/Firebase Storage continuam valendo. Também em Configurações, a **marca d'água** (escudo ou símbolo) vira uma imagem bem clara no fundo de cada página do PDF (PNG/JPG até 250 KB, só foto enviada, sem link).

## Produção (já publicada)

- Site: https://loja-eletrica-admin.vercel.app (Vercel, projeto `loja-eletrica-admin`, deploy automático a cada push na `main`).
- Firebase: projeto `loja-eletrica-orcamentos` (Firestore em São Paulo, plano Spark). Login por e-mail e senha; cadastro público desligado.
- Variáveis na Vercel (Production): `NEXT_PUBLIC_FIREBASE_*` (Config), `PDF_LINK_SECRET` e `FIREBASE_SERVICE_ACCOUNT_JSON` (Secret).
  Ao recadastrar a chave de serviço, envie o **arquivo cru** (`cmd /c "vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production --sensitive < chave.json"`). Pelo pipe do PowerShell o texto é recodificado e o servidor passa a recusar tudo.
- **Não remover** o `engines.node = 24.x` nem o `overrides.jose = 4.15.9` do `package.json`: o `firebase-admin` puxa o `jwks-rsa` 4, que exige o `jose` 6 (só ESM) e quebra na Vercel com `ERR_REQUIRE_ESM`. Antes de tirar o override, teste com um token real em produção.
- Criar usuário dono de uma loja: `node scripts/criar-loja.mjs --loja "…" --nome "…" --email …` (reaproveita um usuário já criado no console do Firebase).

## Decisões que dependem do dono da loja

- **Vender sem estoque:** hoje bloqueia (`permiteVendaSemEstoque: false`). Dá para liberar em Configurações; o saldo fica negativo e aparece em destaque.
- **Limite de desconto do vendedor:** 10% **do total do orçamento** (não por item). Confirmar se é isso.
- **Orçamento aprovado também vence** (não converte depois da validade, para não vender com preço antigo). Duplicar renova com os preços de hoje.
- **Só o dono** cadastra produto, movimenta estoque e cancela venda (spec, regra 9).
- Formas de pagamento mostradas no orçamento, validade padrão (hoje 15 dias) e se precisa nota fiscal: perguntas do MD ainda abertas.

## Limites conhecidos

- Busca de produto/cliente carrega até 3000 registros e filtra no navegador. Passou disso, trocar por busca no servidor.
- Importação lê **CSV** (no Excel: Salvar como → CSV), até 100 linhas por envio (a tela divide sozinha). Quantidade com ponto e sem vírgula ("1.500") é recusada por ser ambígua.
- Link de PDF vale 7 dias e deixa de valer se o orçamento for editado ou recusado.
- Não há envio automático de WhatsApp (API oficial): a tela abre o `wa.me` com o texto e o link do PDF.
- Falta testar em aparelho real (Android, internet lenta, PWA instalada) e rodar Lighthouse em produção.
