import { describe, expect, it } from "vitest";

const TEST_BUSINESS_ID = process.env["LEDGER_TEST_BUSINESS_ID"];

// Integração com o banco de dev (opt-in: LEDGER_DB_TESTS=1). Garante FR-006/SC-003: solicitações de
// saque concorrentes nunca somam mais que o saldo disponível (proteção contra double-spending).
describe.skipIf(!TEST_BUSINESS_ID || !process.env["SUPABASE_SERVICE_ROLE_KEY"])(
  "saque concorrente (integração)",
  () => {
    async function setup() {
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const { createAdjustment, requestWithdrawal, settleWithdrawal } =
        await import("./ledger.server");
      const wallet = async () => {
        const { data } = await db
          .from("wallets")
          .select("available_cents, locked_cents")
          .eq("business_id", TEST_BUSINESS_ID!)
          .maybeSingle();
        return { available: data?.available_cents ?? 0, locked: data?.locked_cents ?? 0 };
      };
      // A carteira de teste acumula sobras (e pode estar negativa após o teste de estorno):
      // garante um piso de saldo com um ajuste positivo antes de cada rodada.
      const ensureAvailableAtLeast = async (floorCents: number) => {
        const { available } = await wallet();
        if (available >= floorCents) return;
        await createAdjustment(db, {
          businessId: TEST_BUSINESS_ID!,
          amountCents: floorCents - available,
          idempotencyKey: `test-topup:${crypto.randomUUID()}`,
          description: "Ajuste de teste de concorrência",
        });
      };
      const newWithdrawal = async (amountCents: number) => {
        const { data, error } = await db
          .from("withdrawals")
          .insert({
            business_id: TEST_BUSINESS_ID!,
            amount_cents: amountCents,
            status: "requested",
            idempotency_key: crypto.randomUUID(),
            pix_key_snapshot: "teste@ledger",
          })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      };
      return {
        db,
        wallet,
        ensureAvailableAtLeast,
        newWithdrawal,
        requestWithdrawal,
        settleWithdrawal,
      };
    }

    it("só aceita o que cabe no saldo quando 6 saques disparam ao mesmo tempo", async () => {
      const t = await setup();
      for (let round = 0; round < 3; round++) {
        await t.ensureAvailableAtLeast(20000);
        const before = await t.wallet();
        // 4 * amount > available: no máximo 3 cabem; com 6 pedidos, 3+ precisam ser recusados.
        const amount = Math.floor(before.available / 4) + 1;
        const expectedAccepted = Math.floor(before.available / amount);
        expect(expectedAccepted).toBeGreaterThanOrEqual(1);
        expect(expectedAccepted).toBeLessThan(6);

        const ids = await Promise.all(Array.from({ length: 6 }, () => t.newWithdrawal(amount)));
        const results = await Promise.all(
          ids.map((withdrawalId) =>
            t.requestWithdrawal(t.db, {
              businessId: TEST_BUSINESS_ID!,
              withdrawalId,
              amountCents: amount,
            }),
          ),
        );

        const accepted = results.filter((r) => r.accepted);
        expect(accepted).toHaveLength(expectedAccepted);
        const after = await t.wallet();
        expect(after.locked - before.locked).toBe(accepted.length * amount);
        expect(after.available).toBe(before.available - accepted.length * amount);
        expect(after.available).toBeGreaterThanOrEqual(0);

        // Limpeza lógica: devolve os aceitos ao saldo e cancela os recusados.
        await Promise.all(
          ids.map((withdrawalId, index) =>
            t.settleWithdrawal(t.db, {
              withdrawalId,
              outcome: results[index]!.accepted ? "failed" : "canceled",
            }),
          ),
        );
        const settled = await t.wallet();
        expect(settled.locked).toBe(before.locked);
        expect(settled.available).toBe(before.available);
      }
    });

    it("mesma solicitação repetida (retry) não debita duas vezes", async () => {
      const t = await setup();
      await t.ensureAvailableAtLeast(20000);
      const before = await t.wallet();
      const withdrawalId = await t.newWithdrawal(5000);
      const input = { businessId: TEST_BUSINESS_ID!, withdrawalId, amountCents: 5000 };

      const [a, b] = await Promise.all([
        t.requestWithdrawal(t.db, input),
        t.requestWithdrawal(t.db, input),
      ]);

      expect(a.accepted && b.accepted).toBe(true);
      expect(a.entryId).toBe(b.entryId);
      const after = await t.wallet();
      expect(after.locked - before.locked).toBe(5000);
      await t.settleWithdrawal(t.db, { withdrawalId, outcome: "failed" });
    });
  },
);
