# Phase 1 — Contratos (server functions & interfaces)

O "contrato" deste app full-stack são as **server functions** (`createServerFn`, validadas por Zod) e os assets servidos. Abaixo, os contratos afetados por história. Formato: entrada → saída → erros.

## US1 — Artes por nicho
- `listNicheAssets()` (GET, existente, `niche-assets.server.ts`)
  - Entrada: — (público). Saída: `Record<nicheId, NicheAsset[]>`. Erro: lista vazia se pasta ausente.
  - **Contrato de conteúdo**: para cada `nicheId` exibido no frontend, deve existir `public/templates/<nicheId>/{templates-prontos,fotos-de-servicos}/` com ≥1 arquivo quando a referência tiver.

## US2 — Contexto do estabelecimento
- `BusinessProvider` (contexto React, `business.tsx`)
  - Contrato: expõe `businessId`, dados do negócio e flags; **não recarrega** entre navegações; hidrata de `localStorage` e revalida em background.

## US3 — Aviso único
- `listBroadcasts()` (GET, existente) — inalterado.
- Contrato client-side de exibição: `shouldShowPopup(broadcast, { seenAt, dismissedIds })` → `boolean`; dispensar (X) adiciona `id` a `dismissedIds` (persistido). Pura e testável.

## US4 — Upload de imagem de serviço
- `validateLogoFile(file, "service")` → `{ valid, extension, message }` (estender formatos aceitos).
- `decodeBusinessImageFile(file)` → `boolean` (decodifica/normaliza; aciona conversão HEIC→jpeg/png quando necessário).
- Contrato: imagem válida (qualquer formato comum) ⇒ `valid:true` após conversão; não-imagem ⇒ `valid:false` + mensagem clara; > 5 MB (pós-conversão) ⇒ erro de tamanho.

## US5 — Rebrand Ag Pay
- Sem contrato de dados; contrato de UI: nenhuma string "Carteira" visível ao dono; rótulo "Ag Pay" consistente. Rotas mantidas estáveis (decisão em research).

## US6 — Teste WhatsApp
- `sendWhatsappTest({ phone })` (server fn, portar da referência — `evolution.server.ts`/`whatsapp-notify.server.ts`)
  - Entrada: `{ phone: string }` (Zod). Saída: `{ ok: true }` | erro claro (não conectado, número inválido, falha do provedor).

## US7 — Cobrança de assinatura (Ag Pay)
- Existente: `createPixCharge({...})` → `PixCharge { providerPaymentId, ... }`.
- **Novo (a confirmar)**: `createSubscriptionCharge({ businessId, method: "pix"|"card" })` → `{ providerPaymentId, method, status }`.
  - `card` depende de o AgPay expor API de cartão (ver research.md).
- Webhook `/api/public/agpay-webhook` (existente, HMAC + idempotente): ao `paid` de uma `subscription_charge`, renovar `access_until` +30d e registrar no ledger.

## US8 — Paridade de backend
- Contrato por tela: cada tela do frontend do cliente mapeia para uma server function existente e funcional. Entregável: matriz `tela → função → status` (na fase de tasks) e religação dos módulos ausentes.

## Testes de contrato (resumo)
- Unit: `shouldShowPopup`, `validateLogoFile`/conversão, mapeamento de nicho, cálculo de cobrança/renovação.
- DB (vitest.db): `createSubscriptionCharge` + webhook idempotente + renovação de `access_until`.
- E2E (Playwright): navegação na sidebar sem reload; upload de HEIC; envio de teste WhatsApp (mock); popup aparece uma vez.
