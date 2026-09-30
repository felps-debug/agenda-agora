import { randomUUID } from "node:crypto";
import { loadEnv } from "vite";
import { describe, expect, it } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computePaymentBreakdown,
  creditPayment,
  debitRefund,
  requestWithdrawal,
  reverseWithdrawal,
} from "./ledger.server";

const fileEnv = loadEnv("test", process.cwd(), "");
for (const name of ["LEDGER_TEST_BUSINESS_ID", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[name] && fileEnv[name]) process.env[name] = fileEnv[name];
}

const businessId = process.env["LEDGER_TEST_BUSINESS_ID"];

async function availableCents() {
  const { data, error } = await supabaseAdmin
    .from("wallets")
    .select("available_cents")
    .eq("business_id", businessId!)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.available_cents ?? 0;
}

async function negativeBalanceScenario(
  assertions: (input: {
    paymentId: string;
    netCents: number;
    beforeRefund: number;
    afterRefund: number;
  }) => Promise<void>,
) {
  const initial = await availableCents();
  const grossCents = Math.max(10000, Math.ceil((-initial + 10000) / 0.95));
  const breakdown = computePaymentBreakdown(grossCents, 0);
  const paymentId = randomUUID();
  const withdrawalId = randomUUID();
  const { error: paymentError } = await supabaseAdmin.from("deposit_payments").insert({
    id: paymentId,
    business_id: businessId!,
    provider: "agpay",
    provider_payment_id: `ledger-refund-test:${randomUUID()}`,
    status: "pago",
    amount_cents: grossCents,
    payer_name: "Teste ledger",
    gateway_fee_cents: breakdown.gatewayFeeCents,
    platform_commission_percent_snapshot: 0,
    platform_commission_flat_cents: breakdown.platformCommissionFlatCents,
    platform_commission_cents: breakdown.platformCommissionCents,
    net_amount_cents: breakdown.netAmountCents,
    paid_at: new Date().toISOString(),
  });
  if (paymentError) throw new Error(paymentError.message);

  await creditPayment(supabaseAdmin, {
    businessId: businessId!,
    paymentId,
    amountCents: breakdown.netAmountCents,
    description: "Sinal de teste do ledger",
  });
  const availableForWithdrawal = await availableCents();
  expect(availableForWithdrawal - initial).toBe(breakdown.netAmountCents);
  expect(availableForWithdrawal).toBeGreaterThan(0);

  const { error: withdrawalError } = await supabaseAdmin.from("withdrawals").insert({
    id: withdrawalId,
    business_id: businessId!,
    amount_cents: availableForWithdrawal,
    idempotency_key: `ledger-refund-test:${randomUUID()}`,
    pix_key_snapshot: "ledger-refund-test@example.invalid",
    status: "requested",
  });
  if (withdrawalError) throw new Error(withdrawalError.message);
  const requested = await requestWithdrawal(supabaseAdmin, {
    businessId: businessId!,
    withdrawalId,
    amountCents: availableForWithdrawal,
  });
  expect(requested.accepted).toBe(true);

  let reversed = false;
  try {
    const beforeRefund = await availableCents();
    const refunded = await debitRefund(supabaseAdmin, {
      businessId: businessId!,
      paymentId,
      amountCents: breakdown.netAmountCents,
      description: "Estorno do sinal de teste",
    });
    expect(refunded.created).toBe(true);
    const afterRefund = await availableCents();
    await assertions({ paymentId, netCents: breakdown.netAmountCents, beforeRefund, afterRefund });
  } finally {
    await reverseWithdrawal(supabaseAdmin, {
      businessId: businessId!,
      withdrawalId,
      amountCents: availableForWithdrawal,
    });
    reversed = true;
    const { error } = await supabaseAdmin
      .from("withdrawals")
      .update({ status: "failed" })
      .eq("id", withdrawalId);
    expect(error).toBeNull();
  }
  expect(reversed).toBe(true);
  expect((await availableCents()) - initial).toBe(0);
}

describe.skipIf(!process.env["LEDGER_TEST_BUSINESS_ID"])("estorno no ledger real", () => {
  it("debitRefund registra o líquido original e permite saldo disponível negativo", async () => {
    await negativeBalanceScenario(async ({ paymentId, netCents, beforeRefund, afterRefund }) => {
      expect(afterRefund - beforeRefund).toBe(-netCents);
      expect(afterRefund).toBeLessThan(0);
      const { data, error } = await supabaseAdmin
        .from("ledger_entries")
        .select("type, amount_cents, payment_id, idempotency_key")
        .eq("idempotency_key", `refund_debit:${paymentId}`)
        .maybeSingle();
      if (error) throw new Error(error.message);
      expect(data).toMatchObject({
        type: "refund_debit",
        amount_cents: -netCents,
        payment_id: paymentId,
        idempotency_key: `refund_debit:${paymentId}`,
      });
      const again = await debitRefund(supabaseAdmin, {
        businessId: businessId!,
        paymentId,
        amountCents: netCents,
        description: "Estorno do sinal de teste",
      });
      expect(again.created).toBe(false);
      expect((await availableCents()) - afterRefund).toBe(0);
    });
  });

  it("requestWithdrawal rejeita saque quando o saldo disponível está negativo", async () => {
    await negativeBalanceScenario(async ({ afterRefund }) => {
      expect(afterRefund).toBeLessThan(0);
      const withdrawalId = randomUUID();
      const { error } = await supabaseAdmin.from("withdrawals").insert({
        id: withdrawalId,
        business_id: businessId!,
        amount_cents: 1000,
        idempotency_key: `ledger-negative-test:${randomUUID()}`,
        pix_key_snapshot: "ledger-negative-test@example.invalid",
        status: "requested",
      });
      if (error) throw new Error(error.message);
      const rejected = await requestWithdrawal(supabaseAdmin, {
        businessId: businessId!,
        withdrawalId,
        amountCents: 1000,
      });
      expect(rejected.accepted).toBe(false);
      expect(rejected.entryId).toBeNull();
      expect((await availableCents()) - afterRefund).toBe(0);
      const { error: cancelError } = await supabaseAdmin
        .from("withdrawals")
        .update({ status: "canceled" })
        .eq("id", withdrawalId);
      if (cancelError) throw new Error(cancelError.message);
    });
  });
});
