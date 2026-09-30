import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type LedgerStatementEntry = {
  id: string;
  type:
    "payment_credit" | "withdrawal_debit" | "withdrawal_reversal" | "refund_debit" | "adjustment";
  /** Valor com sinal, em centavos (crédito positivo, débito negativo). */
  amountCents: number;
  description: string;
  date: string;
  /** Decomposição do pagamento (só em payment_credit). */
  grossCents: number | null;
  gatewayFeeCents: number | null;
  platformCommissionCents: number | null;
  /** Estado e taxa do saque (só em withdrawal_debit / withdrawal_reversal). */
  withdrawalStatus: string | null;
  withdrawalFeeCents: number | null;
};

export type LedgerStatement = {
  availableCents: number;
  pendingCents: number;
  lockedCents: number;
  /** Soma dos líquidos creditados (payment_credit). */
  totalReceivedCents: number;
  /** Cobranças Pix ainda aguardando pagamento (ainda não entraram no ledger). */
  pendingChargesCents: number;
  /** available < 0: novos saques ficam bloqueados até revisão do Master (FR-014). */
  withdrawalsBlocked: boolean;
  entries: LedgerStatementEntry[];
};

const MAX_ENTRIES = 200;

export async function getLedgerStatementForOwner(
  ownerClient: SupabaseClient<Database>,
  userId: string,
  businessId: string,
  range: { from?: string | undefined; to?: string | undefined } = {},
): Promise<LedgerStatement> {
  const { data: business, error } = await ownerClient
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !business) throw new Error("Negócio não encontrado.");

  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  let entriesQuery = db
    .from("ledger_entries")
    .select("id, type, amount_cents, description, created_at, payment_id, withdrawal_id")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(MAX_ENTRIES);
  if (range.from) entriesQuery = entriesQuery.gte("created_at", range.from);
  if (range.to) entriesQuery = entriesQuery.lte("created_at", range.to);

  const [walletRes, entriesRes, creditsRes, pendingRes] = await Promise.all([
    db.from("wallets").select("*").eq("business_id", business.id).maybeSingle(),
    entriesQuery,
    db
      .from("ledger_entries")
      .select("amount_cents")
      .eq("business_id", business.id)
      .eq("type", "payment_credit"),
    db
      .from("deposit_payments")
      .select("amount_cents")
      .eq("business_id", business.id)
      .eq("status", "pendente")
      .gt("expires_at", new Date().toISOString()),
  ]);
  if (walletRes.error || entriesRes.error || creditsRes.error || pendingRes.error)
    throw new Error("Não foi possível carregar o extrato. Tente novamente.");

  const rows = entriesRes.data ?? [];
  const paymentIds = [...new Set(rows.map((row) => row.payment_id).filter(Boolean))] as string[];
  const withdrawalIds = [
    ...new Set(rows.map((row) => row.withdrawal_id).filter(Boolean)),
  ] as string[];

  const [paymentsRes, withdrawalsRes] = await Promise.all([
    paymentIds.length
      ? db
          .from("deposit_payments")
          .select("id, amount_cents, gateway_fee_cents, platform_commission_cents")
          .in("id", paymentIds)
      : Promise.resolve({ data: [], error: null }),
    withdrawalIds.length
      ? db.from("withdrawals").select("id, status, provider_fee_cents").in("id", withdrawalIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentsRes.error || withdrawalsRes.error)
    throw new Error("Não foi possível carregar o extrato. Tente novamente.");

  const payments = new Map((paymentsRes.data ?? []).map((row) => [row.id, row]));
  const withdrawals = new Map((withdrawalsRes.data ?? []).map((row) => [row.id, row]));

  const entries: LedgerStatementEntry[] = rows.map((row) => {
    const payment = row.payment_id ? payments.get(row.payment_id) : undefined;
    const withdrawal = row.withdrawal_id ? withdrawals.get(row.withdrawal_id) : undefined;
    return {
      id: row.id,
      type: row.type as LedgerStatementEntry["type"],
      amountCents: row.amount_cents,
      description: row.description ?? "",
      date: row.created_at,
      grossCents: row.type === "payment_credit" ? (payment?.amount_cents ?? null) : null,
      gatewayFeeCents: row.type === "payment_credit" ? (payment?.gateway_fee_cents ?? null) : null,
      platformCommissionCents:
        row.type === "payment_credit" ? (payment?.platform_commission_cents ?? null) : null,
      withdrawalStatus: withdrawal?.status ?? null,
      withdrawalFeeCents: withdrawal?.provider_fee_cents ?? null,
    };
  });

  const wallet = walletRes.data;
  const availableCents = wallet?.available_cents ?? 0;
  return {
    availableCents,
    pendingCents: wallet?.pending_cents ?? 0,
    lockedCents: wallet?.locked_cents ?? 0,
    totalReceivedCents: (creditsRes.data ?? []).reduce((sum, row) => sum + row.amount_cents, 0),
    pendingChargesCents: (pendingRes.data ?? []).reduce((sum, row) => sum + row.amount_cents, 0),
    withdrawalsBlocked: availableCents < 0,
    entries,
  };
}
