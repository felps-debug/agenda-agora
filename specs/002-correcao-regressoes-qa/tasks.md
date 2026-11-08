---
description: "Task list — 002 Correção de regressões do cliente + rede de QA"
---

# Tasks: Correção de regressões do cliente + rede de QA

**Input**: Design documents from `/specs/002-correcao-regressoes-qa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-functions.md, quickstart.md

**Tests**: incluídos onde agregam valor — testes unitários de lógica pura (avisos-store, força de senha) e a suíte de QA E2E (US6 é, por natureza, entrega de testes).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US6 (rastreabilidade)
- Caminhos de arquivo são exatos

## Path Conventions

Projeto único TanStack Start: `src/` (UI + server functions), `supabase/migrations/`, `scripts/qa/`, testes Vitest ao lado do arquivo (`*.test.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding mínimo para a suíte de QA e o seed.

- [x] T001 Criar pasta `scripts/qa/` e adicionar script `"qa": "node scripts/qa/run.mjs"` em `package.json`
- [x] T002 [P] Garantir `ALLOWED_APP_ORIGINS=http://localhost:3002` em `.env.local` (destrava impersonação em dev) e documentar em `.env.example`
- [x] T003 [P] Criar esqueleto do seed idempotente em `scripts/qa/seed.mjs` (apenas estrutura + guarda "só negócios de teste dedicados", sem lógica de dados ainda)

**Checkpoint**: estrutura de QA existe; stories podem começar.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infra compartilhada usada por várias stories.

**⚠️ CRITICAL**: concluir antes das validações de QA (US6) que dependem destes helpers.

- [x] T004 [P] Criar helpers Playwright compartilhados em `scripts/qa/helpers.mjs` (login dono, login master com retry, navegação por link da sidebar, coleta de console errors/imagens quebradas/textos inválidos)
- [x] T005 [P] Criar util de data local `YYYY-MM-DD` em `src/lib/day-key.ts` (usado pelo store de avisos; SSR-safe)

**Checkpoint**: helpers prontos.

---

## Phase 3: User Story 1 - Avisos não reaparecem após fechados (Priority: P1) 🎯 MVP

**Goal**: Fechar qualquer aviso automático e ele não volta em navegação nem F5, até mudar estágio/dia.

**Independent Test**: Logar dono com plano vencido, fechar o aviso de cobrança, navegar + F5 → não reaparece no mesmo dia/estágio.

- [x] T006 [P] [US1] Criar store genérico de dispensa em `src/lib/avisos-store.ts`: marcador determinístico `"{tipo}:{estagio}:{YYYY-MM-DD}"` (tipo ∈ `broadcast|cobranca|trial`), funções `avisoMarker`, `readDismissed(tipo?)`, `dismissAviso(tipo,estagio,date=hoje)`, `shouldShowAviso(tipo,estagio,date=hoje)`; SSR-safe (sem `window` → defaults), limite defensivo de 200 marcadores, nunca lança em storage indisponível
- [x] T007 [P] [US1] Teste unitário puro em `src/lib/avisos-store.test.ts`: marcador estável para mesmo (tipo,estágio,dia) e distinto ao mudar qualquer um; dispensa persiste; storage indisponível não lança
- [x] T008 [US1] Alterar `src/components/painel/AvisoCobranca.tsx` para consultar `shouldShowAviso("cobranca", stage)` na exibição e chamar `dismissAviso("cobranca", stage)` no fechar/renovar, substituindo o estado local `fechado` (depende de T006)
- [x] T009 [US1] Alinhar o aviso de broadcast ao store genérico em `src/components/painel/*` (NotificationBell) + `src/lib/notifications-store.ts` / `src/lib/broadcast.ts`, mantendo o comportamento atual (consolidar num único mecanismo) (depende de T006)
- [x] T010 [US1] Auditar demais avisos automáticos (trial e quaisquer outros) em `src/routes/_authenticated/painel.tsx` e aplicar o mesmo padrão; remover qualquer dispensa só-local remanescente

**Checkpoint**: todos os avisos persistem dispensa de forma consistente (reaparecem 1x/dia ou ao mudar estágio).

---

## Phase 4: User Story 2 - Impersonação Painel 3→2 funcional e rápida (Priority: P1)

**Goal**: Do Painel 3, entrar no Painel 2 em modo suporte em ≤3s e voltar com PIN correto.

**Independent Test**: Master abre ficha → "Abrir Painel 2" (entra, FAB aparece) → "Voltar ao Painel Master" com PIN `41410070` → volta ao Painel 3.

