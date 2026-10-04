# QA-PLAN — Loja Elétrica Admin (orçamentos -> venda -> baixa de estoque)

- **Projeto:** loja-eletrica-admin (Next.js + Firebase, PWA)
- **Última atualização:** 2026-10-04
- **Status:** plano completo; execução PARCIAL (camada HTTP/API e regras do Firestore contra o emulador). Telas, visual, Android e Lighthouse NÃO foram executados.
- **Especificação testada:** `MVP — Sistema de Orçamentos e Estoque para Loja de Elétrica.md` (10 regras de negócio)
- **Código lido:** `src/app/api/**` e `src/lib/server/**` (mais `calc.ts`, `status.ts`, `importacao.ts`, `firestore.rules`, `pdf.tsx`). Nenhum arquivo de código foi alterado.

## 1. Veredito (leia primeiro)

| Item | Resultado |
|---|---|
| Casos executados | 107 |
| PASSOU | 80 |
| FALHOU | 25 (7 deles são P0) |
| Observação / inconclusivo | 2 |
| Bugs críticos ou altos | **Nenhum encontrado** nos fluxos testados |
| Bugs médios | 4 (BUG-02, 03, 04, 05) |
| Bugs baixos | 6 |
| Gate 8 (QA) | **NÃO APROVADO ainda.** Há P0 com FALHOU, e faltam Android real, internet ruim, telas e Lighthouse |

**O que está sólido (testado com evidência):** regras 1, 2, 3, 5, 6 (parcial), 7, 9 e 10. A baixa de estoque é atômica, não duplica em duplo clique (até 10 requisições simultâneas), a última unidade nunca é vendida duas vezes, o cancelamento estorna exatamente uma vez, o preço copiado não muda, a numeração não repete nem tem buracos em 118 orçamentos e 70 vendas, e o isolamento entre lojas e as regras do Firestore seguraram todos os ataques testados. A auditoria global ao final (AUD-01 a AUD-05) fechou: saldo de todos os 19 produtos = soma das movimentações (230 movimentos), venda = orçamento = soma dos itens, vínculos coerentes.

**O que falhou (resumo):**
1. Dois cadastros simultâneos do mesmo código criam **produto duplicado** (cadastro e importação), e o segundo duplicado não pode mais ser editado (BUG-02, P0).
2. Quando duas operações brigam pelo mesmo documento, o servidor responde **500 "Erro interno"** em vez de 409/"tente de novo" (BUG-03, P0). A integridade dos dados se manteve em todos os casos.
3. **Perda manual maior que o saldo** deixa o estoque negativo sem aviso (BUG-04, P0).
4. Planilha: estoque `1.500` entra como 1,5 (BUG-05).
5. Várias rotas devolvem 500 com id contendo `/` ou item `null` (BUG-01).

## 2. Como foi testado

