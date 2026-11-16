import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, seedBasics, uuid, type PgClient, type Seed } from "./helpers";

let db: PgClient;
let seed: Seed;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
});

afterAll(async () => {
  await db.end();
});

describe("integridade do tenant no ledger", () => {
  it("rejeita pagamento de outro negócio e aceita o pagamento do mesmo negócio", async () => {
    const paymentA = uuid();
    const paymentB = uuid();
    await db.query(
      `INSERT INTO public.deposit_payments (id, business_id, amount_cents)
       VALUES ($1, $2, 2500), ($3, $4, 2500)`,
      [paymentA, seed.businessA, paymentB, seed.businessB],
    );

    await expect(
      db.query(
        `INSERT INTO public.ledger_entries (business_id, type, amount_cents, payment_id, idempotency_key)
       VALUES ($1, 'payment_credit', 2500, $2, $3)`,
        [seed.businessA, paymentB, uuid()],
      ),
    ).rejects.toThrow(/business_id/i);

    await expect(
      db.query(
        `INSERT INTO public.ledger_entries (business_id, type, amount_cents, payment_id, idempotency_key)
       VALUES ($1, 'payment_credit', 2500, $2, $3)`,
        [seed.businessA, paymentA, uuid()],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
    await expect(
      db.query("UPDATE public.deposit_payments SET business_id = $1 WHERE id = $2", [
        seed.businessB,
        paymentA,
      ]),
    ).rejects.toThrow(/business_id/i);
  });

  it("rejeita saque de outro negócio e aceita o saque do mesmo negócio", async () => {
    const withdrawalA = uuid();
    const withdrawalB = uuid();
    await db.query(
      `INSERT INTO public.withdrawals (id, business_id, amount_cents, idempotency_key, pix_key_snapshot)
       VALUES ($1, $2, 1000, $3, 'chave-a'), ($4, $5, 1000, $6, 'chave-b')`,
      [withdrawalA, seed.businessA, uuid(), withdrawalB, seed.businessB, uuid()],
    );

    await expect(
      db.query(
        `INSERT INTO public.ledger_entries (business_id, type, amount_cents, withdrawal_id, idempotency_key)
       VALUES ($1, 'withdrawal_debit', -1000, $2, $3)`,
        [seed.businessA, withdrawalB, uuid()],
      ),
    ).rejects.toThrow(/business_id/i);

    await expect(
      db.query(
        `INSERT INTO public.ledger_entries (business_id, type, amount_cents, withdrawal_id, idempotency_key)
       VALUES ($1, 'withdrawal_debit', -1000, $2, $3)`,
        [seed.businessA, withdrawalA, uuid()],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
    await expect(
      db.query("UPDATE public.withdrawals SET business_id = $1 WHERE id = $2", [
        seed.businessB,
        withdrawalA,
      ]),
    ).rejects.toThrow(/business_id/i);
  });
});