- [ ] T011 [US2] **(OPS/DEPLOY — fora do repositório)** Ajustar os PINs de ambiente da VPS para `41410070` (acesso e retorno) no painel do EasyPanel; no repositório, refletir apenas em `.env.example` e documentar em `docs/` que são env-only e não alteráveis por UI (Clarifications Q2). Rastrear a ação de ops separadamente (não é verificável pelo código)
- [x] T012 [US2] Reduzir a latência de entrada no Painel 2: investigar o estado `loading` de `AuthenticatedContent` em `src/routes/_authenticated/route.tsx` após `setSession` + `window.location.href="/painel"` (em `src/components/master/BusinessDossier.tsx`), evitando refetch desnecessário no boot da rota e aproveitando a sessão recém-setada (meta SC-004 ≤3s)
- [x] T013 [US2] Garantir no boot/healthcheck que `ALLOWED_APP_ORIGINS` contém a origem efetiva de acesso (integra com T029); mensagem clara em caso de `ORIGIN_NOT_ALLOWED` no fluxo de `src/lib/lifecycle.functions.ts` (sem mudar o contrato)

**Checkpoint**: impersonação entra rápido, FAB visível, retorno com PIN volta ao Painel 3.

---

## Phase 5: User Story 3 - Navegação sem "recarrega tudo" (Priority: P2)

**Goal**: Navegar entre telas já visitadas não exibe skeleton nem refaz busca completa; imagens não piscam.

**Independent Test**: Dono navega A→B→A com dados frescos → sem `.owner-route-skeleton`, sem refetch completo.

- [x] T014 [US3] Auditar os loaders/queries de rota em `src/routes/_authenticated/painel.*.tsx` e aplicar `staleTime` adequado nas `useQuery`/loaders que hoje refazem busca a cada navegação (evitar refetch com dado fresco)
- [x] T015 [US3] Ajustar a exibição do `RoutePendingSkeleton` em `src/routes/_authenticated/painel.tsx` para só aparecer quando há busca realmente pendente (não com cache fresco), usando `resolvedPathname`/estado de pending
- [x] T016 [US3] Verificar que avatar e fotos de serviço permanecem exibidos na navegação (sem piscar) — confirmar `staleTime` em `src/lib/panel-avatar.ts` e nas queries de imagem de `src/routes/_authenticated/painel.servicos.tsx`

**Checkpoint**: navegação fluida, sem skeleton/refetch com cache fresco.

---

## Phase 6: User Story 4 - Edição inline na ficha + senha com auditoria (Priority: P2)

**Goal**: Equipe edita telefone de login, nome, responsável e senha pela ficha, com persistência e auditoria.

**Independent Test**: Master edita os 4 campos pelo lápis; senha fraca é rejeitada; eventos de auditoria registrados.

- [x] T017 [P] [US4] Migration Supabase em `supabase/migrations/` adicionando os tipos de evento `edicao_ficha` e `troca_senha_dono` (reuso de `master_business_events`; sem armazenar valor de senha)
- [x] T018 [US4] Estender as server functions da ficha em `src/lib/master/dossier.functions.ts` com `updateBusinessContact`: input `{ businessId, field: "phone"|"name"|"responsavel", value }`, guard `assertSuperAdmin`, atualiza `businesses`, registra evento `edicao_ficha` (reusa o padrão de `updateBusinessCommercial`/`addBusinessNote` já existentes) (depende de T017)
- [x] T019 [US4] Adicionar server function `setOwnerPassword` em `src/lib/reset-password.functions.ts` (reusa o fluxo admin de senha já existente): guard `assertSuperAdmin`, **validação de força mínima — ≥8 caracteres, ao menos uma letra e um número** com rejeição clara de senha fraca, `auth.admin.updateUserById(ownerId,{password})`, evento `troca_senha_dono` sem o valor (depende de T017; mesmo arquivo que já contém `resetOwnerPassword`, sequenciar)
- [x] T020 [P] [US4] Teste unitário da validação de força de senha (≥8 chars, ≥1 letra, ≥1 número) em `src/lib/reset-password.functions.test.ts` (rejeita fracas, aceita fortes)
- [x] T021 [US4] UI de edição inline (lápis + salvar) nos campos telefone de login, nome do estabelecimento, nome do responsável e senha em `src/components/master/BusinessDossier.tsx` (consome T018/T019)

**Checkpoint**: ficha editável com auditoria; senha com força mínima.

---

## Phase 7: User Story 5 - Ajustes de interface e correções pontuais (Priority: P3)

**Goal**: Botão de pagar dentro do card; Serviços com `<h1>`; sem warning de key no Funcionamento.

