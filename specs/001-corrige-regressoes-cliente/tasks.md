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

- [ ] T012 [P] [US2] Teste unit do cache de contexto em `src/lib/business-cache.test.ts`: hidrata de localStorage, revalida, invalida ao trocar de negócio/usuário
- [ ] T013 [P] [US2] E2E em `tests/sidebar-nav.spec.ts`: navegar entre 4+ telas e assertar que "Carregando estabelecimento..." não reaparece após o 1º load

### Implementation US2

- [ ] T014 [US2] Diagnosticar a remontagem: confirmar se `painel.tsx` remonta na navegação (React Query devtools) e corrigir a causa em `src/routes/_authenticated/painel.tsx`/`route.tsx`
- [ ] T015 [US2] Hidratar o contexto do negócio de `localStorage` (cache-first com `initialData`+`staleTime`) em `src/lib/business.tsx`
- [ ] T016 [US2] Persistir dados estáveis do negócio em `localStorage` ao carregar, com chave por usuário/negócio (sem vazar entre contas)

**Checkpoint**: US2 funcional; navegação instantânea.

---

## Phase 5: User Story 3 — Aviso exibido uma única vez (P1)

**Goal**: Popup de aviso aparece uma vez e não repete ao navegar/trocar de aba.
**Independent Test**: ver aviso, fechar no X, navegar várias vezes → não reaparece; aviso novo aparece uma vez.

### Tests US3

- [ ] T017 [P] [US3] Teste unit de `shouldShowPopup(broadcast, { seenAt, dismissedIds })` em `src/lib/broadcast.test.ts`: mostra se `createdAt > seenAt` e `id ∉ dismissedIds`; respeita público-alvo/prazo
- [ ] T018 [P] [US3] E2E em `tests/aviso-once.spec.ts`: disparar aviso, fechar, navegar e assertar não-reaparição; aviso distinto aparece

### Implementation US3

- [ ] T019 [US3] Extrair a lógica de exibição para função pura `shouldShowPopup`/store em `src/lib/notifications-store.ts` (adicionar `broadcasts-dismissed` como set de ids)
- [ ] T020 [US3] Em `src/routes/_authenticated/painel.tsx`: carregar `seenAt`+`dismissedIds` sincronamente (lazy initializer) e marcar como **dispensado ao fechar o popup (X)**, persistindo no localStorage
- [ ] T021 [US3] Remover a dependência de `useRef` em memória como única fonte de "já mostrado"

**Checkpoint**: US3 funcional; sem spam de popup.

---

## Phase 6: User Story 4 — Upload de imagem aceita tudo + converte (P2)

**Goal**: Qualquer imagem comum (incl. HEIC) é aceita/convertida; não-imagem recusada com clareza.
**Independent Test**: enviar PNG/JPEG/WebP/HEIC e um PDF.

### Tests US4

- [ ] T022 [P] [US4] Teste unit em `src/lib/logo.test.ts`: aceita formatos comuns, aciona conversão p/ não-exibível, recusa não-imagem com mensagem clara, aplica limite de 5 MB pós-conversão
- [ ] T023 [P] [US4] E2E em `tests/service-image-upload.spec.ts`: upload de HEIC convertido e PDF recusado em Editar serviço → Imagem

### Implementation US4

- [ ] T024 [US4] Estender `validateLogoFile`/`decodeBusinessImageFile` em `src/lib/logo.ts` para aceitar mais tipos e normalizar via canvas
- [ ] T025 [US4] Conversão HEIC/HEIF via **import dinâmico** de `heic2any` (só quando o tipo for HEIC) em `src/lib/logo.ts`
- [ ] T026 [US4] Ajustar `accept` e textos do input em `src/routes/_authenticated/painel.servicos.tsx` (não travar seleção de formatos válidos)
- [ ] T027 [P] [US4] Aplicar a mesma regra ao upload de logo/foto de profissional (`src/components/painel/ProfessionalPhotoField.tsx`) se compartilham o validador

**Checkpoint**: US4 funcional.

---

## Phase 7: User Story 5 — Rebrand "Carteira" → "Ag Pay" (P2)

**Goal**: Interface exibe "Ag Pay"; sem resquício de "Carteira".
**Independent Test**: percorrer sidebar, topo, Negócios/Recebíveis, pagamento.

### Tests US5

- [ ] T028 [P] [US5] E2E/asserção em `tests/rebrand-agpay.spec.ts`: nenhuma string "Carteira" visível ao dono; rótulo "Ag Pay" presente na sidebar e topo

### Implementation US5

- [ ] T029 [US5] Substituir rótulos "Carteira"→"Ag Pay" na sidebar/topo em `src/routes/_authenticated/painel.tsx` e telas de pagamento (`painel.as-pay.tsx`, recebíveis)
- [ ] T030 [US5] Renomear rota `/painel/carteira-desempenho` → `/painel/agpay-performance` e adicionar **redirect** da rota antiga
- [ ] T031 [P] [US5] Alinhar classe de tema CSS `.carteira-theme`→`.agpay-theme` em `src/styles.css` e limpar resquícios em títulos/tooltips (`head`, textos de ajuda)
- [ ] T031b [US5] Aplicar "Ag Pay" também nas telas do **cliente final** (ex.: pagamento do sinal no agendamento público, `src/components/public-booking/*`) — sem resquício de "Carteira"

**Checkpoint**: US5 funcional.

---

## Phase 8: User Story 6 — Reativar teste do WhatsApp em Integrações (P2)

