# Contracts — 002 Correção de regressões + rede de QA

Contratos internos (TanStack Start server functions e módulos). Formato: entrada → saída + regras. Nenhuma API pública externa nova.

## US1 — Avisos (client-side, sem servidor)

### `lib/avisos-store.ts` (NOVO)

- `avisoMarker(tipo, estagio, date=hoje): string` → marcador determinístico `"{tipo}:{estagio}:{YYYY-MM-DD}"`.
- `readDismissed(tipo?): Set<string>` → lê marcadores dispensados do `localStorage`.
- `dismissAviso(tipo, estagio, date=hoje): void` → grava marcador; respeita limite defensivo; nunca lança.
- `shouldShowAviso(tipo, estagio, date=hoje): boolean` (pura) → `true` se marcador não está dispensado.
- **Regra**: SSR-safe (sem `window` no servidor → retorna defaults). Testável sem React (função pura + storage injetável, como `notifications-store.ts`).

### `components/painel/AvisoCobranca.tsx` (ALTERA)

- Passa a consultar `shouldShowAviso("cobranca", stage)` para decidir exibição e chamar `dismissAviso("cobranca", stage)` no fechar, em vez de só estado local `fechado`.
- **Contrato de comportamento**: fechado → não reaparece em navegação nem F5 no mesmo dia/estágio; reaparece ao mudar `stage` ou virar o dia.

## US2 — Impersonação / config (ALTERA existentes)

### `lib/lifecycle.functions.ts`

- `impersonateBusinessOwner` / `returnToMasterSession`: **sem mudança de contrato de entrada/saída**. Correções: garantir que `getAllowedAppOrigins()` inclua a origem real (via config/healthcheck) e reduzir a latência de entrada no Painel 2 (perf no boot da rota, não no contrato).

### `lib/env-security.server.ts`

- `getMasterSecurityPin()` / `getMasterReturnPin()`: inalterados em assinatura; os **valores de ambiente** passam a `41410070` na VPS (Q2).
- **NOVO** `assertProductionConfig(): { ok: boolean; problems: string[] }` → valida envs obrigatórias (origins contêm `PUBLIC_APP_URL`; PINs presentes/válidos). Usado no healthcheck de boot (US6).

## US4 — Edição da ficha (ALTERA/NOVO server functions)

### `updateBusinessContact` — em `src/lib/master/dossier.functions.ts` (estende `updateBusinessCommercial`)

- **Input**: `{ businessId: uuid, field: "phone"|"name"|"responsavel", value: string }`
- **Guard**: `assertSuperAdmin`.
- **Output**: `{ ok: true }` ou erro com mensagem.
- **Efeito**: `name` atualiza `businesses.name`; `responsavel` atualiza `profiles.full_name` do dono; `phone` sincroniza `businesses.phone`, `profiles.email` e o e-mail sintético do Auth. Registra evento `edicao_ficha` em `master_business_events` (actor_id = master). Se a gravação do telefone falhar após a atualização do Auth, restaura o login anterior.

### `setOwnerPassword` — em `src/lib/reset-password.functions.ts` (ao lado de `resetOwnerPassword`)

- **Input**: `{ businessId: uuid, password: string }`
- **Guard**: `assertSuperAdmin`.
- **Validação**: força mínima — **≥8 caracteres, ao menos uma letra e ao menos um número**; rejeita fraca → erro claro.
- **Efeito**: `auth.admin.updateUserById(ownerId, { password })`; registra evento `troca_senha_dono` (sem o valor da senha).
- **Output**: `{ ok: true }`.

## US6 — Error log + healthcheck (NOVO)

### `logClientError` (NOVO server function)

- **Input**: `{ kind: "ui_error"|"unhandled_rejection"|"request_failed", message: string, source: string, detail?: object }`
- **Guard**: origem permitida e limite de volume no servidor; aceita relato anônimo limitado para rotas públicas. Quando há token, valida a sessão e obtém `user_id` no servidor. A tabela não permite INSERT anônimo direto.
- **Efeito**: INSERT em `client_error_log` com sanitização/truncagem; associa `business_id`/`user_id` do contexto quando houver.
- **Output**: `{ ok: true }` (nunca propaga erro para não cascatear falhas).

### `listClientErrors` (NOVO server function)

- **Input**: `{ limit?: number, cursor?: string, kind?: string }`
- **Guard**: `assertSuperAdmin`.
- **Output**: lista paginada para o painel de erros no Painel 3.

### Coletor client-side (NOVO módulo UI)

- Error boundary React + handlers `window.onerror` / `unhandledrejection` + wrapper que detecta respostas de fetch com status ≥ 400 → chamam `logClientError` (com debounce/dedup para não floodar).

## US6 — Suíte de QA (scripts, não server functions)

### `scripts/qa/` + `npm run qa`

- **Contrato de execução**: sai com código ≠ 0 se encontrar qualquer: erro de console, imagem quebrada, texto inválido (`NaN|undefined|Invalid Date|[object Object]`), regressão nos fluxos cobertos (aviso reaparecendo após fechar; impersonação falhando; agendamento público quebrado).
- **Seed** (`scripts/qa/seed.mjs`): idempotente; cria/garante um negócio de teste dedicado com serviços+fotos, agendamentos e estágios de cobrança. Restrito a negócios de teste; nunca altera dados reais do cliente.