**Independent Test**: Verificar botão dentro do card, `<h1>` em Serviços, console sem warning de key em Funcionamento.

- [x] T022 [P] [US5] Reposicionar o botão de pagar assinatura para dentro do card/pop-up em `src/routes/_authenticated/painel.tsx` (seção `PagamentosView`/assinatura)
- [x] T023 [P] [US5] Adicionar `<h1>` à página `src/routes/_authenticated/painel.servicos.tsx`
- [x] T024 [P] [US5] Corrigir o array JSX sem `key` que dispara o warning do React em `src/routes/_authenticated/painel.funcionamento.tsx`

**Checkpoint**: ajustes de UI aplicados.

---

## Phase 8: User Story 6 - Rede de QA (Priority: P2)

**Goal**: Suíte automatizada + seed + healthcheck + monitoramento que impedem o cliente de achar bug novo.

**Independent Test**: `npm run qa` falha ao detectar regressão/erro; boot recusa config inválida; erro de produção aparece no painel de erros.

### Infra (independente das stories)

- [x] T025 [P] [US6] Migration Supabase em `supabase/migrations/` criando `client_error_log` (`id`, `occurred_at`, `kind` ∈ `ui_error|unhandled_rejection|request_failed`, `message`, `source`, `detail jsonb`, `business_id?`, `user_id?`, `app_version?`) + RLS: INSERT autenticado, SELECT só `super_admin`
- [x] T026 [US6] Server functions `logClientError` e `listClientErrors` em `src/lib/error-log.functions.ts` (sanitização/truncagem; `logClientError` nunca propaga erro; `listClientErrors` guard `assertSuperAdmin`, paginado) (depende de T025)
- [x] T027 [US6] Coletor client-side (error boundary + `window.onerror`/`unhandledrejection` + wrapper de fetch para status ≥400, com dedup/debounce) em `src/components/painel/*` ou `src/lib/error-collector.ts`, chamando `logClientError` (depende de T026)
- [x] T028 [P] [US6] Painel de erros no Painel 3 em nova rota `src/routes/_authenticated/painel.erros.tsx` consumindo `listClientErrors` (depende de T026)
- [x] T029 [P] [US6] Adicionar `assertProductionConfig()` em `src/lib/env-security.server.ts` (valida origens contêm `PUBLIC_APP_URL`; PINs presentes/válidos) e invocá-lo no boot do servidor, falhando/avisando de forma visível

### Suíte + seed

- [x] T030 [US6] Implementar o seed idempotente em `scripts/qa/seed.mjs`: garantir o **negócio de teste dedicado "Teste sdr" (slug `teste-sdr-g1jw`)** com serviços+fotos, agendamentos e os estágios de cobrança; escrita restrita a esse negócio de teste; nunca alterar dados reais do cliente (depende de T003)
- [x] T031 [US6] Runner `scripts/qa/run.mjs` com asserts e exit code ≠0 em qualquer: console error, imagem quebrada, texto inválido (`NaN|undefined|Invalid Date|[object Object]`) ao varrer rotas dono/master/públicas (usa T004)
- [x] T032 [P] [US6] Cenário QA persistência de aviso (fecha → navega → F5, todos os tipos) em `scripts/qa/scenarios/avisos.mjs` (valida US1)
- [x] T033 [P] [US6] Cenário QA impersonação (abrir Painel 2 ≤3s, FAB, retorno com PIN) em `scripts/qa/scenarios/impersonacao.mjs` (valida US2)
- [x] T034 [P] [US6] Cenário QA navegação sem skeleton com cache fresco em `scripts/qa/scenarios/navegacao.mjs` (valida US3)
- [x] T035 [P] [US6] Cenário QA agendamento público (serviço real do seed, estado vazio gracioso) em `scripts/qa/scenarios/agendamento.mjs`

