# Runbook: troca de credenciais da conta Asaas

Contexto: a integração Asaas (`src/lib/asaas.server.ts`) opera com uma conta
**raiz** (root), configurada pelas variáveis de ambiente abaixo, que só é usada
para **provisionar novas subcontas** (`createSubaccount`, chamada por
`provisionAsaasSubaccount` em `src/lib/admin.functions.ts`) e para o webhook
financeiro cadastrado nesse momento. Cada estabelecimento já provisionado tem
sua própria subconta com um `apiKey` **próprio**, gravado cifrado em
`asaas_business_credentials.api_key_encrypted` (ver migration
`20260918010000_...`) — esse `apiKey` da subconta é o que é usado em toda
cobrança/consulta/saque daquele negócio (`createPixCharge`, `fetchPayment`,
`deletePendingPayment`), **não** a `ASAAS_API_KEY` raiz.

Essa separação é a base deste runbook: trocar a conta raiz **não afeta**
estabelecimentos já provisionados, apenas o que acontece **dali pra frente**.

## Variáveis a atualizar no Vercel

| Variável | Efeito da troca |
| --- | --- |
| `ASAAS_API_KEY` | Chave da conta raiz nova. Usada só em `createSubaccount` (provisionar negócio novo) — negócios já existentes continuam usando a própria chave de subconta, já gravada. |
| `ASAAS_ENV` | `sandbox` ou `production`. Confirmar que bate com a conta configurada em `ASAAS_API_KEY` antes de trocar em produção. |
| `ASAAS_MASTER_WALLET_ID` | Carteira que recebe a comissão (`split`) das novas cobranças Pix (`createPixCharge`). Cobranças já criadas antes da troca mantêm o `split` com a wallet **antiga**, gravado no momento da criação — não são retroativamente redirecionadas. |
| `ASAAS_WEBHOOK_TOKEN` | Token que a Agenda Agora exige no header `asaas-access-token` ao validar o webhook recebido (`src/routes/api/public/asaas-webhook.ts`). Trocar exige recadastrar o mesmo token nos webhooks de **cada** subconta que deva notificar a URL nova (ver seção Webhook abaixo). |
| `ASAAS_WEBHOOK_URL` | URL pública que recebe os eventos (`/api/public/asaas-webhook`). Só é usada automaticamente para subcontas criadas **depois** da troca. |
| `ASAAS_WEBHOOK_EMAIL` | E-mail de notificação cadastrado junto ao webhook de subcontas novas. |
| `ASAAS_CREDENTIALS_ENCRYPTION_KEY` | **NUNCA trocar nesta operação.** É a chave AES-256-GCM que cifra o `apiKey` de cada subconta já provisionada (`encryptAsaasApiKey`/`decryptAsaasApiKey`). Trocá-la torna toda credencial já salva ilegível e quebra o financeiro de **todos** os negócios já provisionados, não só o corte da conta raiz. |

## Passo a passo

1. **Antes do corte**: verificar se há sinais Pix pendentes (`deposit_payments`
   com `status` pendente / QR ainda não pago). Não é necessário esperar todos
   expirarem — cobranças pendentes usam a própria subconta do negócio e
   continuam válidas após a troca — mas é um bom momento pra registrar o
   estado atual caso precise comparar depois.
2. Atualizar no Vercel: `ASAAS_API_KEY`, `ASAAS_ENV` (se mudar), `ASAAS_MASTER_WALLET_ID`,
   `ASAAS_WEBHOOK_TOKEN`, `ASAAS_WEBHOOK_URL`, `ASAAS_WEBHOOK_EMAIL`.
   **Não** tocar em `ASAAS_CREDENTIALS_ENCRYPTION_KEY`.
3. Fazer o redeploy.
4. **Smoke test em negócio já existente**: gerar um Pix de teste
   (`generateDepositPix`) num estabelecimento já provisionado antes da troca e
   confirmar que o QR Code/copia-e-cola são emitidos normalmente — isso prova
   que a subconta antiga continua operando com a própria credencial, intacta.
5. **Smoke test em negócio novo**: provisionar um estabelecimento de teste
   (`provisionAsaasSubaccount`) depois da troca e confirmar que a subconta é
   criada sob a conta raiz nova (o `accountId`/`walletId` retornado deve
   pertencer à organização Asaas nova, não à antiga).
6. Monitorar a tabela `asaas_webhook_events` (`status = pending` ou `failed`)
   e o cron que chama `POST /api/public/hooks/asaas-events` logo após o corte,
   pra garantir que os eventos financeiros continuam sendo processados.

## Webhook das subcontas já existentes

O webhook de cada subconta é cadastrado **uma vez**, no momento da criação
(`createSubaccount`, array `webhooks` do `POST /accounts`). Trocar
`ASAAS_WEBHOOK_URL`/`ASAAS_WEBHOOK_TOKEN`/`ASAAS_WEBHOOK_EMAIL` só afeta
subcontas criadas **depois** da troca — as subcontas já existentes continuam
notificando a URL/token antigos até serem atualizadas manualmente (dashboard
Asaas de cada subconta, ou um script dedicado usando o `apiKey` já gravado de
cada uma). Isso está fora do escopo desta feature; se for necessário migrar o
webhook das subcontas antigas também, tratar como tarefa separada.

## Edge case: saque/recebimento em andamento na conta antiga

- **Recebimento (Pix do sinal) em andamento**: como a cobrança usa a chave da
  própria subconta do negócio, ela **não é afetada** pela troca da conta raiz.
  A cobrança segue seu ciclo normal (paga, expirada ou cancelada) com a mesma
  subconta de sempre.
- **Comissão (split) de cobranças criadas antes do corte**: o `split` é
  gravado no momento da criação da cobrança e aponta pra
  `ASAAS_MASTER_WALLET_ID` vigente **naquele momento**. Cobranças criadas
  antes do corte continuam mandando a comissão pra wallet antiga mesmo depois
  da troca — se a wallet antiga for desativada, reconciliar manualmente
  qualquer cobrança pendente criada antes do corte que ainda não tenha sido
  paga.
- **Saque do saldo disponível**: é feito pelo dono diretamente no dashboard da
  própria subconta (fora do código deste projeto — este projeto só grava a
  chave PIX de destino via `saveWithdrawalPixKey`). Não depende da conta raiz
  e não é afetado pela troca.