| Item | Detalhe |
|---|---|
| Alvo | `http://localhost:3100` (dev) + emulador Firestore `127.0.0.1:8080` e Auth `127.0.0.1:9099`, projeto `demo-loja` |
| Ferramenta | Scripts Node (`fetch`) em diretório temporário do sistema, fora do projeto: `C:\Users\jehun\AppData\Local\Temp\claude\C--Users-jehun\245e5db6-a32a-4d27-b478-3970e0ea5260\scratchpad\qa\` (`s1_setup.mjs` ... `s11.mjs`, `results.jsonl` com todas as respostas) |
| Navegador | Não usado (outra sessão o ocupava). Nada visual foi verificado. |
| Autorização | ID token do emulador Auth, header `Authorization: Bearer` |
| Leitura de saldos | Firestore REST com o token do usuário (regras valem) e, para consultas que as regras barram, com o bypass administrativo do emulador |
| Escritas fora da API | Só no emulador: (a) criar a loja "qaloja2" e seu dono para provar isolamento; (b) retroagir a `validade` de orçamentos para simular vencimento (a API não deixa criar vencido); (c) o dono alterar campos da loja pelas próprias regras (limite de desconto, permite venda sem estoque, validade padrão), sempre restaurados |
| Segredo | `PDF_LINK_SECRET` lido do `.env.local` só para assinar links de teste vencidos; não foi impresso |
| Testes existentes | `src/test/dominio.test.ts` e `rules.test.ts` NÃO foram repetidos; os cenários abaixo são novos, via HTTP |

**Usuários de teste criados (somente emulador):** `vendedor.qa@teste.com` (vendedor), `dono2.qa@teste.com` (dono, **ficou desativado** pelo AUT-12), `outra.loja@teste.com` (dono da loja "qaloja2"). Senha de todos: `senha12345`.

**Dados deixados no emulador:** produtos `QA-*` (desativados, exceto o duplicado `QA-IMPRACE1081` que não pôde ser desativado, ver BUG-02), ~118 orçamentos e ~70 vendas de teste na loja do dono, cliente "Cliente QA", loja "qaloja2". Configurações da loja foram restauradas (validade 15, limite 10%, não permite vender sem estoque, sem logo). Os produtos e a venda VEN-0001 do seed não foram tocados.

## 3. Bloco "pagamento"

O sistema **não processa pagamento** (sem gateway, sem webhook, sem comprovante; "forma de pagamento" é só texto). O bloco equivalente e obrigatório aqui é **dinheiro e estoque** da venda. Itens do checklist da fábrica:

| Pergunta | Aplicável? | Caso |
|---|---|---|
| Valor da venda = valor do pedido (com desconto) | Sim | AUD-03, EST-01, EST-13: venda.total = orçamento.total = soma dos itens - desconto, em 70 vendas |
| Status muda uma vez só | Sim | EST-02, EST-03, EST-03b: duplo clique e 2/3/5/10 cliques simultâneos => 1 venda |
| Duplicidade não gera dois pedidos nem baixa dupla | Sim | EST-03, EST-03b, EST-10 (cancelar 2x; ver BUG-03 para as respostas 500), RACE-01 (converter x recusar) |
| Estoque baixa só na confirmação e volta no cancelamento | Sim | R1-01 (orçamento nunca baixa), EST-01, EST-08, EST-11 |
| Dois comprando a última unidade | Sim | EST-04, EST-05 |
| Pagamento parcial / valor errado / cupom / frete / acréscimo de cartão | Não existe | n/a |
| App fechado no meio do pagamento | Não existe pagamento online | n/a (ver MAN-12 para a conversão interrompida) |
| Admin confirma manualmente algo já confirmado | Equivalente: converter orçamento que já virou venda | EST-02 |

## 4. Regras de negócio x casos

| Regra | Casos que cobrem | Situação |
|---|---|---|
| 1. Orçamento não baixa estoque, só avisa | R1-01, EST-06, EST-07b | PASSOU |
| 2. Converter baixa e grava movimentação "venda" | EST-01, EST-03/03b, EST-15, AUD-01/03 | PASSOU |
| 3. Cancelar estorna, nada é apagado | EST-08, EST-10 (ver BUG-03), EST-11, AUD-03 | PASSOU (respostas 500 em duplo clique, BUG-03) |
| 4. Ajuste/perda exigem motivo, com usuário e horário | MOV-01, MOV-02 | PASSOU (ver BUG-04: perda maior que saldo) |
| 5. Preço copiado no orçamento | EST-13 | PASSOU |
| 6. Vencido vira expirado, pode duplicar | EXP-01, EXP-03, EXP-04 | PASSOU; EXP-02 FALHOU (aprovado nunca vence, decisão pendente, BUG-08) |
| 7. Numeração sequencial por loja | EST-05, EST-16, AUD-04 | PASSOU |
| 8. Vender sem estoque: permitido com aviso | EST-06 (bloqueia), EST-07 (permite, negativo), EST-07b | PASSOU |
| 9. Vendedor não altera preço nem faz ajuste | AUT-03, AUT-04, TEN-03 | PASSOU |
| 10. Desconto acima do limite exige dono | DSC-01 a DSC-06 | PASSOU (ver BUG-09: limite gravado como texto vira "sem limite") |

## 5. Bugs encontrados

Gravidade: **Média** = pode causar prejuízo ou retrabalho em uso normal; **Baixa** = só em entrada incomum ou visual. Nenhum crítico/alto.

| # | Gravidade | Resumo | Casos |
|---|---|---|---|
| BUG-02 | Média (P0) | Código de produto duplicado por duplo clique (cadastro e importação) | PRD-06, IMP-05 |
| BUG-03 | Média (P0) | Contenção entre operações vira HTTP 500 "Erro interno" | EST-10, RACE-02b, RACE-03 |
| BUG-04 | Média (P0) | Perda/baixa manual maior que o saldo deixa estoque negativo sem aviso | MOV-05 |
| BUG-05 | Média | Estoque "1.500" da planilha vira 1,5 em silêncio | CSV-05 |
| BUG-01 | Baixa | 500 com id contendo `/` e item/linha `null`; status "constructor" dá 409 | ORC-02, ORC-05, STA-02, EST-09, EST-17b, EST-17c, PDF-06, PDF-07, MOV-03, PRD-03, IMP-03 |
| BUG-06 | Baixa (P0 por tocar dinheiro) | Item de R$ 0,00 e preço sem mínimo/teto aceitos | QTD-03, PRD-05 |
| BUG-07 | Baixa (visual) | Itens do PDF aparecem fora da ordem digitada | PDF-03 |
| BUG-08 | Baixa (decisão) | Orçamento "aprovado" nunca expira; venda cancelada pode ser refeita com preços antigos | EXP-02, EST-12 |
| BUG-09 | Baixa | Regras do Firestore não validam a loja: validade 0 dá 500; limite de desconto como texto vira "sem limite" | CFG-01, CFG-02 |
| BUG-10 | Baixa | Conferência da planilha não valida tamanhos; o servidor recusa o lote inteiro | CSV-07 |

### Passos para reproduzir

Todos via HTTP com token de dono (`T`), `P` = id de um produto, `C` = id de um cliente.

**BUG-02 (Média, P0)** Duplicata de código por corrida.
1. Disparar 3 vezes ao mesmo tempo `POST /api/produtos` com `{"codigo":"X1","nome":"a","unidade":"un","precoVenda":100,"estoqueMinimo":0}`.
2. Obtido: respostas `[200,409,200]`, 2 produtos com código X1 (PRD-06). Mesmo com 2 `POST /api/produtos/importar` simultâneos do mesmo código novo: `[200,200]`, 2 produtos (IMP-05).
3. Esperado: 1 criado, os outros 409. Efeito colateral: tentar editar/desativar o 2º duplicado devolve 409 "Já existe um produto com o código" (só trocando o código dá para sair). Causa: `idPorCodigo()` roda fora da transação em `produtos.ts` (`salvarProduto` e `importarProdutos`). Sugestão: usar o código como chave do documento (`produtos/{lojaId}_{codigo}`) ou um documento-trava dentro da transação.

**BUG-03 (Média, P0)** Contenção vira 500.
1. Criar orçamento, converter (`POST /api/orcamentos/{id}/converter`), e disparar 3x ao mesmo tempo `POST /api/vendas/{vendaId}/cancelar` com `{"motivo":"x"}`.
2. Obtido em parte das rajadas: `[200,500,500]` ou `[500,409,200]` (3 rajadas em ~19). Esperado sempre `[200,409,409]`.
3. Também: `POST /api/orcamentos` (editar rascunho, 5 un) e `POST .../converter` ao mesmo tempo no mesmo rascunho: a conversão deu 500 em 4 de 8 rodadas (RACE-02b). 5 vendas + 5 perdas manuais simultâneas do mesmo produto: 1 de 10 deu 500 (RACE-03).
4. Integridade preservada em todos (nenhuma baixa dupla, venda sempre igual ao orçamento). Ressalva: observado no emulador; na nuvem o comportamento de abort pode variar. O código não trata o abort da transação (`handle()` converte tudo que não é `ApiError` em 500). Sugestão: reconhecer `ABORTED`/contenção e responder 409 "Tente de novo" (ou repetir 1x no servidor), e desabilitar o botão durante o envio na tela.

**BUG-04 (Média, P0)** Perda maior que o saldo.
1. Produto com 5 m em estoque. `POST /api/estoque` `{"produtoId":P,"tipo":"perda","quantidade":50000,"motivo":"erro de digitação"}`.
2. Obtido: HTTP 200 `{"saldoApos":-45000}`. Esperado: 400 "Perda maior que o saldo" (a regra 8 só admite saldo negativo vindo de venda com permissão). Um zero a mais na digitação corrompe o estoque.

**BUG-05 (Média)** Milhar em planilha.
1. CSV `codigo;nome;preco;estoque` com linha `A1;Parafuso;0,10;1.500`.
2. Obtido na conferência: estoque inicial 1,5 un (sem erro). Esperado: 1500 (padrão BR) ou erro de ambiguidade. `1,500` também vira 1,5; `1500` vira 1500. Erro de 1000x no saldo inicial, e a tela mostra o valor, mas ninguém confere 300 linhas. Causa: `parseDecimal` em `calc.ts` trata ponto sem vírgula como decimal.

**BUG-01 (Baixa)** 500 em entradas malformadas.
1. `POST /api/orcamentos` `{"clienteId":C,"itens":[null]}` => 500 (item string devolve 400 corretamente).
2. `POST /api/orcamentos/a%2Fb/converter` (e `/status`, `/duplicar`, `/link`, `/api/vendas/a%2Fb/cancelar`, `/api/pdf/a%2Fb?exp&sig` assinado) => 500; `POST /api/estoque` com `produtoId:"a/b"`; `POST /api/produtos` com `id:"a/b"`; `produtoId`/`clienteId` com `/` em orçamento; `POST /api/produtos/importar` `{"linhas":[null]}` => 500.
3. Esperado 400/404. Sem risco de dados (nenhuma gravação ocorreu), mas o log enche de erro e o usuário vê "Erro interno". Também `status:"constructor"` ou `"__proto__"` dá 409 em vez de 400 (`status in PROXIMOS_STATUS` pega chaves herdadas).

**BUG-06 (Baixa)** Valores sem mínimo/teto.
1. Produto "Fita" R$ 1,00/rolo. Orçamento com 0,001 rolo (`quantidade:1`): item e total = R$ 0,00, aceito sem aviso (`bruto` arredonda 0,1 centavo para 0). Produto com `precoVenda:0` e com `precoVenda:1000000000000` (R$ 10 bilhões): ambos aceitos.

**BUG-07 (Baixa, visual)** Ordem dos itens.
1. Orçamento com itens digitados Fita, Cabo, Tomada, Disjuntor. Ler `orcamentos/{id}/itens` (como `gerarPdf` faz, sem `orderBy`): vem Tomada, Cabo, Disjuntor, Fita (ordem por id aleatório). O PDF que vai ao cliente final sai nessa ordem. Sugestão: gravar um campo `ordem` no item e ordenar. (Telas de detalhe não foram verificadas.)

**BUG-08 (Baixa, decisão com o dono)**
1. Orçamento aprovado, sem venda, com validade vencida há 2 dias: `POST .../converter` => 200 (a regra 6 só expira rascunho e enviado).
2. Venda cancelada: o orçamento continua "aprovado" (sem `vendaId`) e `POST .../converter` gera nova venda com os preços antigos, sem aviso (EST-12).

**BUG-09 (Baixa)** Regras sem validação de tipo/faixa.
1. Dono grava `lojas/{id}.validadePadraoDias = 0` direto no Firestore (a tela barra, as regras deixam): todo `POST /api/orcamentos` novo vira 500 (`dias` falsy cai em `antigo!.validade`).
2. Dono grava `descontoMaxVendedorPct = "abc"`: vendedor salva orçamento com 90% de desconto (HTTP 200) porque `x > "abc"` é falso. Só o dono consegue gravar isso, e a tela valida, então o risco é baixo. Sugestão: validar tipo e faixa na regra.

**BUG-10 (Baixa)** Conferência x servidor.
1. Planilha com nome de 500 caracteres: a conferência marca a linha como válida; ao importar, o servidor recusa o lote inteiro (até 150 linhas) com "Nome inválido". Vale também para código > 40 e categoria/marca > 60.

## 6. Observações e decisões a confirmar com o dono

| # | Observação |
|---|---|
| OBS-1 | Só o dono cancela venda (o código diz; a especificação não restringe). Vendedor recebe 403. |
| OBS-2 | Vendedor pode editar, converter e duplicar orçamento criado por outro usuário (inclusive do dono). A especificação não diz. |
| OBS-3 | Orçamento pode ir de rascunho direto para "aprovado" sem venda (não toca no estoque). |
| OBS-4 | Usuário bloqueado: a conta continua existindo no Firebase Auth e consegue logar, mas toda rota `/api` e toda leitura do Firestore passam a negar (AUT-05). Está correto; só vale saber. |
| OBS-5 | AUT-11: o emulador do Auth aceita token sem assinatura (comportamento de emulador). **Antes de publicar, garantir que `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST` e `NEXT_PUBLIC_USE_EMULATOR` não existam na Vercel**, senão o servidor aceitaria token forjado. |
| OBS-6 | "Venda direta no balcão" é, na tela, salvar orçamento + converter em duas chamadas seguidas (`FormOrcamento.tsx`). Se a segunda falhar (ex.: sem estoque), fica um orçamento rascunho. Aceitável, mas não verificado na tela. |
| OBS-7 | Concorrência acima testada: até 10 requisições simultâneas, num emulador. Uma loja com 1 a 3 usuários dificilmente chega nisso; o risco prático dos 500 é o duplo clique. |

## 7. Casos manuais e visuais (NÃO executados)

Todos exigem navegador ou aparelho. Não foram executados porque o navegador estava em uso por outra sessão e não há Android real nem emulador de aparelho disponível nesta sessão. Escritos para uma pessoa comum com o celular na mão.

| ID | Fluxo | Passos | Resultado esperado | Prio | Status |
|---|---|---|---|---|---|
| MAN-01 | Login | Abrir o app, entrar com e-mail e senha corretos; depois com senha errada | Entra no painel; senha errada mostra mensagem clara e não entra | P1 | NÃO EXECUTADO (sem navegador) |
| MAN-02 | Novo orçamento | Escolher cliente, adicionar cabo 12,5 m e 2 tomadas, dar desconto, ver total | Total na tela = total salvo; decimal com vírgula aceito; desconto acima do limite (vendedor) mostra aviso antes de salvar | P0 | NÃO EXECUTADO (a API foi testada, a tela não) |
| MAN-03 | Aviso de falta | Orçamento com quantidade maior que o saldo | Aviso "falta X" em destaque; salvar continua permitido | P0 | NÃO EXECUTADO |
| MAN-04 | Converter em venda | Abrir orçamento aprovado e tocar "Converter em venda", tocando 2 vezes rápido | Uma venda só; saldo baixa uma vez; botão fica ocupado | P0 | NÃO EXECUTADO (duplo clique no servidor: PASSOU) |
| MAN-05 | Venda sem estoque | Com "permitir vender sem estoque" ligado e desligado, converter orçamento que falta item | Desligado: bloqueia com mensagem; ligado: vende e saldo fica negativo em destaque | P0 | NÃO EXECUTADO (servidor: PASSOU) |
| MAN-06 | Cancelar venda | Como dono, cancelar venda informando motivo; como vendedor, procurar o botão | Dono: estoque volta, venda aparece cancelada; vendedor não vê/não consegue | P0 | NÃO EXECUTADO (servidor: PASSOU) |
| MAN-07 | PDF e WhatsApp | Gerar PDF e tocar "Enviar no WhatsApp" | PDF com logo, dados da loja e totais; abre wa.me com o link e o telefone do cliente | P1 | NÃO EXECUTADO (link assinado: PASSOU; visual e wa.me não) |
| MAN-08 | Importar planilha | Subir o CSV de erros (ver CSV-01), conferir e importar | Tabela mostra cada erro na linha certa; só as válidas entram; resumo "X criados, Y atualizados" | P1 | NÃO EXECUTADO (lógica: PASSOU) |
| MAN-09 | Estoque baixo | Produto abaixo do mínimo | Aparece no painel e na lista com alerta | P1 | NÃO EXECUTADO |
| MAN-10 | Movimentar estoque | Entrada, perda e ajuste na tela, com e sem motivo | Sem motivo não salva; histórico mostra quem, quando, quanto, por quê | P0 | NÃO EXECUTADO |
| MAN-11 | Usuário bloqueado | Dono bloqueia vendedor que está logado em outro aparelho | Próxima ação do vendedor cai para o login ou mostra "sem acesso" | P0 | NÃO EXECUTADO (servidor: PASSOU; reação da tela não) |
| MAN-12 | Internet ruim / sem internet | Ligar modo avião no meio de "Converter em venda" e religar | Mensagem de erro de conexão; ao reabrir, o orçamento mostra se virou venda ou não, sem duplicar | P0 | NÃO EXECUTADO |
| MAN-13 | Sessão expirada | Deixar o app aberto mais de 1 hora e tocar numa ação | Renova sozinho ou pede login, sem erro cru | P1 | NÃO EXECUTADO |
| MAN-14 | Android antigo / tela pequena / fonte grande / modo escuro | Repetir MAN-02 e MAN-04 em Android 8-9, tela de 5", fonte do sistema no máximo, tema escuro | Nada cortado ou sobreposto; botões tocáveis; contraste legível | P1 | NÃO EXECUTADO (sem aparelho) |
| MAN-15 | PWA | Instalar na tela inicial no Android e abrir | Abre em tela cheia com ícone e nome certos | P1 | NÃO EXECUTADO (manifest responde 200: WEB-01) |
| MAN-16 | Horário / fora de área | Fora do escopo da v1 (sem entrega e sem horário de funcionamento) | n/a | - | NÃO APLICÁVEL |

**Automação Maestro dos P0:** não gerada. O pedido limitou os arquivos novos a este QA-PLAN.md e o produto é um PWA web, não app Expo. Os P0 de dinheiro e estoque já têm cobertura automatizável em HTTP (scripts acima) e, na ordem de custo, o próximo passo é transformá-los em `npm run test:emu` (junto de `dominio.test.ts`) ou rodar MAN-02, 04, 05, 06 e 10 em Maestro Web/Playwright.

**Lighthouse (admin):** não executado. Precisa de Chrome headless (proibido nesta sessão) e a regra é medir o admin em produção; só existe o dev local. Rodar antes do release: `npx -y lighthouse <url> --only-categories=performance,accessibility --preset=desktop --quiet --chrome-flags="--headless" --output=json --output-path=./lighthouse.json`. Abaixo de 70 em qualquer nota é achado.

## 8. Casos executados (evidência)

Cada linha foi executada contra `http://localhost:3100` em 2026-10-04. "Evidência" traz status HTTP, corpo resumido e saldos antes/depois. P0 = envolve dinheiro ou estoque. O resultado foi reavaliado à mão nos casos AUT-05a, EXP-01, AUT-11 e EST-10 (notas na própria evidência).

