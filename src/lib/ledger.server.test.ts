import { describe, expect, it } from "vitest";
import {
  PLATFORM_FLAT_FEE_CENTS,
  computePaymentBreakdown,
  gatewayFeeCents,
  platformCommissionCents,
} from "./ledger.server";

describe("gatewayFeeCents", () => {
  it("cobra R$ 0,75 fixos, qualquer que seja o bruto", () => {
    expect(gatewayFeeCents(10000)).toBe(75);
    expect(gatewayFeeCents(500)).toBe(75);
    expect(gatewayFeeCents(1234)).toBe(75);
  });

  it("aceita bruto zero (só a parte fixa)", () => {
    expect(gatewayFeeCents(0)).toBe(75);
  });

  it("rejeita valores não inteiros ou negativos", () => {
    expect(() => gatewayFeeCents(10.5)).toThrow();
    expect(() => gatewayFeeCents(-1)).toThrow();
  });
});

describe("platformCommissionCents", () => {
  it("cobra só a taxa fixa quando o percentual é 0%", () => {
    expect(platformCommissionCents(10000, 0)).toBe(PLATFORM_FLAT_FEE_CENTS);
    expect(PLATFORM_FLAT_FEE_CENTS).toBe(0);
  });

  it("soma o percentual à taxa fixa", () => {
    expect(platformCommissionCents(10000, 10)).toBe(1000 + PLATFORM_FLAT_FEE_CENTS);
  });

  it("rejeita percentual fora de 0..100 ou bruto inválido", () => {
    expect(() => platformCommissionCents(10000, -1)).toThrow();
    expect(() => platformCommissionCents(10000, 100)).toThrow();
    expect(() => platformCommissionCents(10.5, 0)).toThrow();
  });
});

describe("computePaymentBreakdown", () => {
  it("decompõe R$ 100,00 com comissão 0% em líquido de R$ 99,25", () => {
    expect(computePaymentBreakdown(10000, 0)).toEqual({
      grossCents: 10000,
      gatewayFeeCents: 75,
      platformCommissionPercentSnapshot: 0,
      platformCommissionFlatCents: 0,
      platformCommissionCents: 0,
      netAmountCents: 9925,
    });
  });

  it("sinal de R$ 5,00 fica em R$ 4,25 para o dono", () => {
    expect(computePaymentBreakdown(500, 0).netAmountCents).toBe(425);
  });

  it("mantém bruto = líquido + taxa do gateway + comissão", () => {
    const b = computePaymentBreakdown(5000, 7.5);
    expect(b.netAmountCents + b.gatewayFeeCents + b.platformCommissionCents).toBe(b.grossCents);
  });

  it("grava o percentual usado como snapshot", () => {
    expect(computePaymentBreakdown(5000, 7.5).platformCommissionPercentSnapshot).toBe(7.5);
  });
});

const TEST_BUSINESS_ID = process.env["LEDGER_TEST_BUSINESS_ID"];

// Integração com o banco de dev (opt-in: LEDGER_DB_TESTS=1). O ledger é imutável, então os
// testes usam sempre o negócio dedicado, chaves únicas por execução e asserções por delta.
describe.skipIf(!TEST_BUSINESS_ID || !process.env["SUPABASE_SERVICE_ROLE_KEY"])(
  "ledger.server (integração)",
  () => {
    async function context() {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { creditPayment, requestWithdrawal, settleWithdrawal, computePaymentBreakdown } =
        await import("./ledger.server");
      const wallet = async () => {
        const { data } = await supabaseAdmin
          .from("wallets")
          .select("available_cents, locked_cents")
          .eq("business_id", TEST_BUSINESS_ID!)
          .maybeSingle();
        return { available: data?.available_cents ?? 0, locked: data?.locked_cents ?? 0 };
      };
      const newPayment = async (grossCents: number) => {
        const { data, error } = await supabaseAdmin
          .from("deposit_payments")
          .insert({
            business_id: TEST_BUSINESS_ID!,
            amount_cents: grossCents,
            status: "pago",
            payer_name: "Teste Ledger",
          })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      };
      return {
        db: supabaseAdmin,
        wallet,
        newPayment,
        creditPayment,
        requestWithdrawal,
        settleWithdrawal,
        computePaymentBreakdown,
      };
    }

    it("credita o líquido decomposto e soma na wallet (R$ 100,00 → R$ 99,25)", async () => {
      const t = await context();
      const before = await t.wallet();
      const paymentId = await t.newPayment(10000);
      const breakdown = t.computePaymentBreakdown(10000, 0);

      const result = await t.creditPayment(t.db, {
        businessId: TEST_BUSINESS_ID!,
        paymentId,
        amountCents: breakdown.netAmountCents,
        description: "Sinal de Teste Ledger",
      });

      expect(result.created).toBe(true);
      expect(breakdown.netAmountCents).toBe(9925);
      const after = await t.wallet();
      expect(after.available - before.available).toBe(9925);
      const { data: entry } = await t.db
        .from("ledger_entries")
        .select("type, amount_cents, payment_id")
        .eq("id", result.entryId)
        .single();
      expect(entry).toEqual({ type: "payment_credit", amount_cents: 9925, payment_id: paymentId });
    });

    it("não duplica lançamento nem saldo ao repetir o mesmo pagamento (idempotência)", async () => {
      const t = await context();
      const paymentId = await t.newPayment(5000);
      const input = {
        businessId: TEST_BUSINESS_ID!,
        paymentId,
        amountCents: 4000,
        description: "Sinal repetido",
      };
      const first = await t.creditPayment(t.db, input);
      const afterFirst = await t.wallet();
      const second = await t.creditPayment(t.db, input);
      const afterSecond = await t.wallet();

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.entryId).toBe(first.entryId);
      expect(afterSecond.available).toBe(afterFirst.available);
    });

    it("conclui saque: paid libera o bloqueado; duplicata e failed depois de paid são no-op", async () => {
      const t = await context();
      const paymentId = await t.newPayment(10000);
      await t.creditPayment(t.db, {
        businessId: TEST_BUSINESS_ID!,
        paymentId,
        amountCents: 3000,
        description: "Crédito para saque",
      });
      const { data: withdrawal, error } = await t.db
        .from("withdrawals")
        .insert({
          business_id: TEST_BUSINESS_ID!,
          amount_cents: 3000,
          status: "processing",
          idempotency_key: crypto.randomUUID(),
          pix_key_snapshot: "teste@ledger",
        })
        .select("id")
        .single();
      if (error) throw error;

      const before = await t.wallet();
      const request = await t.requestWithdrawal(t.db, {
        businessId: TEST_BUSINESS_ID!,
        withdrawalId: withdrawal.id,
        amountCents: 3000,
      });
      expect(request.accepted).toBe(true);
      const locked = await t.wallet();
      expect(locked.locked - before.locked).toBe(3000);
      expect(locked.available - before.available).toBe(-3000);

      const paid = await t.settleWithdrawal(t.db, { withdrawalId: withdrawal.id, outcome: "paid" });
      const paidAgain = await t.settleWithdrawal(t.db, {
        withdrawalId: withdrawal.id,
        outcome: "paid",
      });
      const failedLate = await t.settleWithdrawal(t.db, {
        withdrawalId: withdrawal.id,
        outcome: "failed",
      });
      expect([paid.changed, paidAgain.changed, failedLate.changed]).toEqual([true, false, false]);

      const settled = await t.wallet();
      expect(settled.locked).toBe(before.locked);
      expect(settled.available - before.available).toBe(-3000);
    });
  },
);
