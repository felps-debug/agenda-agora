import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Custo do gateway por depósito: R$ 0,75 fixos, sem percentual (R$ 0,25 da AgPay + R$ 0,50 do
 * adquirente, definido no admin da AgPay em 06/10/2026). Se a taxa mudar lá, mude aqui junto.
 */
const GATEWAY_FEE_PERCENT = 0;
const GATEWAY_FEE_FIXED_CENTS = 75;
/** Taxa fixa da plataforma por transação: removida (R$ 0,00) em 06/10/2026. */
export const PLATFORM_FLAT_FEE_CENTS = 0;

export function gatewayFeeCents(grossCents: number): number {
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new Error("O valor bruto deve ser um inteiro em centavos, não negativo.");
  }
  return Math.round(grossCents * GATEWAY_FEE_PERCENT) + GATEWAY_FEE_FIXED_CENTS;
}

/** Percentual configurável por negócio (hoje 0%) somado à taxa fixa da plataforma. */
export function platformCommissionCents(grossCents: number, percent: number): number {
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new Error("O valor bruto deve ser um inteiro em centavos, não negativo.");
  }
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100) {
    throw new Error("O percentual de comissão deve estar entre 0 e 100.");
  }
  return Math.round((grossCents * percent) / 100) + PLATFORM_FLAT_FEE_CENTS;
}

export type PaymentBreakdown = {
  grossCents: number;
  gatewayFeeCents: number;
  platformCommissionPercentSnapshot: number;
  platformCommissionFlatCents: number;
  platformCommissionCents: number;
  netAmountCents: number;
};

/** Decomposição congelada de um pagamento; o líquido nunca é recalculado depois (FR-002). */
export function computePaymentBreakdown(grossCents: number, percent: number): PaymentBreakdown {
  const gateway = gatewayFeeCents(grossCents);
  const commission = platformCommissionCents(grossCents, percent);
  return {
    grossCents,
    gatewayFeeCents: gateway,
    platformCommissionPercentSnapshot: percent,
    platformCommissionFlatCents: PLATFORM_FLAT_FEE_CENTS,
    platformCommissionCents: commission,
    netAmountCents: grossCents - gateway - commission,
  };
}

type Db = SupabaseClient<Database>;

type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
type Rpc = <T>(name: string, args: Record<string, unknown>) => RpcResult<T>;

// As funções ledger_* vivem na migration 20260929120000; os tipos gerados só passam a
// conhecê-las depois de regenerar o schema, então a chamada é tipada aqui na borda.
function rpc(db: Db): Rpc {
  return db.rpc.bind(db) as unknown as Rpc;
}

async function callRpc<T>(db: Db, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(db)<T[]>(name, args);
  if (error) throw new Error(`Falha no ledger (${name}): ${error.message}`);
  const row = data?.[0];
  if (!row) throw new Error(`Falha no ledger (${name}): resposta vazia.`);
  return row;
}

export type LedgerWriteResult = { entryId: string; created: boolean };

type WriteRow = { entry_id: string; created: boolean };

function toWriteResult(row: WriteRow): LedgerWriteResult {
  return { entryId: row.entry_id, created: row.created };
}

export async function creditPayment(
  db: Db,
  input: {
    businessId: string;
    paymentId: string;
    amountCents: number;
    description: string;
    metadata?: Record<string, unknown>;
  },
): Promise<LedgerWriteResult> {
  const row = await callRpc<WriteRow>(db, "ledger_credit_payment", {
    _business_id: input.businessId,
    _payment_id: input.paymentId,
    _amount_cents: input.amountCents,
    _idempotency_key: `payment_credit:${input.paymentId}`,
    _description: input.description,
    _metadata: input.metadata ?? {},
  });
  return toWriteResult(row);
}

export type WithdrawalRequestResult = {
  entryId: string | null;
  accepted: boolean;
  availableCents: number;
};

export async function requestWithdrawal(
  db: Db,
  input: { businessId: string; withdrawalId: string; amountCents: number },
): Promise<WithdrawalRequestResult> {
  const row = await callRpc<{
    entry_id: string | null;
    accepted: boolean;
    available_cents: number;
  }>(db, "ledger_request_withdrawal", {
    _business_id: input.businessId,
    _withdrawal_id: input.withdrawalId,
    _amount_cents: input.amountCents,
    _idempotency_key: `withdrawal_debit:${input.withdrawalId}`,
  });
  return { entryId: row.entry_id, accepted: row.accepted, availableCents: row.available_cents };
}

export async function reverseWithdrawal(
  db: Db,
  input: { businessId: string; withdrawalId: string; amountCents: number },
): Promise<LedgerWriteResult> {
  const row = await callRpc<WriteRow>(db, "ledger_reverse_withdrawal", {
    _business_id: input.businessId,
    _withdrawal_id: input.withdrawalId,
    _amount_cents: input.amountCents,
    _idempotency_key: `withdrawal_reversal:${input.withdrawalId}`,
  });
  return toWriteResult(row);
}

export type WithdrawalOutcome = "paid" | "failed" | "canceled";

/**
 * Ponto único de conclusão de saque (webhook, ação do Master, falha síncrona do cashout).
 * Atômico e idempotente: `changed = false` quando o saque já estava concluído.
 */
export async function settleWithdrawal(
  db: Db,
  input: { withdrawalId: string; outcome: WithdrawalOutcome; providerRef?: string | null },
): Promise<{ changed: boolean; finalStatus: string }> {
  const row = await callRpc<{ changed: boolean; final_status: string }>(
    db,
    "ledger_settle_withdrawal",
    {
      _withdrawal_id: input.withdrawalId,
      _outcome: input.outcome,
      _provider_ref: input.providerRef ?? null,
    },
  );
  return { changed: row.changed, finalStatus: row.final_status };
}

export async function debitRefund(
  db: Db,
  input: { businessId: string; paymentId: string; amountCents: number; description: string },
): Promise<LedgerWriteResult> {
  const row = await callRpc<WriteRow>(db, "ledger_debit_refund", {
    _business_id: input.businessId,
    _payment_id: input.paymentId,
    _amount_cents: input.amountCents,
    _idempotency_key: `refund_debit:${input.paymentId}`,
    _description: input.description,
  });
  return toWriteResult(row);
}

export async function createAdjustment(
  db: Db,
  input: { businessId: string; amountCents: number; idempotencyKey: string; description: string },
): Promise<LedgerWriteResult> {
  const row = await callRpc<WriteRow>(db, "ledger_adjustment", {
    _business_id: input.businessId,
    _amount_cents: input.amountCents,
    _idempotency_key: input.idempotencyKey,
    _description: input.description,
  });
  return toWriteResult(row);
}
