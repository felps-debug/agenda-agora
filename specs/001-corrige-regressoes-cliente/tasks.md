---
description: "Task list — Reconciliação do frontend do cliente com o backend + correção de regressões"
---

# Tasks: Reconciliação do frontend do cliente com o backend + correção de regressões

**Input**: Design em `specs/001-corrige-regressoes-cliente/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: INCLUÍDOS — por pedido explícito do responsável (FR-013/SC-009). Convenção do repo: unit em `*.test.ts(x)` co-localizado; banco via `vitest.db.config.ts` (`npm run test:db`); e2e Playwright em `tests/`.

**Base**: trabalhar sobre `felps-debug/agenda-agora` (backend + 548 assets), portando o frontend do cliente (`cliente-agendaagora/agenda-agora-main`). Autorização ampla para alterar o backend.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Rodar `npm test` na base e registrar o baseline verde (saber o que já passa antes de mexer) — baseline: 3 falhas pré-existentes / 695 ok / 6 skip (ver merge-notes.md)
- [X] T002 Instalar dependência `heic2any` (para conversão HEIC/HEIF — uso via import dinâmico) e registrar no `package.json` — heic2any@0.0.4 (exact), TanStack intacto
- [X] T003 [P] Conferir `.env.local` (incl. `SUPABASE_SERVICE_ROLE_KEY`, UAZAPI/Evolution, `AGPAY_API_TOKEN`) e documentar o que falta para exercitar cada tela — só falta VEOPAG_* (cartão adiado); ver merge-notes.md

---

## Phase 2: Foundational (pré-requisito bloqueante)

**⚠️ Bloqueia o trabalho por história — define a base mesclada e o mapa tela→backend.**

- [X] T004 Estabelecer a base mesclada: frontend do cliente aplicado sobre o backend da referência, numa branch de trabalho (registrar o critério de merge arquivo-a-arquivo em `specs/001-corrige-regressoes-cliente/merge-notes.md`) — base já mesclada (Spec 010); merge-notes.md criado
- [X] T005 Produzir a matriz `tela → server function → status (ok/faltando/quebrado)` para todas as telas do painel/master em `specs/001-corrige-regressoes-cliente/parity-matrix.md` (base para US8) — 0 módulos ausentes
- [X] T006 [P] Confirmar o mapeamento id-de-nicho (frontend) ↔ nome da pasta em `public/templates/` e anotar divergências de acento/caixa — 11 ids casam 1:1 com pastas, sem divergência

**Checkpoint**: base mesclada compila (`npm run build`) e `npm run dev` sobe sem erro de SSR.

---

## Phase 3: User Story 1 — Templates/artes por nicho (P1) 🎯 MVP

**Goal**: Artes voltam a aparecer por nicho no painel.
**Independent Test**: abrir cada nicho em Modelos e ver as artes; vazio só em nicho sem conteúdo.

### Tests US1

- [X] T007 [P] [US1] Teste unit do loader em `src/lib/niche-assets.server.test.ts`: lê artes de `templates-prontos`/`fotos-de-servicos`, ignora pasta ausente, extensões válidas (.png/.jpg/.jpeg/.webp/.avif) — 5/5 verde

### Implementation US1

- [X] T008 [US1] Restaurar os arquivos de arte em `public/templates/<nicho>/{templates-prontos,fotos-de-servicos}/` a partir da referência/backup (todos os nichos) — já presentes (526 imgs, 11 nichos) na base mesclada
- [X] T009 [US1] Ajustar o mapeamento nicho→pasta onde divergir (ex.: "Sobrancelha"→`sobrancelha`) em `src/lib/niche-assets.server.ts`/consumidores — 11 ids casam 1:1, sem ajuste necessário
- [X] T010 [US1] Garantir publicação dos assets no deploy: revisar `.vercelignore`/`.dockerignore` para não excluir `public/templates` — não excluídos; risco de FS serverless registrado em merge-notes.md
- [X] T011 [P] [US1] E2E em `tests/templates.spec.ts`: abrir um nicho com artes e um sem, validar exibição vs estado vazio — parte pública 2/2 verde; UI gated por OWNER_STORAGE_STATE

**Checkpoint**: US1 funcional e testável isolada.

---

## Phase 4: User Story 2 — Navegar sem recarregar + cache localStorage (P1)

**Goal**: Trocar de tela na sidebar sem recarregar o estabelecimento do zero.
**Independent Test**: clicar em várias opções em sequência sem "Carregando estabelecimento...".

### Tests US2

- [X] T012 [P] [US2] Teste unit do cache de contexto em `src/lib/business-cache.test.ts`: hidrata de localStorage, revalida, invalida ao trocar de negócio/usuário — 6/6 verde
- [X] T013 [P] [US2] E2E em `tests/sidebar-nav.spec.ts`: navegar entre 4+ telas e assertar que "Carregando estabelecimento..." não reaparece após o 1º load — spec criado (gated por OWNER_STORAGE_STATE)

### Implementation US2

- [X] T014 [US2] Diagnosticar a remontagem: confirmar se `painel.tsx` remonta na navegação (React Query devtools) e corrigir a causa em `src/routes/_authenticated/painel.tsx`/`route.tsx` — NotificationBell/header ficam fora do `<div key={pathname}>`, não remontam; flash de reload vinha do gate `!roleLoaded` sem cache (corrigido)
- [X] T015 [US2] Hidratar o contexto do negócio de `localStorage` (cache-first com `initialData`+`staleTime`) em `src/lib/business.tsx` — businesses + papel admin com initialData/staleTime 60s
- [X] T016 [US2] Persistir dados estáveis do negócio em `localStorage` ao carregar, com chave por usuário/negócio (sem vazar entre contas) — chaves `agendaagora:businesses:<uid>` / `is-admin:<uid>`

**Checkpoint**: US2 funcional; navegação instantânea.

---

## Phase 5: User Story 3 — Aviso exibido uma única vez (P1)

**Goal**: Popup de aviso aparece uma vez e não repete ao navegar/trocar de aba.
**Independent Test**: ver aviso, fechar no X, navegar várias vezes → não reaparece; aviso novo aparece uma vez.

### Tests US3

- [X] T017 [P] [US3] Teste unit de `shouldShowPopup(broadcast, { seenAt, dismissedIds })` em `src/lib/broadcast.test.ts`: mostra se `createdAt > seenAt` e `id ∉ dismissedIds`; respeita público-alvo/prazo — 6/6 verde (schema real não tem audiences/prazo)
- [X] T018 [P] [US3] E2E em `tests/aviso-once.spec.ts`: disparar aviso, fechar, navegar e assertar não-reaparição; aviso distinto aparece — spec criado (gated por OWNER_STORAGE_STATE)

### Implementation US3

- [X] T019 [US3] Extrair a lógica de exibição para função pura `shouldShowPopup`/store em `src/lib/notifications-store.ts` (adicionar `broadcasts-dismissed` como set de ids) — `broadcast.ts` (pura) + `notifications-store.ts` (seenAt + dismissed)
- [X] T020 [US3] Em `src/routes/_authenticated/painel.tsx`: carregar `seenAt`+`dismissedIds` sincronamente (lazy initializer) e marcar como **dispensado ao fechar o popup (X)**, persistindo no localStorage — X e auto-close (8s) persistem
- [X] T021 [US3] Remover a dependência de `useRef` em memória como única fonte de "já mostrado" — fonte de verdade agora é dismissedIds/seenAt persistidos; shownRef só otimiza o ciclo de refetch

**Checkpoint**: US3 funcional; sem spam de popup.

---

## Phase 6: User Story 4 — Upload de imagem aceita tudo + converte (P2)

**Goal**: Qualquer imagem comum (incl. HEIC) é aceita/convertida; não-imagem recusada com clareza.
**Independent Test**: enviar PNG/JPEG/WebP/HEIC e um PDF.

### Tests US4

- [X] T022 [P] [US4] Teste unit em `src/lib/logo.test.ts`: aceita formatos comuns, aciona conversão p/ não-exibível, recusa não-imagem com mensagem clara, aplica limite de 5 MB pós-conversão — 19/19 verde (6 novos US4)
- [X] T023 [P] [US4] E2E em `tests/service-image-upload.spec.ts`: upload de HEIC convertido e PDF recusado em Editar serviço → Imagem — spec criado (gated por OWNER_STORAGE_STATE)

### Implementation US4

- [X] T024 [US4] Estender `validateLogoFile`/`decodeBusinessImageFile` em `src/lib/logo.ts` para aceitar mais tipos e normalizar — `normalizeImageFile` + `isHeicImage` + `BUSINESS_IMAGE_ACCEPT`
- [X] T025 [US4] Conversão HEIC/HEIF via **import dinâmico** de `heic2any` (só quando o tipo for HEIC) em `src/lib/logo.ts` — `defaultHeicConverter` com `await import("heic2any")`
- [X] T026 [US4] Ajustar `accept` e textos do input em `src/routes/_authenticated/painel.servicos.tsx` (não travar seleção de formatos válidos) — accept amplo + normaliza antes de validar
- [X] T027 [P] [US4] Aplicar a mesma regra ao upload de logo/foto de profissional (`src/components/painel/ProfessionalPhotoField.tsx`) se compartilham o validador — aplicado (mesmo validador)

**Checkpoint**: US4 funcional.

---

## Phase 7: User Story 5 — Rebrand "Carteira" → "Ag Pay" (P2)

**Goal**: Interface exibe "Ag Pay"; sem resquício de "Carteira".
**Independent Test**: percorrer sidebar, topo, Negócios/Recebíveis, pagamento.

### Tests US5

- [X] T028 [P] [US5] E2E/asserção em `tests/rebrand-agpay.spec.ts`: nenhuma string "Carteira" visível ao dono; rótulo "Ag Pay" presente na sidebar e topo — spec criado (gated); inclui teste do redirect da rota antiga
### Implementation US5

- [X] T029 [US5] Substituir rótulos "Carteira"→"Ag Pay" na sidebar/topo em `src/routes/_authenticated/painel.tsx` e telas de pagamento (`painel.as-pay.tsx`, recebíveis) — ~30 strings visíveis em 9 arquivos
- [X] T030 [US5] Rota de performance — **rename revertido**: o guard existente `brand-privacy.test.ts` proíbe "agpay" (compacto) em strings de rotas (a marca permitida é "Ag Pay" com espaço). Slug mantido em `/painel/carteira-desempenho` (URL interna, não é texto de interface); **rótulo visível = "Ag Pay — Performance"**. Se o cliente exigir a URL `agpay-performance`, requer decisão de produto p/ afrouxar o guard de privacidade.
- [X] T031 [P] [US5] limpar resquícios em títulos/tooltips (`head`, textos de ajuda) — titles/og/aria/labels rebrandizados. Classes CSS `.carteira-*` são nomes internos (não-interface) e ficam; só restam comentários de código
- [X] T031b [US5] Aplicar "Ag Pay" também nas telas do **cliente final** — public-booking já não exibe "Carteira" (varredura .tsx/.ts: 0 texto visível)

**Checkpoint**: US5 funcional.

---

## Phase 8: User Story 6 — Reativar teste do WhatsApp em Integrações (P2)

**Goal**: Botão "Enviar teste" volta e funciona.
**Independent Test**: acionar teste para número autorizado.

### Tests US6

- [X] T032 [P] [US6] Teste de `sendTestMessage` em `src/lib/whatsapp.functions.test.ts` (mock do provedor): sucesso e erro (não conectado, número inválido) — 3/3 verde (nome real é `sendTestMessage` em whatsapp.functions.ts)

### Implementation US6

- [X] T033 [US6] Server function de envio de teste — já presente na base (`sendTestMessage` em `whatsapp.functions.ts`, usa `whatsapp-provider.server`/`whatsapp-notify.server`); não precisou religar
- [X] T034 [US6] Acionador "Enviar teste" + feedback de sucesso/erro em `src/routes/_authenticated/painel.integracoes.tsx` — já presente e ligado (campo telefone + mutação + toast)

**Checkpoint**: US6 funcional.

---

## Phase 9: User Story 7 — Ag Pay na assinatura: Pix agora, cartão bloqueado (P2)

**Goal**: Pagar a assinatura (30 dias) por **Pix** via Ag Pay e renovar acesso.
**Independent Test**: pagar assinatura por Pix → `access_until` +30d.

### Tests US7

- [X] T035 [P] [US7] Teste unit de cálculo de renovação (período 30 dias a partir de max(acesso, hoje)) — **já coberto**: `nextAccessAfterPayment` em `billing-cycle.ts` + `billing-cycle.test.ts` (não come dias; atraso desloca p/ hoje+30). Não renovar sem `paid` = o webhook só renova no evento de pago.
- [X] T036 [P] [US7] Teste da cobrança em `src/lib/subscription-charge.server.test.ts` — 6/6: valor (plano+cupom), exige CPF, cria cobrança pendente via AgPay. (Integração de banco ponta-a-ponta contra o DB de ensaio fica como follow-up; a idempotência do webhook segue o mesmo padrão testado do sinal.)

### Implementation US7 (Pix) — ✅ DECISÃO: CPF no cadastro do negócio (2026-11-06)

> Resolvido: o CPF do responsável é guardado em `businesses.owner_cpf` (coletado inline no
> pagamento e salvo) e o e-mail vem do Auth. Gatilho = dono clica "Pagar" em Pagamentos.

- [X] T037 [US7] Migration `supabase/migrations/20261106120000_subscription_charges.sql` (+ `owner_cpf` em businesses) — **aplicada** no Supabase e types regenerados
- [X] T038 [US7] `createSubscriptionCharge({ businessId, method:"pix" })` em `src/lib/subscription-charge.server.ts` — reusa `createPixCharge` + `subscriptionTotalCents` + cupom; valida CPF; e-mail do Auth
- [X] T039 [US7] `confirmSubscriptionCharge` no worker do webhook (`agpay-events.server.ts`): ao pago, renova `access_until` via `nextAccessAfterPayment` (+30d rolante) e grava no histórico `subscription_payments` — idempotente (transição pendente→pago guardada)
- [X] T040 [US7] UI `SubscriptionPixPayment` (QR + copia-e-cola + poll) na tela Pagamentos, com captura inline do CPF (`saveOwnerCpf`)

### Implementation US7 (Cartão via VeoPag) — ⏸️ ADIADO

> **Decisão (2026-11-06): seguir SEM cartão por enquanto.** Falta credencial VeoPag (`X-Client-Id`/`X-Client-Secret`) e confirmar VenoPag==VeoPag com o Guilherme. Pix (T037–T040) é a entrega de pagamento agora. As tarefas abaixo ficam prontas para quando a credencial aparecer (ou se o teste white-label das creds AgPay autenticar na VeoPag).

- [ ] T041 [US7] Adicionar credenciais VeoPag ao ambiente (`.env.local`/deploy): `VEOPAG_CLIENT_ID`, `VEOPAG_CLIENT_SECRET`, base URL
- [ ] T042 [US7] Criar cliente server `src/lib/veopag.server.ts` (auth `X-Client-Id`/`X-Client-Secret`, tratamento por campo `ok`, HTTP sempre 200) — espelhando o padrão de `agpay.server.ts`
- [ ] T043 [P] [US7] Teste de `veopag.server` em `src/lib/veopag.server.test.ts` (mock): `POST /api/cashin` credit_card → `checkout_url`; tratamento de `ok:false`
- [ ] T044 [US7] Estender `createSubscriptionCharge` para `method:"card"` chamando a VeoPag (`/api/cashin`, `payment_method:"credit_card"`), retornando `checkout_url` + parcelas
- [ ] T045 [US7] Webhook da VeoPag: tratar `paid`/aprovado (renovar `access_until` +30d) e `refunded`/`chargedback` (estorno no ledger), idempotente — em `src/routes/api/public/` (novo handler ou estender o existente)
- [ ] T046 [US7] UI: botão "Pagar com cartão" que redireciona ao `checkout_url` e tela de retorno (sucesso/falha) na assinatura

**Checkpoint**: assinatura por Pix e por cartão (VeoPag) funcionais; estornos tratados.

---

## Phase 10: User Story 8 — Backend funcional em todas as telas (P2)

**Goal**: Cada tela do frontend do cliente executa sua ação principal com dados reais.
**Independent Test**: exercitar a ação principal de cada tela.

### Tests US8

- [X] T047 [P] [US8] Validar a suíte dos módulos de paridade — os `*.test.ts` dos módulos (agpay-fees, agpay-performance, security-pin, login-attempts, env-security, reset-password, sdr, lifecycle, platform-overview/dossier etc.) rodam verdes na suíte completa (712+ ok)

### Implementation US8 (guiada pela parity-matrix de T005)

- [X] T048 [US8] `env-security.server`, `login-attempts.server`, `security-pin.functions` — **presentes** na base (0 ausentes na parity-matrix); nada a religar
- [X] T049 [US8] `reset-password.functions`, `sdr.*`, `lifecycle-settings.functions`, `platform-settings.server` — **presentes**; nada a religar
- [X] T050 [US8] `agpay-fees.functions`, `agpay-performance.functions`, carteira-config/desempenho (sob o rebrand Ag Pay) — **presentes** e rebrandizados (US5)
- [X] T051 [US8] parity-matrix sem itens "quebrado/faltando" (0 módulos ausentes nas 27 telas); validação funcional por tela permanece via `verificar` na matriz (exige sessão/dados reais)

**Checkpoint**: todas as telas funcionais.

---

## Phase 11: User Story 9 — Revisão do split de pagamentos (DB + backend) (P2)

**Goal**: Split (comissão plataforma + taxa gateway + líquido estabelecimento) correto, auditável e consistente com o crédito do provedor; decisão ledger-interno × AgPay-nativo documentada.
**Independent Test**: para uma cobrança paga, `comissão + gateway + líquido = bruto` e os lançamentos do ledger conferem.

**⚠️ Recomendado antes de T037–T039 (US7)**: a cobrança de assinatura reusa o ledger; revisar o split evita dupla contagem.

### Tests US9

- [X] T052 [P] [US9] Teste do split em `src/lib/ledger.server.test.ts`: `comissão + gateway + net = gross`; sem lançamento duplicado — **já coberto** (identidade em ledger.server.test.ts:59; idempotência em ledger.refund.test.ts `again.created===false`). **Corrigido** `ledger.refund.test.ts` que falhava no baseline (guarda LEDGER_DB_TESTS ausente → agora pula limpo sob `npm test`)

### Implementation US9

- [X] T053 [US9] Parecer comparativo ledger interno × split nativo AgPay em `specs/001-corrige-regressoes-cliente/split-review.md` — decisão: **manter ledger interno** (AgPay nativo não serve multi-tenant)
- [~] T054 [US9] Auditar o Dashboard AgPay (Central de Splits) — **ação externa pendente** (sem acesso ao dashboard do provedor); documentada em split-review.md §4.2 como pré-requisito a confirmar
- [X] T055 [US9] Auditar `ledger.server.ts` + taxas em `agpay-fees.functions.ts`/`platform-settings` — achado: taxa de depósito em **duas fontes** (constante hardcoded × `agpay_fees`), hoje coincidentes (75c); recomendação de unificação registrada
- [~] T056 [US9] Aplicar a decisão e alinhar DB/backend — decisão (manter ledger) **não exige migration**; consistência/idempotência confirmadas. Unificação da fonte da taxa **requer aval** (decisão financeira) — não aplicada; registrada em split-review.md §6

**Checkpoint**: split revisado e consistente.

---

## Phase 12: Polish & Cross-Cutting

- [X] T057 [P] Remover lixo herdado — **removido `public/__tmp_master_session.json`** (⚠️ continha sessão Supabase real — access/refresh token — commitada e em `public/`; ver nota de segurança). Nenhum `*.bak`/`__tmp_master.mjs` presente.
- [X] T058 [P] `npm run lint`/`format` — meus arquivos formatados com prettier. Repo tem ~4.8k apontamentos prettier **pré-existentes** (296 arquivos); reformatar tudo está fora de escopo (geraria diff gigante/risco). Lint sem erros de código nos meus arquivos.
- [X] T059 Suíte completa: `npm test` **728 ok / 0 falhas / 8 skip** (baseline tinha 3 falhas — zeradas; +~40 testes novos). `npm run test:db` (tests/db/**) e `npm run test:e2e` (painel) exigem DB de ensaio/sessão de dono — não executáveis nesta sessão; e2e públicos de US1 verdes.
- [~] T060 `quickstart.md` ponta a ponta — validação manual por tela exige sessão de dono/Master com dados reais (não disponível nesta sessão); testes automatizados cobrem a lógica.

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2, bloqueante)** → histórias.
- Após o Foundational, **US1, US2, US3** (todas P1) podem ir em paralelo; **US4–US8** (P2) em seguida.
- **US5** (rebrand) e **US7/US8/US9** (financeiro) se tocam na área "Ag Pay" — coordenar `painel.tsx`/telas de pagamento para evitar conflito no mesmo arquivo.
- **US9 (split) antes de US7**: a cobrança de assinatura reusa o ledger; revisar o split primeiro evita dupla contagem.
- **US7-cartão (T041–T046)**: via **VeoPag** (adquirente do AgPay); só precisa das **credenciais VeoPag** — não é mais bloqueio externo, é integração de um segundo fluxo (checkout hospedado). Pix (T037–T040) segue independente.
- **Polish (P12)** por último.

## Parallel Opportunities

- T003/T006 [P]; testes [P] de cada história; T011/T013/T018/T022/T023/T028 (e2e em arquivos distintos).
- US1, US2, US3 em paralelo após Foundational (arquivos majoritariamente distintos: `public/templates`, `business.tsx`, `notifications-store.ts`).

## Implementation Strategy

- **MVP** = Setup + Foundational + **US1** (templates voltam). Validar e demonstrar.
- **Incremental**: US2 → US3 (matam o "spam de popup"/reload reclamado pelo cliente) → US4 → US5 (rebrand) → US6 → US7-Pix → US8.
- Commit por tarefa ou grupo lógico; parar nos checkpoints para validar cada história isolada.

## Notes

- Cartão (US7) permanece requisito, entrega adiada até o AgPay expor a API.
- Testes antes da implementação em cada história (TDD): escrever, ver falhar, implementar.
- Não atualizar pacotes TanStack fixados.

---

## Phase 13: Convergence

> Gerada por `/speckit-converge` (2026-11-07). Lacunas entre o estado atual do código e
> spec/plan/tasks. Ordenado por severidade (CRITICAL/HIGH primeiro). Cartão (T041–T046)
> não é re-listado: continua bloqueado por credencial VeoPag.

- [ ] T061 CRITICAL: rotacionar/invalidar no Supabase o token da sessão que estava em `public/__tmp_master_session.json` e expurgar o arquivo do histórico git (o arquivo foi removido do working tree em T057, mas permanece no histórico e o token segue válido) — per `plan: "segredos só em .env.local/ambiente"` (contradicts) — ⏳ **deixado por último (ação operacional: dashboard Supabase + git filter-repo); fazer ao final**
- [X] T062 HIGH: renovação de `access_until` agora **idempotente/auto-curável** em `confirmSubscriptionCharge` — aplica o alvo (`period_end` congelado, via `max`, nunca encurta nem soma 2×) antes/independente da transição `pending→pago`; histórico virou best-effort. Testes: 4 casos em `agpay-events.server.test.ts` (renova, retry não duplica, auto-cura paid-sem-acesso, não encurta)
- [X] T063 MEDIUM: `SubscriptionPixPayment` lança erro claro quando `qrCode` vem vazio (mantém o botão para tentar de novo) em vez do card morto
- [ ] T064 MEDIUM: teste de banco (ensaio, `npm run test:db`) ponta-a-ponta do fluxo Pix de assinatura — **follow-up**: coberto no nível unit (createSubscriptionCharge 6 + confirmSubscriptionCharge 4); o teste de ensaio exige a infra de DB descartável (não executável nesta sessão)
- [X] T065 LOW: verificado — o agendamento público **não exibe marca de carteira** ("Carteira"/"Ag Pay"/"saldo" ausentes em `public-booking`); o sinal é genérico ("via Pix"), alinhado ao guard de privacidade. Nenhuma mudança necessária
- [ ] T066 LOW: unificar a fonte da taxa de depósito — **pende aval** (decisão financeira; documentado em split-review.md §6). Não aplicado sem sign-off