### Autenticação, perfis e usuário bloqueado

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| AUT-01 | Login e permissões | Toda rota /api/* (11) sem token => 401 | P1 | **PASSOU** | 11/11 rotas devolveram 401 |
| AUT-02 | Login e permissões | Token lixo, 'Bearer' vazio e JWT alg=none => 401 | P1 | **PASSOU** | 401 em todos |
| AUT-03 | Login e permissões | Vendedor nas 6 rotas só-dono => 403 (regra 9) | P0 | **PASSOU** | 6/6 => 403 'Só o dono pode fazer isso' |
| AUT-04 | Login e permissões | Matriz dono x vendedor: vendedor muda status, duplica, gera link e converte orçamento (inclusive do dono) => 200; cancelar venda, mexer em estoque e em preço/produto => 403 (regra 9) | P0 | **PASSOU** | {"status":200,"duplicar":200,"link":200,"converter":200,"cancelarVenda":403,"estoque":403,"criarProduto":403,"mudarPreco":403} |
| AUT-05a | Login e permissões | Usuário bloqueado: ID token ainda não expirado é recusado NA HORA (403) nas rotas /api e nas leituras do Firestore | P0 | **PASSOU** | {"nota":"Critério inicial esperava 403; no emulador o token antigo já volta 401 (revokeRefreshTokens invalida o token). Em ambos os casos o acesso é NEGADO na hora; o 403 'Usuário sem acesso' aparece com token novo (AUT-05c).","antes":200,"bloqueio":200,"apiDepoisDoBloqueio":[401,401,401],"firestoreLeituraProduto":403,"firest... |
| AUT-05b | Login e permissões | Usuário bloqueado: login por senha novo ainda funciona no Firebase Auth (conta não é desabilitada), mas toda operação é negada | P0 | **PASSOU** | {"loginAuthStatus":200,"temIdToken":true,"observacao":"Auth não é desabilitado, só o campo usuarios.ativo; a trava está no servidor e nas regras, o que é suficiente"} |
| AUT-05c | Login e permissões | Usuário bloqueado com token NOVO (relogin) também => 403 | P0 | **PASSOU** | HTTP 403 {"erro":"Usuário sem acesso"} |
| AUT-05d | Login e permissões | Reativar usuário => volta a operar (novo login) | P0 | **PASSOU** | ["HTTP 200 {"ativo":true}","HTTP 200 {"id":"H6DqmmTxwuULltopkDXN","numero":"ORC-0004","avisos":[]}"] |
| AUT-06 | Login e permissões | Corpo inválido (JSON quebrado, array, null) => 400 e não 500 | P1 | **PASSOU** | ["HTTP 400 {"erro":"Corpo inválido"}","HTTP 400 {"erro":"Corpo inválido"}","HTTP 400 {"erro":"Corpo inválido"}"] |
| AUT-07 | Login e permissões | GET/DELETE em rota POST => 405 | P1 | **PASSOU** | GET /api/estoque=405; DELETE cancelar=405 |
| AUT-08 | Login e permissões | Criar usuário: e-mail repetido 409; senha curta 400; perfil inválido 400; e-mail inválido 400; e-mail repetido com maiúsculas 409; nome vazio 400 | P1 | **PASSOU** | ["HTTP 409 {"erro":"Esse e-mail já está em uso"}","HTTP 400 {"erro":"A senha precisa de pelo menos 8 caracteres"}","HTTP 400 {"erro":"Perfil inválido"}","HTTP 400 {"erro":"E-mail inválido"}","HTTP 409 {"erro":"Esse e-mail já está em uso"}","HTTP 400 {"erro":"Nome é obrigatório"}"] |
| AUT-09 | Login e permissões | Vendedor criado via API loga e cria orçamento (perfil gravado como vendedor) | P1 | **PASSOU** | HTTP 200 {"id":"jP8gxMr5rkD3PlPNL2G8","numero":"ORC-0002","avisos":[]} |
| AUT-10 | Login e permissões | Desativar: a si mesmo 400; uid inexistente 404; valor não-booleano 400; dono de OUTRA loja 404 | P1 | **PASSOU** | ["HTTP 400 {"erro":"Você não pode desativar o próprio acesso"}","HTTP 404 {"erro":"Usuário não encontrado"}","HTTP 400 {"erro":"Valor inválido"}","HTTP 404 {"erro":"Usuário não encontrado"}"] |
| AUT-11 | Login e permissões | Token FORJADO sem assinatura (alg=none) com uid do dono: em produção deve ser 401; token com exp no passado => 401 | P1 | **INCONCLUSIVO** | {"forjadoNaoExpirado":"ACEITO no emulador (chegou até a validação do corpo: HTTP 400 'Tipo inválido' = autenticado como dono)","forjadoExpirado":"401","nota":"O firebase-admin em modo emulador aceita JWT sem assinatura. Na nuvem a assinatura é verificada, então isto NÃO prova falha do app, mas também não dá para provar o caso... |
| AUT-12 | Login e permissões | Dono desativa outro dono: o bloqueado perde acesso na hora (incl. rotas de dono) | P0 | **PASSOU** | {"desativar":"HTTP 200 {"ativo":false}","usoDepois":"HTTP 401 {"erro":"Sessão inválida"}"} |

### Orçamentos: valores, quantidade decimal, desconto, validações e status

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| DSC-01 | Orçamento: desconto | Vendedor: desconto de exatamente 10% passa; 10,01% => 403 (regra 10) | P0 | **PASSOU** | ["HTTP 200 {"id":"CINrFzBuFoIsFqCYh9lW","numero":"ORC-0007","avisos":[]}","HTTP 403 {"erro":"Desconto de 10.0% passa do limite de 10%. Peça ao dono."}"] |
| DSC-02 | Orçamento: desconto | Vendedor: 6% no item + 5% no total = 11% efetivo => 403 | P0 | **PASSOU** | HTTP 403 {"erro":"Desconto de 11.0% passa do limite de 10%. Peça ao dono."} |
| DSC-03 | Orçamento: desconto | Dono: 50% e 100% passam; maior que o total, negativo (geral e por item), decimal e maior que o item => 400 | P0 | **PASSOU** | {"d50":200,"d100":200,"d101":"HTTP 400 {"erro":"Desconto maior que o total"}","dneg":"HTTP 400 {"erro":"Desconto inválido"}","dnegItem":"HTTP 400 {"erro":"Desconto inválido"}","ddec":"HTTP 400 {"erro":"Desconto inválido"}","ditem":"HTTP 400 {"erro":"Desconto maior que o item: QA Disjuntor"}"} |
| DSC-04 | Orçamento: desconto | Vendedor duplica orçamento do dono com 30% de desconto => 403 (não dá para 'lavar' desconto) | P0 | **PASSOU** | HTTP 403 {"erro":"Desconto de 30.0% passa do limite de 10%. Peça ao dono."} |
| DSC-05 | Orçamento: desconto | Vendedor re-salva (edita) rascunho do dono mantendo 30% => 403 | P0 | **PASSOU** | HTTP 403 {"erro":"Desconto de 30.0% passa do limite de 10%. Peça ao dono."} |
| DSC-06 | Orçamento: desconto | Dono muda o limite na loja: com 0% qualquer desconto do vendedor => 403, sem desconto passa; com 20%: 19% passa, 21% => 403; restaurado para 10 | P0 | **PASSOU** | {"lim0_desc1c":403,"lim0_sem":200,"lim20_19pct":200,"lim20_21pct":403} |
| DSC-07 | Orçamento: desconto | Regras do Firestore: vendedor não altera limite; nem dono altera contador de numeração ou preço de produto direto | P0 | **PASSOU** | vendedor->limite=403; dono->contador=403; dono->preco produto=403 |
| ORC-01 | Orçamento: criar/editar | Validações: 0 itens, 101 itens, sem cliente, validade 0 e 366, observação > 1000, forma pgto > 60 => 400 | P1 | **PASSOU** | {"itens0":400,"itens101":400,"semCliente":400,"dias0":400,"dias366":400,"obs":400,"fp":400} |
| ORC-02 | Orçamento: criar/editar | Entradas malformadas: item null, item string, produtoId/clienteId com '/', produto/cliente inexistente => 400 (nunca 500) | P1 | **FALHOU** | {"itemNull":"HTTP 500 {"erro":"Erro interno"}","itemString":"HTTP 400 {"erro":"Produto é obrigatório"}","produtoIdBarra":"HTTP 500 {"erro":"Erro interno"}","clienteIdBarra":"HTTP 500 {"erro":"Erro interno"}","prodInexistente":"HTTP 400 {"erro":"Produto inválido"}","cliInexistente":"HTTP 400 {"erro":"Cliente inválido"}"} |
| ORC-03 | Orçamento: criar/editar | Validade padrão da loja (15 dias) e validade informada (7 dias) | P1 | **PASSOU** | padrão=15d; informada=7d |
| ORC-04 | Orçamento: criar/editar | Editar rascunho troca os itens (2 -> 1), mantém número e recalcula total | P1 | **PASSOU** | antes=2 itens; depois=1; numero ORC-0015->ORC-0015; total=2500 |
| ORC-05 | Orçamento: criar/editar | Editar orçamento 'enviado' => 409; id inexistente => 404; id com '/' => 4xx | P1 | **FALHOU** | ["HTTP 409 {"erro":"Só rascunho pode ser editado. Duplique o orçamento."}","HTTP 404 {"erro":"Orçamento não encontrado"}","HTTP 500 {"erro":"Erro interno"}"] |
| QTD-01 | Orçamento: quantidade/valores | Quantidade decimal 12,345 m x R$ 8,90 => total em centavos arredondado (10987 = R$ 109,87) | P0 | **PASSOU** | HTTP 200 {"id":"Dn4kQoYDxTyK7aN5pNAu","numero":"ORC-0005","avisos":[]} total=10987 subtotal=10987 |
| QTD-02 | Orçamento: quantidade/valores | Quantidade inválida (float, string, 0, negativa, null, enorme) => 400 | P0 | **PASSOU** | {"float 12.5":400,"string '12,5'":400,"zero":400,"negativo":400,"null":400,"acima de 1e12":400,"string numerica":400} |
| QTD-03 | Orçamento: quantidade/valores | Quantidade mínima (0,001 rolo x R$ 1,00 = 0,1 centavo): total do item não deve ficar R$ 0,00 | P0 | **FALHOU** | HTTP 200 total=0 (item de valor zero é aceito silenciosamente) |
| QTD-04 | Orçamento: quantidade/valores | Produto com preço decimal/negativo/texto, mínimo decimal, unidade inválida, nome/código vazio ou longo => 400 | P0 | **PASSOU** | [400,400,400,400,400,400,400,400] |
| R1-01 | Regra 1 | Regra 1: criar/editar/duplicar/mudar status de dezenas de orçamentos não alterou o estoque do QA-CABO (100000) | P0 | **PASSOU** | saldo QA-CABO = 100000; movimentações=1 (esperado 1, a entrada inicial) |
| STA-01 | Orçamento: status | Matriz de transições de status via HTTP | P1 | **PASSOU** | {"resultados":{"rascunho->enviado":200,"enviado->rascunho":409,"enviado->aprovado":200,"aprovado->enviado":409,"aprovado->recusado":200,"recusado->aprovado":409,"rascunho->aprovado":200,"rascunho->recusado":200,"rascunho->expirado(manual)":409,"status 'xyz'":400,"status vazio":400,"status numero":400,"status 'constructor'":40... |
| STA-02 | Orçamento: status | Status 'constructor'/'__proto__' (chaves herdadas do Object) e id com '/' devem dar 400/404, não 409/500 | P1 | **FALHOU** | {"constructor":409,"proto":409,"idComBarra":500} |

### Orçamento -> venda -> estoque (conversão, sem estoque, concorrência, cancelamento, regra 5, numeração)

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| EST-01 | Orçamento -> venda -> estoque | Caminho feliz (vendedor): orçamento 12,5 m cabo + 2 un tomada, desconto item R$1,00 + geral R$2,00 -> converter -> venda, baixa, movimentações, itens copiados, orçamento aprovado | P0 | **PASSOU** | {"orc":{"numero":"ORC-0020","subtotal":14025,"desconto":200,"total":13825},"converter":"HTTP 200 {"vendaId":"3fnf91ZaWwRLTglrpTOt","numero":"VEN-0002","negativos":[]}","saldoCabo":"100000 -> 87500","saldoTomada":"20000 -> 18000","venda":{"numero":"VEN-0002","total":13825,"status":"concluida","forma":"Cartão","usuarioId":"9Plh... |
| EST-02 | Orçamento -> venda -> estoque | Converter o mesmo orçamento de novo (duplo clique sequencial) => 409 e saldo não muda | P0 | **PASSOU** | HTTP 409 {"erro":"Esse orçamento já virou venda"}; saldo cabo 87500 -> 87500 |
| EST-03 | Orçamento -> venda -> estoque | Mesmo orçamento convertido 5x em paralelo => exatamente 1 venda, baixa uma vez só | P0 | **PASSOU** | {"status":[409,409,409,200,409],"saldoDisj":"50000 -> 47000","vendasDoOrcamento":1,"contadorVenda":"2 -> 3"} |
| EST-03b | Orçamento -> venda -> estoque | Converter o mesmo orçamento em paralelo (2, 3, 5 e 10 cliques): baixa uma vez só e demais 409 | P0 | **PASSOU** | [{"paralelos":2,"status":[409,200],"delta":-1000},{"paralelos":3,"status":[200,409,409],"delta":-1000},{"paralelos":5,"status":[409,409,409,409,200],"delta":-1000},{"paralelos":10,"status":[409,409,409,409,200,409,409,409,409,409],"delta":-1000}] |
| EST-04 | Orçamento -> venda -> estoque | Duas vendas simultâneas (vendedor + dono) da última unidade => uma passa (200), a outra 409; saldo 0, nunca negativo | P0 | **PASSOU** | {"saldo":"1000 -> 0","respostas":["HTTP 200 {"vendaId":"7lZldyXWcGe13aZsqVEU","numero":"VEN-0004","negativos":[]}","HTTP 409 {"erro":"Sem estoque: QA Ultima unidade"}"],"abaixoDoMinimo":false} |
| EST-05 | Orçamento -> venda -> estoque | 8 vendas simultâneas de 1 rolo com saldo de 5 => exatamente 5 passam, 3 recusadas (409), saldo 0, 5 movimentações, numeração VEN única e sem buracos | P0 | **PASSOU** | {"saldoFita":"5000 -> 0","status":[200,200,200,409,409,200,409,200],"numeros":["VEN-0005","VEN-0006","VEN-0007","VEN-0008","VEN-0009"],"movimentacoesVenda":5,"contadorVenda":"4 -> 9","erro409":{"erro":"Sem estoque: QA Fita"}} |
| EST-06 | Orçamento -> venda -> estoque | Venda sem estoque e SEM permissão (2 itens, só o 2º falta): aviso na criação (regra 1), conversão 409, nada baixado (inclusive o item com estoque), sem venda, sem gastar número VEN | P0 | **PASSOU** | {"avisoNaCriacao":[{"produtoId":"fuz0tEN1xXT3jG51vd7Y","descricao":"QA Tomada","faltam":1000}],"conversao":"HTTP 409 {"erro":"Sem estoque: QA Tomada"}","saldoDisj":"47000 -> 47000","saldoTomada":"19000 -> 19000","vendas":0,"contadorVenda":"9 -> 9","statusOrcamento":"rascunho"} |
| EST-07 | Orçamento -> venda -> estoque | Venda sem estoque COM permissão (vendedor): 200, saldo fica negativo, flag abaixoDoMinimo ligada, movimentação com saldoApos negativo, resposta lista 'negativos' | P0 | **PASSOU** | {"conversao":"HTTP 200 {"vendaId":"hO4CmDWvgjQopIvsLn0R","numero":"VEN-0010","negativos":[{"produtoId":"fuz0tEN1xXT3jG51vd7Y","descricao":"QA Tomada","faltam":1000}]}","saldoTomada":"19000 -> -1000","abaixoDoMinimo":true,"movs":[{"q":-1000,"saldoApos":46000},{"q":-20000,"saldoApos":-1000}]} |
| EST-07b | Orçamento -> venda -> estoque | Produto com saldo negativo (-1) e orçamento de 1 un: aviso 'faltam' = 1 un (não 2) | P0 | **PASSOU** | HTTP 200 {"id":"TWRXsSjbA2VYiYJ6AVQZ","numero":"ORC-0033","avisos":[{"produtoId":"fuz0tEN1xXT3jG51vd7Y","descricao":"QA Tomada","faltam":1000}]} |
| EST-08 | Orçamento -> venda -> estoque | Cancelar venda: estoque volta (-1 -> 0 un na tomada, inclusive o disjuntor), movimentação 'estorno' com motivo, venda 'cancelada', nada apagado, vendaId some do orçamento | P0 | **PASSOU** | {"cancelar":"HTTP 200 {"status":"cancelada"}","saldoTomada":"-1000 -> 19000","saldoDisj":47000,"movs":[{"tipo":"venda","q":-1000,"saldoApos":46000,"motivo":"Venda VEN-0010"},{"tipo":"estorno","q":20000,"saldoApos":19000,"motivo":"Cancelamento VEN-0010: Cliente desistiu"},{"tipo":"venda","q":-20000,"saldoApos":-1000,"motivo":"... |
| EST-09 | Orçamento -> venda -> estoque | Cancelar: já cancelada 409; vendedor 403; sem motivo/motivo em branco 400; motivo >200 400; inexistente 404; outra loja 404; id com '/' não pode dar 500 | P1 | **FALHOU** | {"jaCancelada":409,"vendedor":403,"semMotivo":400,"motivoBranco":400,"motivoLongo":400,"inexistente":404,"outraLoja":404,"idComBarra":500} |
| EST-10 | Orçamento -> venda -> estoque | Cancelar a mesma venda em paralelo (2, 3 e 5 cliques simultâneos, 5 rodadas): estorno uma vez só (integridade) E respostas limpas (1x 200, demais 409) | P0 | **FALHOU** | {"integridade":"OK: estorno gravado 1 vez e saldo +1 vez em todas as rodadas; auditoria global AUD-01/03 passou depois","respostas":"A 1ª execução devolveu [200,500,500] (3 cliques simultâneos); nova bateria de 5 rodadas deu só 200/409; terceira bateria (12 rodadas x 3 cliques) deu 2 rodadas com 500 ('200/500/500' e '500/409/... |
| EST-11 | Orçamento -> venda -> estoque | Ajuste de inventário entre a venda e o cancelamento: estorno soma sobre o saldo ATUAL (não restaura o antigo) | P0 | **PASSOU** | saldo após venda=77500; após ajuste=82500; após cancelar=92500 (esperado 92500) |
| EST-12 | Orçamento -> venda -> estoque | Orçamento cuja venda foi cancelada pode virar venda de novo? (orçamento segue 'aprovado', vendaId removido pelo cancelamento) | P0 | **OBSERVAÇÃO** | {"novaConversao":"HTTP 200 {"vendaId":"uVn0VM9oIDb7TesAdz9l","numero":"VEN-0026","negativos":[]}","orcamento":{"status":"aprovado","vendaId":"uVn0VM9oIDb7TesAdz9l"},"observacao":"Permitido; nova venda com preços antigos copiados. Comportamento a confirmar com o dono (BUG-07, baixa)."} |
| EST-13 | Orçamento -> venda -> estoque | Regra 5: produto subiu para R$ 99,00 depois do orçamento de R$ 25,00/un: venda sai a R$ 50,00 (preço copiado); orçamento novo sai a R$ 99,00; venda_itens guarda o preço | P0 | **PASSOU** | {"vendaTotal":5000,"precoItemVenda":2500,"novoOrcamentoTotal":9900} |
| EST-14 | Orçamento -> venda -> estoque | Produto desativado: orçamento novo => 400; rascunho que já o continha pode ser editado e convertido | P0 | **PASSOU** | {"novo":"HTTP 400 {"erro":"Produto inativo: QA Inativável"}","editarExistente":200,"converter":200} |
| EST-15 | Orçamento -> venda -> estoque | Orçamento no limite de 100 itens (mesmo produto, 0,1 m cada): salva, converte numa transação, baixa 10 m e grava 100 movimentações | P0 | **PASSOU** | {"criar":"HTTP 200 {"id":"uXL3NvDCzvtN7LNkf5DH","numero":"ORC-0039","avisos":[]}","converter":200,"saldo":"92500 -> 82500","movimentacoes":100,"ultimaSaldoApos":82500} |
| EST-15b | Orçamento -> venda -> estoque | Duplicar orçamento de 100 itens (já virou venda) => novo rascunho | P0 | **PASSOU** | HTTP 200 {"id":"icpyanA0DzerJlSeOADz","numero":"ORC-0040","avisos":[]} |
| EST-16 | Orçamento -> venda -> estoque | Regra 7: 10 orçamentos criados em paralelo => 10 números distintos e consecutivos, contador +10 | P0 | **PASSOU** | {"numeros":["ORC-0041","ORC-0042","ORC-0043","ORC-0044","ORC-0045","ORC-0046","ORC-0047","ORC-0048","ORC-0049","ORC-0050"],"contador":"40 -> 50"} |
| EST-17 | Orçamento -> venda -> estoque | Duplicar orçamento recusado: novo rascunho, novo número, mesmos itens/desconto/forma/obs; original permanece recusado; estoque intacto | P0 | **PASSOU** | {"original":"ORC-0051","copia":"ORC-0052","totalOriginal":3130,"totalCopia":3130,"itens":2,"statusOriginal":"recusado"} |
| EST-17b | Orçamento -> venda -> estoque | Duplicar: inexistente 404; outra loja 404; id com '/' não pode dar 500 | P1 | **FALHOU** | {"inexistente":404,"outraLoja":404,"idComBarra":500} |
| EST-17c | Orçamento -> venda -> estoque | Converter: id com '/' não pode dar 500 | P1 | **FALHOU** | HTTP 500 {"erro":"Erro interno"} |

### Orçamento vencido (regra 6)

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| EXP-01 | Orçamento vencido | Orçamento vencido (rascunho e enviado) => converter 409, mudar status 409, editar 409; estoque intacto; duplicar funciona (regra 6) | P0 | **PASSOU** | {"nota":"Rascunho e enviado vencidos: converter 409, status 409, editar 409; duplicar 200. A variação de saldo do disjuntor (45000 -> 44000) veio da conversão do orçamento APROVADO vencido do EXP-02, que rodou antes da leitura do saldo; não do rascunho/enviado.","rascunho":"409/409/409","enviado":"409/409/409","duplicar":200} |
| EXP-02 | Orçamento vencido | Orçamento APROVADO (sem venda) com validade vencida: deveria poder virar venda? (statusEfetivo só expira rascunho/enviado) | P1 | **FALHOU** | {"converterAprovadoVencido":{"converter":200,"status_enviado":409,"editar":409},"observacao":"A conversão de aprovado vencido é permitida (200). A spec diz 'orçamento vencido vira expirado'; aprovado não vence. Divergência a confirmar com o dono (BUG-08, baixa)."} |
| EXP-03 | Orçamento vencido | Duplicar orçamento recusado e vencido => 200 (cópia nova, validade renovada) | P1 | **PASSOU** | HTTP 200 {"id":"mmicsd8Fvaw6ReIyLNpb","numero":"ORC-0092","avisos":[]} |
| EXP-04 | Orçamento vencido | Orçamento com validade ainda no futuro (1 h restante) converte normalmente | P1 | **PASSOU** | HTTP 200 {"vendaId":"vaqKFaMEbSFmyO7HX5UW","numero":"VEN-0052","negativos":[]} |

### PDF e link assinado (adulterado e vencido)

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| PDF-01 | PDF e link | Gerar link do PDF (dono e vendedor): URL assinada com exp ~30 dias e sig | P1 | **PASSOU** | {"url":"http://localhost:3100/api/pdf/7tEy88WZ1tvIFwiQig30?exp=1793721578875&sig=<...>","diasDeValidade":30,"vendedor":200} |
| PDF-02 | PDF e link | GET do link SEM login => 200 application/pdf, arquivo PDF válido (%PDF), inline, no-store | P0 | **PASSOU** | {"status":200,"type":"application/pdf","disposition":"inline; filename="ORC-0094.pdf"","cache":"private, no-store","bytes":3323,"eof":"%%EOF"} |
| PDF-03 | PDF e link | Itens do orçamento aparecem na ordem em que foram digitados (Fita, Cabo, Tomada, Disjuntor) | P1 | **FALHOU** | {"ordemLidaDoFirestore_igualAoPDF":["QA Tomada","QA Cabo 4mm","QA Disjuntor","QA Fita"],"observacao":"pdf.tsx e as telas leem a subcoleção sem orderBy: a ordem sai por ID aleatório"} |
| PDF-04 | PDF e link | Link adulterado (13 variações: sig alterada, sem sig/exp, exp estendido, exp texto/negativo, sig gigante/unicode, id trocado, path traversal) => sempre 403, nunca PDF nem 500 | P0 | **PASSOU** | {"sig com 1 caractere trocado":403,"sem sig":403,"sem exp":403,"sem nada":403,"exp+1 (estender validade)":403,"exp gigante (estender)":403,"exp texto":403,"exp negativo":403,"sig vazio":403,"sig gigante":403,"sig com lixo unicode":403,"id de OUTRO orçamento com a sig deste":403,"id com ../":403} |
| PDF-05 | PDF e link | Link legitimamente assinado mas VENCIDO (exp 1 min atrás) => 403; mesma assinatura com exp futuro => 200 (prova que a recusa é por vencimento) | P0 | **PASSOU** | {"vencido":403,"comExpFuturo":200} |
| PDF-06 | PDF e link | Link assinado de orçamento inexistente => 404 (e id com '/' não pode dar 500) | P1 | **FALHOU** | {"inexistente":404,"idComBarra":500} |
| PDF-07 | PDF e link | Gerar link: orçamento de outra loja 404; inexistente 404; id com '/' < 500 | P1 | **FALHOU** | {"outraLoja":404,"inexistente":404,"idComBarra":500} |
| PDF-08 | PDF e link | PDF de orçamento vencido ainda é gerado (200) | P1 | **PASSOU** | {"status":200,"bytes":3314,"textoExtraidoContemVencido":"não verificável (fonte embutida)","amostraTexto":"1 0 0 -1 0 841.890015 cm q q q q 1 0 0 1 36 36 cm q q q q 1 0 0 1 0 12.099999 cm q q q 1 0 0 1 0 12.6 cm /DeviceRGB cs 0"} |
| PDF-09 | PDF e link | Logo da loja com URL quebrada não impede o PDF (cai para versão sem logo) | P1 | **PASSOU** | {"status":200,"bytes":3289} |

### Estoque manual: entrada, perda, ajuste

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| MOV-01 | Estoque manual | Entrada decimal 12,5 m com motivo: saldo 12500, movimentação gravada com tipo, quantidade, saldoApos, motivo, usuário e horário (regra 4) | P0 | **PASSOU** | {"resposta":"HTTP 200 {"saldoApos":12500}","saldo":12500,"mov":{"id":"JGCla7yUHUPwLX4BCQRD","lojaId":"p0yhM50L17kSOyB7lNsD","produtoId":"RmKtLr8DMkR8UT4EIufc","tipo":"entrada","quantidade":12500,"saldoApos":12500,"motivo":"Compra NF 123","usuarioId":"UjXWUXiQqDa3eoSPp7VQDZ5mFuxZ","criadoEm":"2026-10-04T16:00:26.807Z"},"abaixo... |
| MOV-02 | Estoque manual | Movimentação inválida (sem motivo/motivo em branco/longo, qtd 0/negativa/float/texto, tipos reservados, ajuste negativo/float/igual, produto inexistente/de outra loja) => 4xx e saldo intacto | P0 | **PASSOU** | {"resultados":{"entrada sem motivo":400,"perda motivo em branco":400,"ajuste sem motivo":400,"motivo 201 chars":400,"quantidade 0":400,"quantidade negativa":400,"quantidade 12.5 (float)":400,"quantidade texto":400,"tipo venda (reservado)":400,"tipo estorno (reservado)":400,"ajuste saldo negativo":400,"ajuste saldo float":400,... |
| MOV-03 | Estoque manual | produtoId com '/' => 4xx (não 500) | P1 | **FALHOU** | HTTP 500 {"erro":"Erro interno"} |
| MOV-04 | Estoque manual | Alerta de estoque baixo: perda abaixo do mínimo liga a flag; entrada acima do mínimo desliga; saldo EXATAMENTE no mínimo liga (<=) | P0 | **PASSOU** | {"aposPerda":"4500 min 5000 -> flag ligada","aposEntrada":"5500 -> desligada","noLimite":"5000 == min -> ligada"} |
| MOV-05 | Estoque manual | Perda maior que o saldo (50 m com 5 m em estoque) deveria ser recusada ou ao menos alertada; saldo negativo só deveria nascer de venda permitida | P0 | **FALHOU** | {"resposta":"HTTP 200 {"saldoApos":-45000}","saldoAgora":-45000,"observacao":"Perda/baixa manual aceita e deixa saldo negativo sem aviso (BUG-04)"} |

### Produtos e importação (API)

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| IMP-01 | Importação (API) | Importação válida: cria com saldo inicial (+ movimentação 'Saldo inicial'), cria sem saldo, normaliza código para MAIÚSCULAS, atualiza existente SEM mexer no saldo (estoqueInicial 999999 ignorado) | P0 | **PASSOU** | {"resposta":"HTTP 200 {"criados":2,"atualizados":1}","A":{"saldo":7500,"movs":1},"B":{"codigo":"QA-IMP-B9973","saldo":0},"saldoCaboExistente":76500} |
| IMP-02 | Importação (API) | Importação inválida: 1 linha ruim derruba o lote inteiro (nada gravado), código repetido (inclusive só maiúscula/minúscula), vazio, 151 linhas, 'linhas' não-array, preço negativo/decimal, nome vazio => 400 e NENHUM produto criado | P0 | **PASSOU** | {"lote_com_linha_ruim":"HTTP 400 {"erro":"Unidade inválida"}","repetido":"HTTP 400 {"erro":"Código repetido na planilha"}","vazio":"HTTP 400 {"erro":"Envie de 1 a 150 linhas por vez"}","151_linhas":"HTTP 400 {"erro":"Envie de 1 a 150 linhas por vez"}","naoArray":"HTTP 400 {"erro":"Linhas inválidas"}","precoNeg":"HTTP 400 {"er... |
| IMP-03 | Importação (API) | Importação com elementos que não são objeto: [1], ['abc'], [null] => 400 (não 500) | P1 | **FALHOU** | {"num":"HTTP 400 {"erro":"Unidade inválida"}","texto":"HTTP 400 {"erro":"Unidade inválida"}","nulo":"HTTP 500 {"erro":"Erro interno"}"} |
| IMP-04 | Importação (API) | Vendedor tentando importar => 403 | P1 | **PASSOU** | HTTP 403 {"erro":"Só o dono pode fazer isso"} |
| IMP-05 | Importação (API) | Dois uploads simultâneos do mesmo código novo (duplo clique em 'Importar') => 1 produto só | P0 | **FALHOU** | {"respostas":["HTTP 200 {"criados":1,"atualizados":0}","HTTP 200 {"criados":1,"atualizados":0}"],"produtosComEsseCodigo":2,"saldos":[1000,1000]} |
| PRD-01 | Produtos | Código repetido ('qa-mov' minúsculo e ' QA-MOV ' com espaço) => 409 | P0 | **PASSOU** | ["HTTP 409 {"erro":"Já existe um produto com o código QA-MOV"}","HTTP 409 {"erro":"Já existe um produto com o código QA-MOV"}"] |
| PRD-02 | Produtos | Editar produto (preço, nome, mínimo) não altera o saldo; flag de estoque baixo é recalculada com o novo mínimo | P0 | **PASSOU** | {"saldo":"-45000 -> -45000","preco":350,"abaixoDoMinimo":true} |
| PRD-03 | Produtos | Editar: trocar para código de outro produto 409; id inexistente 404; produto de outra loja 404; id com '/' < 500 | P1 | **FALHOU** | {"codigoDeOutro":409,"inexistente":404,"outraLoja":404,"idComBarra":500} |
| PRD-04 | Produtos | Mesmo código em lojas diferentes é permitido (unicidade é por loja) | P1 | **PASSOU** | HTTP 200 {"id":"FHhamoeIQZV01HO6xQmV"} |
| PRD-05 | Produtos | Teto de sanidade no preço: preço R$ 0,00 e R$ 10.000.000.000,00 deveriam ser recusados/alertados | P1 | **FALHOU** | {"precoZero":"HTTP 200 {"id":"FGX71Uh1hVg7tnickySx"}","precoDezBilhoes":"HTTP 200 {"id":"amJgJiiSvPIgVLmE5e3J"}","observacao":"ambos aceitos; baixa gravidade (BUG-09); produtos criados já inativos"} |
| PRD-06 | Produtos | 3 cadastros simultâneos do MESMO código (duplo clique) => 1 criado, 2 recusados (409) | P0 | **FALHOU** | {"respostas":[200,409,200],"produtosCriadosComEsseCodigo":2} |

### Importação CSV: erros e formatos (lógica da tela, sem navegador)

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| CSV-01 | Importação (planilha) | CSV (;) de 15 linhas: 4 boas (linhas 2, 3, 14, 15) e 11 problemas de tipos variados => cada erro apontado na linha certa, as boas passam | P1 | **PASSOU** | {"linhasValidas":[2,3,14,15],"erros":["4: Código CAB-25 repetido na planilha","5: Falta o código","6: Falta o nome","7: Preço "abc" inválido","8: Preço "1,005" inválido","9: Preço "-5,00" inválido","10: Preço "" inválido","11: Unidade "litro" inválida (use un, m, rolo, cx, kg)","12: Estoque "muito" inválido","13: Estoque míni... |
| CSV-02 | Importação (planilha) | Conversões: '1.234,56' => 123456 centavos; 'UN' => 'un'; '12,5' => 12500 milésimos; '"R$ 8,90"' => 890 | P1 | **PASSOU** | {"linha14":{"codigo":"OK-1","nome":"Unidade em maiúscula","categoria":"","marca":"","unidade":"un","precoVenda":123456,"estoqueMinimo":0,"estoqueInicial":12500,"ativo":true},"linha15":{"codigo":"OK-2","nome":"Aspas, com vírgula","categoria":"","marca":"","unidade":"m","precoVenda":890,"estoqueMinimo":0,"ativo":true}} |
| CSV-03 | Importação (planilha) | Preço negativo e preço vazio são recusados na conferência | P1 | **PASSOU** | {"preço negativo (-5,00)":"recusado","preço vazio":"recusado"} |
| CSV-04 | Importação (planilha) | Formatos: BOM, vírgula+aspas, TAB, Latin-1 e acento no cabeçalho são lidos; sem coluna preço, vazio e só cabeçalho dão aviso claro | P1 | **PASSOU** | {"UTF-8 com BOM":"1 válida(s) preco=150 nome=Fio","vírgula com aspas":"1 válida(s) preco=150 nome=Fio","TAB":"1 válida(s) preco=150 nome=Fio","Latin-1/Windows-1252 (Excel antigo)":"1 válida(s) preco=150 nome=Fio flexível","UTF-8 com acento no cabeçalho":"1 válida(s) preco=150 nome=Fio flexível","sem coluna preço":"faltam prec... |
| CSV-05 | Importação (planilha) | Estoque '1.500' (um mil e quinhentos parafusos no padrão BR) deveria ser lido como 1500, não 1,5 | P1 | **FALHOU** | {"'1.500'":1.5,"'1,500'":1.5,"'1500'":1500,"observacao":"Sem vírgula, o ponto é decimal: '1.500' vira 1,5 un em silêncio (BUG-05)"} |
| CSV-06 | Importação (planilha) | Planilha com 400 linhas é lida e conferida (a tela envia em lotes; o servidor limita 150 por lote) | P1 | **PASSOU** | {"linhas":400,"observacao":"lotes enviados em sequência; lote falho não desfaz os anteriores (a tela avisa e é seguro reenviar)"} |
| CSV-07 | Importação (planilha) | Nome com mais de 120 caracteres deveria ser recusado já na conferência (servidor recusa o lote inteiro com 400 depois) | P1 | **FALHOU** | {"nome500chars":"ACEITO na conferência (o servidor vai recusar o LOTE inteiro: 'Nome inválido')"} |

### Isolamento entre lojas e regras do Firestore

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| CFG-01 | Configurações da loja | Loja com validade padrão 0 dias gravada direto no Firestore (a tela barra, as regras não) => criar orçamento não pode dar 500 | P1 | **FALHOU** | {"gravacaoNaLoja":200,"criarOrcamento":"HTTP 500 {"erro":"Erro interno"}","observacao":"As regras do Firestore não validam tipo/faixa dos campos da loja"} |
| CFG-02 | Configurações da loja | Limite de desconto do vendedor gravado como texto ('abc') direto no Firestore => vendedor NÃO pode ficar sem limite (90% de desconto deveria dar 403) | P1 | **FALHOU** | {"gravacaoNaLoja":200,"descontoDe90PctPeloVendedor":"HTTP 200 {"id":"F71rSdzp2JpWlhCny9I9","numero":"ORC-0095","avisos":[]}","observacao":"Limite vira 'sem limite' em silêncio; só o dono consegue gravar isso"} |
| TEN-01 | Isolamento entre lojas | Isolamento entre lojas via API (ids REAIS): dono da loja B não mexe em orçamento/venda/produto/usuário/estoque da loja A (404) nem mistura cliente/produto de A em orçamento de B (400); orçamento de A permanece intacto | P0 | **PASSOU** | {"orcamentoAlvo":"7tEy88WZ1tvIFwiQig30","resultados":{"status":404,"converter":404,"duplicar":404,"link":404,"cancelar venda":404,"movimentar estoque":404,"editar produto":404,"desativar usuario":404,"orcamento c/ cliente da loja A":400,"orcamento c/ produto da loja A":400,"editar orcamento da loja A (id real)":404},"divergen... |
| TEN-02 | Isolamento entre lojas | Regras do Firestore (leitura): outra loja e anônimo => 403; vendedor não lê dados de outro usuário; leituras legítimas => 200 | P0 | **PASSOU** | {"resultados":{"B lê loja A":403,"B lê produto de A":403,"B lê orçamento de A":403,"B lê itens de orçamento de A":403,"B lê venda de A":403,"B lê cliente de A":403,"B lê usuário de A":403,"A lê produto de B":403,"A lê loja B":403,"anônimo lê produto de A":403,"vendedor lê usuário do dono":403,"vendedor lê o próprio usuário (e... |
| TEN-03 | Isolamento entre lojas | Regras do Firestore (escrita): ninguém altera saldo, venda, movimentação, status de orçamento ou perfil direto; vendedor não escreve em outra loja; edições legítimas de cliente => 200 | P0 | **PASSOU** | {"resultados":{"dono altera saldo do produto direto":403,"dono cria venda direto":403,"dono cria movimentação direto":403,"dono altera status do orçamento direto":403,"dono muda perfil do vendedor direto":403,"vendedor muda o próprio perfil":403,"vendedor cria cliente na própria loja (esperado 200)":200,"vendedor cria cliente... |

### Concorrência entre operações diferentes

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| RACE-01 | Concorrência | Converter e Recusar o mesmo orçamento ao mesmo tempo (8 rodadas): nunca existe venda de orçamento recusado | P0 | **PASSOU** | [{"converter":200,"recusar":409,"statusFinal":"aprovado","vendas":1,"incoerente":false},{"converter":200,"recusar":409,"statusFinal":"aprovado","vendas":1,"incoerente":false},{"converter":200,"recusar":409,"statusFinal":"aprovado","vendas":1,"incoerente":false},{"converter":200,"recusar":409,"statusFinal":"aprovado","vendas":... |
| RACE-02 | Concorrência | Editar e Converter o mesmo rascunho ao mesmo tempo (8 rodadas): a venda sempre bate com o orçamento final (itens e total) | P0 | **PASSOU** | [{"converter":500,"editar":200,"vendaQtd":0,"orcTotal":12500,"orcQtd":5,"coerente":true},{"converter":500,"editar":200,"vendaQtd":0,"orcTotal":12500,"orcQtd":5,"coerente":true},{"converter":200,"editar":409,"vendaQtd":1,"vendaTotal":2500,"orcTotal":2500,"orcQtd":1,"coerente":true},{"converter":200,"editar":409,"vendaQtd":1,"v... |
| RACE-02b | Concorrência | Editar x Converter o mesmo rascunho ao mesmo tempo: as duas respostas devem ser 200/409, nunca 500 | P0 | **FALHOU** | Em 4 de 8 rodadas a conversão devolveu HTTP 500 'Erro interno' (a edição ganhou). Integridade preservada: nenhuma venda parcial e venda sempre igual ao orçamento (RACE-02). Em RACE-03, 1 de 10 requisições também deu 500. Possível limite do emulador (contenção/abort do Firestore); na nuvem pode diferir, mas o código não trata ... |
| RACE-03 | Concorrência | 5 vendas + 5 perdas manuais de 1 un simultâneas sobre 10 un: saldo final 0 (nenhuma atualização perdida) | P0 | **FALHOU** | {"status":[200,200,200,200,200,200,500,200,200,200],"saldoFinal":1000,"falhas":["HTTP 500 {"erro":"Erro interno"}"]} |

### Auditoria global de consistência e páginas

| ID | Fluxo | Passos e resultado esperado | Prio | Resultado | Evidência (HTTP / saldos) |
|---|---|---|---|---|---|
| AUD-01 | Auditoria de consistência | Auditoria global: para TODOS os produtos da loja de teste, saldo == soma das movimentações (nada baixou/subiu sem movimentação) | P0 | **PASSOU** | {"produtos":19,"movimentacoes":230,"divergentes":[]} |
| AUD-02 | Auditoria de consistência | Auditoria global: flag abaixoDoMinimo coerente com saldo e mínimo em todos os produtos | P0 | **PASSOU** | {"incoerentes":[]} |
| AUD-03 | Auditoria de consistência | Auditoria global: cada venda tem baixa = itens, cancelada tem estorno = itens, concluída sem estorno, total da venda = total do orçamento = soma dos itens - desconto | P0 | **PASSOU** | {"vendasAuditadas":70,"problemas":[]} |
| AUD-04 | Auditoria de consistência | Auditoria global (regra 7): numeração VEN e ORC sem repetição e sem buracos; contador da loja = maior número | P0 | **PASSOU** | {"vendas":"1..70 (70)","orcamentos":"1..118 (118)","contador":{"venda":70,"orcamento":118},"buracosVenda":[],"buracosOrc":[]} |
| AUD-05 | Auditoria de consistência | Auditoria global: vínculo orçamento<->venda coerente (orçamento só aponta para venda concluída e vice-versa) | P0 | **PASSOU** | {"orcamentosApontandoParaVendaNaoConcluida":[],"vendasConcluidasSemVinculo":[]} |
| WEB-01 | Páginas | Smoke HTTP das páginas (sem navegador): /login e manifest respondem 200; 404 amigável; páginas internas respondem (a proteção por login é feita no cliente) | P1 | **PASSOU** | {"/":"200","/login":"200","/orcamentos":"200","/produtos":"200","/estoque":"200","/configuracoes":"200","/clientes":"200","/manifest.webmanifest":"200","/rota-que-nao-existe":"404"} |

## 9. Como reexecutar

1. Subir os mesmos emuladores (`npm run test:emu` do projeto sobe só para os testes automatizados; aqui foram usados os que já estavam ligados) e o dev em `:3100`.
2. Rodar em ordem, de um diretório temporário: `node s1_setup.mjs` (cria vendedor, loja alheia, produtos QA), depois `s2_auth`, `s3_orc`, `s4_vendas`, `s4b`, `s5_pdf_exp`, `s6_estoque_prod`, `s7b`, `s8_csv`, `s10_races`, `s11`, `s9_audit`. Cada script grava `PASSOU/FALHOU` em `results.jsonl`.
3. Os scripts não fazem parte do projeto. Se quiser mantê-los, mover para `scripts/qa/` (não foi feito porque o pedido limitou os arquivos novos a este documento).
4. Reexecutar os casos FALHOU depois das correções, principalmente BUG-02, 03 e 04 (P0), e o Gate 8 só passa com todos os P0 em PASSOU, MAN-02 a MAN-06, MAN-10 a MAN-12 feitos em Android real e o Lighthouse do admin em produção >= 70.

## PRÓXIMO PASSO

1. Corrigir BUG-02 (unicidade do código), BUG-03 (tratar abort de transação) e BUG-04 (bloquear perda maior que o saldo); são P0.
2. Decidir com o dono: BUG-08 (aprovado expira? refazer venda cancelada?) e OBS-1 (vendedor cancela venda?).
3. Corrigir BUG-05 (milhar na planilha) antes de qualquer importação real de estoque.
4. Executar os casos MAN-* em Android real com internet ruim e rodar o Lighthouse em produção.
5. Conferir que as variáveis de emulador não estão na Vercel (OBS-5).

---

## STATUS DAS CORRECOES (2026-10-04, depois do QA)

Corrigido e coberto por teste automatizado (`npm run test:emu`, 54 testes) ou por prova manual:

| Item | Correcao | Prova |
| --- | --- | --- |
| BUG-02 codigo duplicado | trava por (loja, codigo) criada na mesma transacao do produto | `correcoes.test.ts`: 3 cadastros simultaneos, 1 produto |
| BUG-03 500 em disputa | `handle()` converte aborto de transacao em 409 | `correcoes.test.ts` |
| BUG-04 perda maior que saldo | 409 pedindo conferencia; ajuste de inventario continua possivel | `correcoes.test.ts` |
| BUG-05 "1.500" vira 1,5 | ponto sem virgula com 3 digitos e recusado como ambiguo | `calc.test.ts`, `importacao.test.ts` |
| BUG-01 / revisao #16 entrada malformada | `ident()` e `objeto()`: 400 em vez de 500 | `correcoes.test.ts` |
| BUG-06 item de valor zero, preco 0 ou absurdo | preco de 0,01 a 1.000.000,00; item com valor 0 recusado | `correcoes.test.ts` |
| BUG-07 ordem dos itens no PDF | campo `ordem` + `orderBy` | `correcoes.test.ts` |
| BUG-08 aprovado nunca vence | aprovado sem venda tambem vence; venda cancelada nao reabre preco antigo; editar conta a validade da criacao | `correcoes.test.ts` |
| BUG-09 regras sem validacao | tipos e faixas da loja e campos do cliente validados nas regras | `rules-validacoes.test.ts` |
| BUG-10 conferencia da planilha | limites de tamanho e de preco iguais aos do servidor | `importacao.test.ts` |
| Seguranca A1 (SSRF via logoUrl) | regras aceitam so Cloudinary/Firebase Storage; servidor baixa o logo com allowlist, timeout e limite de 500 KB | `rules-validacoes.test.ts` + prova: com `file://`, `http://127.0.0.1` e host externo gravados direto no banco o PDF sai sem logo e o servidor nao chama o endereco |
| Seguranca M2 (link de PDF) | validade 7 dias; editar ou recusar revoga links anteriores | `correcoes.test.ts` |
| Seguranca M3 (cabecalhos) | X-Frame-Options, CSP frame-ancestors, nosniff, Referrer-Policy, HSTS; sem X-Powered-By | `curl -I` |
| Revisao: "Salvar e vender" duplicava orcamento | vai para o orcamento salvo quando a venda falha | revisao de codigo |
| Revisao: saldo negativo some do alerta com minimo 0 | negativo sempre entra no alerta | `correcoes.test.ts` |
| Revisao: historico sem "quem" | `usuarioNome` gravado na movimentacao | `correcoes.test.ts` |
| Revisao: categoria/marca nao limpavam | `FieldValue.delete()` na edicao | `correcoes.test.ts` |
| Revisao: duplicar quebrava com preco menor ou produto inativo | desconto limitado ao novo valor; inativos descartados | `correcoes.test.ts` |
| Revisao: produto novo com saldo em 2 chamadas | 1 transacao (produto + trava + saldo inicial) | `correcoes.test.ts` |
| Revisao: relogio congelado, listas e carregamentos | `useAgora`, `useColecao` mantem a lista, estados de erro | revisao + tela |

Continua em aberto (decisao do dono ou execucao fora deste ambiente): OBS-1 (quem cancela venda; hoje so o dono), limite de desconto por item x por total (revisao #19), casos MAN-* em aparelho real, Lighthouse em producao, e conferir que as variaveis de emulador nao estao na Vercel.
