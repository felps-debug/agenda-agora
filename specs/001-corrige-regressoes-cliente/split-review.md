# US9 — Parecer do split de pagamentos (ledger interno × split nativo AgPay)

**Data**: 2026-11-06 · Entregável das tasks T053–T056. Base: `src/lib/ledger.server.ts`,
`src/lib/agpay-fees.functions.ts`, `src/lib/platform-settings.server.ts`, migrations
`20260929120000_*` e `20261005120000_withdrawal_platform_fee`.

## 1. Modelo atual (ledger interno)

A plataforma recebe 100% na conta AgPay; o razão interno (`ledger_entries`/`wallets`,
RPCs `ledger_*` com `FOR UPDATE`) aloca cada pagamento:

- **Taxa do gateway** — `gatewayFeeCents(gross) = 0% · gross + R$0,75` fixo
  (R$0,25 AgPay + R$0,50 adquirente, admin AgPay 06/10/2026).
- **Comissão da plataforma** — `platformCommissionCents(gross, percent) = percent%·gross + R$0,00`
  (taxa fixa removida 06/10/2026; percentual configurável por negócio, **hoje 0%**).
- **Líquido do estabelecimento** — `netAmountCents = gross − gateway − comissão`.
- O breakdown é **congelado** por pagamento (colunas `*_snapshot`/`*_cents` em `deposit_payments`);
  nunca é recalculado depois (FR-002). O saque usa taxa fixa de saque (`withdraw_fixed_cents`,
  default R$3,00 — migration `withdrawal_platform_fee`).

**Identidade garantida por construção**: `gross = gateway + comissão + líquido` (SC-010),
testada em `ledger.server.test.ts` ("mantém bruto = líquido + taxa do gateway + comissão").
Idempotência (sem lançamento duplicado) testada em `ledger.refund.test.ts`
(`again.created === false`) e na integração de `ledger.server.test.ts` (asserções por delta).

## 2. Split nativo do AgPay (doc 2026-11-06)

- Existe, mas é **configurado no Dashboard** (Central de Splits), por **e-mail** do recebedor,
  como **regra global** aplicada a transações futuras (valor fixo primeiro, % sobre o líquido);
  crédito instantâneo na carteira do recebedor após `paid`.
- **Sem API de split por transação; sem subconta/marketplace.**

## 3. Decisão: **manter o split interno no ledger** (confirmado)

O split nativo do AgPay (regra global por e-mail no dashboard) **não encaixa** num SaaS
multi-tenant onde cada estabelecimento é um recebedor distinto por transação, e cada negócio
pode ter percentual de comissão próprio. O ledger interno dá:

- controle por transação e por negócio (percentual snapshot por pagamento);
- auditabilidade (razão imutável + RPCs com trava);
- independência do provedor (troca de adquirente não muda o modelo de alocação).

**Alternativas rejeitadas**: split nativo AgPay (falta API por transação; regra global não
serve multi-tenant); híbrido (dupla fonte de verdade / dupla contagem).

## 4. Auditoria — achados (T055)

1. **Duas representações da taxa de depósito** (risco de divergência, FR-014):
   - `ledger.server.ts` usa **constante hardcoded** `GATEWAY_FEE_FIXED_CENTS = 75`.
   - `agpay-fees.functions.ts` guarda `agpay_fees.deposit_fixed_cents` em `platform-settings`
     (default **75**), exibida/editável no painel master.
   - **Hoje coincidem (R$0,75)** → sem divergência ativa. Porém, se um master editar a taxa na
     UI, o ledger **não** acompanha (continua 75c) → cobrança real ≠ valor exibido.
   - **Recomendação** (requer aval do responsável — decisão financeira, não aplicada aqui):
     unificar numa única fonte de verdade. Opções: (a) tornar o valor exibido somente-leitura
     refletindo a constante do ledger; ou (b) o ledger ler `agpay_fees` no momento do pagamento
     e **congelar** no snapshot (mantendo `computePaymentBreakdown` puro, recebendo a taxa como
     argumento em vez de constante). Enquanto não decidido, mantidos os 75c coincidentes.

2. **Dashboard AgPay (T054) — ação externa pendente**: confirmar que **não há regra de split
   ativa** na Central de Splits da conta AgPay. Se houver, o AgPay creditaria direto o recebedor
   e o ledger contaria de novo → **dupla contagem**. Não verificável por código (acesso ao
   dashboard do provedor). **Bloqueio externo**: pedir ao responsável/AgPay a confirmação.
   Premissa atual: nenhuma regra de split configurada (crédito 100% na conta da plataforma),
   coerente com o modelo interno.

3. **Comissão da plataforma hoje = 0%** e taxa fixa = R$0,00: a plataforma, no momento, só
   retém a taxa do gateway (repassada ao adquirente) no depósito e a taxa fixa de saque
   (R$3,00). Sem receita de comissão por ora — intencional conforme config atual.

## 5. Consistência DB/backend (T056)

- **Nenhuma mudança de schema**: a decisão é manter o modelo atual; `ledger_entries`/`wallets`
  e as migrations existentes já o suportam.
- **Sem cálculo duplicado**: o líquido é derivado uma vez (`netAmountCents`) e persistido; o
  webhook `agpay-webhook` credita via `ledger_credit_payment` idempotente (chave
  `payment_credit:<paymentId>`).
- **Pré-requisito para US7**: a cobrança de assinatura por Pix (T037–T039) reusa o ledger; como
  a identidade de split está íntegra e idempotente, não há risco de dupla contagem ao lançar a
  renovação — a assinatura é lançada como entrada própria, sem reusar o breakdown de sinais.

## 6. Pendências

- [ ] **Externo (T054)**: confirmar ausência de regra de split no Dashboard AgPay.
- [ ] **Produto (T055 rec.)**: decidir sobre unificar a fonte da taxa de depósito
      (hardcoded × `agpay_fees`). Não aplicado sem aval (mexe em dinheiro).