**Goal**: Botão "Enviar teste" volta e funciona.
**Independent Test**: acionar teste para número autorizado.

### Tests US6

- [ ] T032 [P] [US6] Teste unit/integração de `sendWhatsappTest` em `src/lib/whatsapp-notify.server.test.ts` (mock do provedor): sucesso e erro (não conectado, número inválido)

### Implementation US6

- [ ] T033 [US6] Portar/religar a server function de envio de teste da referência (`src/lib/evolution.server.ts`/`whatsapp-notify.server.ts`)
- [ ] T034 [US6] Repor o acionador "Enviar teste" + feedback de sucesso/erro em `src/routes/_authenticated/painel.integracoes.tsx`

**Checkpoint**: US6 funcional.

---

## Phase 9: User Story 7 — Ag Pay na assinatura: Pix agora, cartão bloqueado (P2)

**Goal**: Pagar a assinatura (30 dias) por **Pix** via Ag Pay e renovar acesso.
**Independent Test**: pagar assinatura por Pix → `access_until` +30d.

### Tests US7

- [ ] T035 [P] [US7] Teste unit de cálculo de cobrança/renovação em `src/lib/subscription.functions.test.ts` (período 30 dias, não renovar sem `paid`)
- [ ] T036 [P] [US7] Teste de banco em `src/lib/subscription-charge.server.test.ts` (`npm run test:db`): criar cobrança Pix, webhook idempotente, renovar `access_until`

### Implementation US7 (Pix)

- [ ] T037 [US7] Criar migration `supabase/migrations/*_subscription_charges.sql` (campos conforme data-model.md: method, provider_payment_id, status, period_start/end)
- [ ] T038 [US7] Implementar `createSubscriptionCharge({ businessId, method: "pix" })` em `src/lib/subscription-charge.server.ts` reusando `createPixCharge` (`agpay.server.ts`) e o **valor/plano de assinatura já configurado no sistema** (localizar e reusar, não hard-codar)
- [ ] T039 [US7] Tratar o evento `deposit.completed` no webhook `src/routes/api/public/agpay-webhook.ts`: ao `paid` de cobrança de assinatura, renovar `access_until` +30d e lançar no ledger
- [ ] T040 [US7] UI de pagamento da assinatura por Pix (QR/código) na tela de assinatura/Ag Pay do dono

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

- [ ] T047 [P] [US8] Reativar/validar a suíte dos módulos religados (rodar `*.test.ts` dos módulos da referência portados) e registrar verdes

### Implementation US8 (guiada pela parity-matrix de T005)

- [ ] T048 [US8] Religar módulos de endurecimento ausentes: `env-security.server`, `login-attempts.server`, `security-pin.functions` (+ telas que os usam)
- [ ] T049 [US8] Religar `reset-password.functions`, `sdr.*`, `lifecycle-settings.functions`, `platform-settings.server`
- [ ] T050 [US8] Religar telas/relatórios financeiros: `agpay-fees.functions`, `agpay-performance.functions`, carteira-config/desempenho (sob o rebrand Ag Pay)
- [ ] T051 [US8] Corrigir cada item "quebrado/faltando" da parity-matrix (autorização ampla no backend), com teste cobrindo o que foi religado

**Checkpoint**: todas as telas funcionais.

---

## Phase 11: User Story 9 — Revisão do split de pagamentos (DB + backend) (P2)

**Goal**: Split (comissão plataforma + taxa gateway + líquido estabelecimento) correto, auditável e consistente com o crédito do provedor; decisão ledger-interno × AgPay-nativo documentada.
**Independent Test**: para uma cobrança paga, `comissão + gateway + líquido = bruto` e os lançamentos do ledger conferem.

**⚠️ Recomendado antes de T037–T039 (US7)**: a cobrança de assinatura reusa o ledger; revisar o split evita dupla contagem.

### Tests US9

- [ ] T052 [P] [US9] Teste de banco em `src/lib/ledger.server.test.ts` (`npm run test:db`): `platformCommissionCents + gateway + net = gross`; ledger bate com o crédito do provedor; sem lançamento duplicado

### Implementation US9

- [ ] T053 [US9] Parecer comparativo ledger interno × split nativo AgPay/VeoPag em `specs/001-corrige-regressoes-cliente/split-review.md` (com decisão e justificativa)
- [ ] T054 [US9] Auditar o Dashboard AgPay/VeoPag (Central de Splits): confirmar que não há regra de split ativa conflitando com o ledger (risco de dupla contagem)
- [ ] T055 [US9] Auditar o cálculo em `src/lib/ledger.server.ts` + taxas em `src/lib/agpay-fees.functions.ts`/`platform-settings` e conferir com as taxas reais cobradas pelo gateway (incl. taxa de cartão/parcelamento da VeoPag)
- [ ] T056 [US9] Aplicar a decisão e alinhar DB (`ledger_entries`/`wallets` + migrations) e backend, sem dupla fonte de verdade

**Checkpoint**: split revisado e consistente.

---

## Phase 12: Polish & Cross-Cutting

- [ ] T057 [P] Remover lixo herdado do repo do cliente (`styles.css.*.bak`, `__tmp_master.mjs`, cópias aninhadas) se presentes na base de trabalho
- [ ] T058 [P] Rodar `npm run lint` e `npm run format`; corrigir apontamentos
- [ ] T059 Rodar a suíte completa: `npm test`, `npm run test:db`, `npm run test:e2e` — tudo verde, sem regressões (SC-009)
- [ ] T060 Executar o `quickstart.md` ponta a ponta e marcar cada história validada

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