**Checkpoint**: rede de QA operacional e cobrindo os fluxos corrigidos.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T036 Rodar `npm test` (Vitest) e `npm run qa` — ambos verdes
- [x] T037 [P] Executar a validação do `specs/002-correcao-regressoes-qa/quickstart.md` ponta a ponta
- [x] T038 [P] Atualizar `docs/` com envs obrigatórias (ALLOWED_APP_ORIGINS, PINs env-only) e instruções da suíte de QA
- [x] T039 Limpeza: remover scripts exploratórios `scripts/qa-*.mjs` obsoletos substituídos por `scripts/qa/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; fornece helpers para US6.
- **User Stories (Phase 3–8)**: dependem do Foundational.
  - US1, US2, US5 são **independentes** entre si (MVP = US1).
  - US3 é independente; toca `painel.tsx` (atenção a conflito com US1/US5 no mesmo arquivo — sequenciar edições em `painel.tsx`).
  - US4 depende da migration T017.
  - **US6** valida as demais: as tarefas de infra (T025–T029) são independentes; os **cenários** (T032–T035) devem rodar após a story correspondente estar pronta.
- **Polish (Phase 9)**: após as stories desejadas.

### Conflitos de arquivo a sequenciar (não paralelizar entre si)

- `src/routes/_authenticated/painel.tsx`: T010 (US1), T015 (US3), T022 (US5) — editar em sequência.
- `src/lib/reset-password.functions.ts`: T019 (US4) compartilha arquivo com `resetOwnerPassword` — sequenciar edições.

### Parallel Opportunities

- Setup: T002, T003 em paralelo.
- Foundational: T004, T005 em paralelo.
- US1: T006 e T007 em paralelo; T008–T010 após T006.
- US4: T017 primeiro; depois T018 (dossier.functions.ts) e T019 (reset-password.functions.ts) em paralelo (arquivos diferentes); T020 em paralelo; T021 (UI) após T018/T019.
- US5: T022, T023, T024 em paralelo (arquivos diferentes).
- US6 infra: T025 → T026 → T027; T028, T029 em paralelo; cenários T032–T035 em paralelo após suas stories.

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) + Phase 2 (Foundational).
2. Phase 3 (US1 — avisos) → validar independente → é a maior dor do cliente, entrega valor imediato.

### Incremental Delivery (ordem sugerida)

US1 → US2 → US5 (rápidas/altas) → US3 → US4 → US6 (rede de QA fecha e trava regressões). Cada story é entregável e testável de forma independente.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Edições em `painel.tsx` e `business-commercial.functions.ts` são sequenciais (mesmo arquivo).
- Foto do serviço fica **fora de escopo** de correção (não reproduz em dev); US6/monitoramento captura evidência de produção primeiro.
- Commit após cada tarefa ou grupo lógico; validar cada story no seu checkpoint.

## Verificação da implementação — 2026-11-08

As duas migrations foram aplicadas no projeto qagotnmdqjoodoudcikd em uma transação, junto com seus registros no histórico, preservando as versões dos arquivos. A verificação posterior comparou o SQL registrado com os arquivos e confirmou a constraint, a tabela, RLS e as policies. Os gates T036/T037 passaram no ambiente local; T011 permanece como operação de produção separada.

- **US1:** broadcast dispensado permanece fechado após F5. Os quatro estágios dispensáveis de cobrança passaram por fechar → SPA → F5 → marcador de dia expirado. Trial não possui popup dispensável na UI atual; o tipo é coberto pelos testes do store. Armazenamento indisponível, SSR, limite e separação entre negócios estão cobertos.
- **US2:** entrada de suporte em **1956 ms** na execução completa mais recente, indicador visível, retorno com PIN e fechamento do modal. Os PINs locais foram padronizados para 41410070 e o dev reiniciado com heap limitado. Três PINs incorretos ou uma sessão expirada no F5 encerram apenas o acesso gerado, exibem mensagem e levam ao login. A validação de origem permanece no servidor; sessão recém-criada evita uma validação duplicada, mas F5 volta a validar. O modal informa corretamente a faixa de 6 a 12 dígitos. **T011 foi configurada pelo usuário na VPS; o PIN de acesso foi aceito, e o aceite final do retorno aguarda a publicação da correção de domínio.** Evidência em test-results/qa/production-pins.json.
- **US3/US5:** quatro telas com cache fresco passaram sem skeleton/refetch dos dados principais; URLs das imagens permaneceram estáveis. Serviços tem h1, Funcionamento não gera warning de key, e o botão de pagamento está dentro do card, sem gerar cobrança no teste. A projeção compartilhada de business_hours foi alinhada para manter IDs no cache.
- **US4:** UI e funções implementadas, com senha forte compatível com o login, sincronização do telefone em Auth/perfil/negócio, compensação e auditoria sem senha. Guardas, rejeição de senha fraca e gravações/compensação passaram nos testes unitários. O responsável vem de profiles.full_name, não do responsável comercial sales_owner. Após a migration de auditoria, o Playwright editou os quatro campos, rejeitou senha fraca, confirmou o login do dono com a nova credencial e verificou a auditoria sem senha. Os dados e a credencial do dono de teste foram restaurados.
- **US6:** seed idempotente confirmado no negócio dedicado: 2 serviços com imagens, 1 profissional, 7 dias de funcionamento e 2 agendamentos. A fixture recebe sete dias de acesso ativo, sem trial e sem gerar pagamento. O agendamento público e o estado vazio passaram, com restauração dos dados de teste. A rota /painel/erros foi incluída no mapeamento de subdomínios do Master, com cobertura no teste existente de app-hosts. Após a migration, o erro anônimo foi gravado uma única vez e exibido no painel do Master. A QA confirmou pela API as políticas RLS: INSERT anônimo negado, INSERT do dono com identidade própria permitido, leitura do dono/visitante oculta, leitura do Master permitida e ator falsificado negado. Registros temporários removidos. A pré-checagem usa GET; HEAD não é confiável para detectar tabela ausente.
- **Vitest:** **779 aprovados, 8 ignorados**, com um worker por padrão em npm test. Cancelamentos intencionais de fetch preservam a rejeição e não geram falso alerta no coletor. Os novos testes cobrem a decisão de domínio por role e estado do suporte.
- **TypeScript:** checagem com heap de 768 MB dos stores, funções de servidor, coletor, monitor e BusinessDossier passou. O projeto inteiro excedeu o limite de heap; não há certificação de typecheck global.
- **Build de produção:** passou com heap limitado a 768 MB e o dev pausado temporariamente. O smoke no artefato compilado confirmou o coletor automático, a deduplicação, as policies RLS e o painel de erros sem importações do Vite. Os 765 arquivos públicos do build foram verificados sem token ou credenciais privadas. Artefatos em test-results/qa/build-production.log e production-build.json; o dev foi restaurado na porta 3002.
- **QA completa:** **7/7 cenários passaram**, com exit code 0: avisos, navegação, suporte, agendamento, ficha, monitoramento e varredura. As **27 telas/rotas** de dono, Master e públicas passaram, incluindo /painel/erros. O suporte inclui navegação, F5, expiração e três PINs errados. Resultado em test-results/qa/latest.json; log em test-results/qa/qa-support-final.log.
- **Detecção de regressões:** as quatro falhas injetadas somente no navegador foram detectadas: dispensas, suporte, skeleton e confirmação de agendamento. Logs em test-results/qa/regression-*.log; relatos injetados não sobrescrevem o resultado da QA normal.
- **Limpeza:** 15 exploratórios substituídos foram arquivados de forma reversível em test-results/qa/legacy-scripts/. Dois diagnósticos específicos de fotos com dados reais foram preservados, pois a correção de fotos está fora do escopo.
- **Banco e acesso externo:** o token de gerenciamento fornecido permitiu aplicar as duas migrations e executar advisors no alvo. SQL e histórico conferidos; recibos em test-results/qa/migrations-applied.json e migration-verification.json. Nenhum novo achado de segurança; apenas quatro INFO de índices novos ainda sem uso observado. O token está somente no .env.local ignorado, sem cópia nos arquivos versionáveis. Os PINs e origens de produção foram configurados pelo usuário no EasyPanel. O PIN de acesso e o monitoramento público foram aceitos nos testes em produção; o retorno aguarda a correção de domínio publicada.

O quickstart foi validado no ambiente local com o PIN acordado, os fluxos integrados, os testes de configuração e as evidências de detecção de regressões. **38/39 tarefas concluídas; apenas T011 permanece aberta.** Os comandos e o estado da operação de produção estão em [docs/qa-regressions.md](../../docs/qa-regressions.md).

Após o usuário informar o deploy com as variáveis, o PIN de acesso passou no teste de produção. Antes do envio do código desta spec, a main remota ainda estava no commit ae0cac2, e o site não exibia o link do painel de erros nem os controles de edição inline da ficha. O retorno ficou pendente porque o FAB de suporte não apareceu nessa versão antiga. T011 aguarda a verificação do retorno na versão nova; a validação após publicação é separada do aceite local de T036/T037. Evidência em test-results/qa/production-pins.json.

Na validação seguinte, os três hosts já serviam a versão nova. Depois de salvar as origens corretas no EasyPanel, o monitoramento público passou em produção (test-results/qa/production-monitor.json). O suporte entrou em 908 ms, mas um redirecionamento tratava o objeto de status como role válida e enviava o dono de admin para painel, perdendo o contexto de origem. A correção valida isMaster, isola a query por usuário e preserva a origem durante suporte/validação. O novo gate scripts/qa/verify-split-panels.mjs compila com split ativo e testa os três hosts por HTTPS local: passou em 1933 ms, incluindo Serviços, F5, retorno com PIN, sessão expirada e encerramento com três PINs errados. Resultado em test-results/qa/split-panels.json. A validação final de retorno em produção depende da publicação dessa correção.
