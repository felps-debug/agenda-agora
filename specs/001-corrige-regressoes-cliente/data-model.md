# Phase 1 — Data Model

Entidades afetadas pela feature. A maioria já existe; destaques do que muda.

## Existentes (sem mudança de schema)

- **business / establishment** — contexto carregado uma vez e compartilhado (US2). Cache estável espelhado em `localStorage` (não altera o schema; é cache de leitura).
- **service** — possui `image_path` (US4). Sem mudança de schema; muda só a validação/conversão antes do upload ao bucket de Storage.
- **niche assets** — não são tabela; são arquivos em `public/templates/<nicho>/...` (US1). Entidade lógica `NicheAsset { id, title, kind: template|foto, image }`.
- **broadcast / aviso** — já existe (`broadcasts.functions.ts`): `{ id, title, message, createdAt, audiences?, displayDays?, accent?, icon? }` (US3). Sem mudança de schema.

## Estado de "aviso visto" (US3) — client-side

- **BroadcastSeenState** (localStorage, não DB):
  - `broadcasts-seen`: timestamp do último "tudo visto" (abrir o sino) — já existe.
  - **Novo**: `broadcasts-dismissed`: conjunto de `broadcast.id` dispensados via X do popup.
  - Regra: popup só aparece se `createdAt > seen` **e** `id ∉ dismissed`. Carregado sincronamente no estado inicial.

## Assinatura / cobrança (US7) — possível mudança de schema

- **subscription (business.access_until)** — fonte da validade; renovada ao confirmar pagamento.
- **Novo (a confirmar após research do AgPay)**: tabela de **cobranças de assinatura** `subscription_charges`:
  - `id`, `business_id`, `method` (`pix` | `card`), `provider_payment_id`, `amount_cents`, `status` (`pending`|`paid`|`failed`|`expired`), `period_start`, `period_end`, `created_at`.
  - Idempotência no webhook via `provider_payment_id` (reusar padrão da inbox AgPay existente).
  - Ao `paid`: estende `access_until` em 30 dias e registra no ledger.
  - *Só criar a migration se o AgPay suportar o fluxo; caso contrário, revisar com o responsável.*

## Backend de paridade (US8)

- Sem novas entidades próprias; religa módulos existentes na referência (endurecimento, lifecycle-settings, platform-settings, agpay-fees/performance). Validar RLS de cada tabela tocada ao portar.

## Regras de validação (derivadas dos requisitos)

- Imagem de serviço: aceitar imagem válida (incl. HEIC→convertida); recusar não-imagem; ≤ 5 MB após conversão (FR-005/006/007).
- Aviso: unicidade por `id` + sessão/usuário (FR-004).
- Cobrança de assinatura: não renovar `access_until` sem `status=paid` (FR-010).
