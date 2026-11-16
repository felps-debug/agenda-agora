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

async function credit(businessId: string, amountCents: number) {
  const paymentId = uuid();
  await db.query(
    `INSERT INTO public.deposit_payments (id, business_id, amount_cents, status)
     VALUES ($1, $2, $3, 'pago')`,
    [paymentId, businessId, amountCents],
  );
  const result = await db.query(
    `SELECT * FROM public.ledger_credit_payment($1, $2, $3, $4, $5, '{}'::jsonb)`,
    [businessId, paymentId, amountCents, `test-credit:${paymentId}`, "Crédito de teste"],
  );
  return { paymentId, entryId: result.rows[0]?.["entry_id"], key: `test-credit:${paymentId}` };
}

async function newBusiness(ownerId: string) {
  const businessId = uuid();
  await db.query(
    "INSERT INTO public.businesses (id, owner_id, name, slug) VALUES ($1, $2, $3, $4)",
    [businessId, ownerId, "Ledger ensaio", `ledger-${businessId.slice(0, 8)}`],
  );
  return businessId;
}

async function withdrawal(businessId: string, amountCents: number) {
  const withdrawalId = uuid();
  await db.query(
    `INSERT INTO public.withdrawals
       (id, business_id, amount_cents, idempotency_key, pix_key_snapshot, status)
     VALUES ($1, $2, $3, $4, 'ledger-test@example.invalid', 'processing')`,
    [withdrawalId, businessId, amountCents, `test-withdrawal:${withdrawalId}`],
  );
  return withdrawalId;
}

describe("ledger de saques no Postgres de ensaio", () => {
  it("credita uma única vez quando a mesma operação é repetida", async () => {
    const businessId = await newBusiness(seed.ownerA);
    const firstCredit = await credit(businessId, 10000);
    const duplicate = await db.query(
      `SELECT * FROM public.ledger_credit_payment($1, $2, 10000, $3, $4, '{}'::jsonb)`,
      [businessId, firstCredit.paymentId, firstCredit.key, "Crédito repetido"],
    );
    const { rows } = await db.query(
      `SELECT w.available_cents, count(le.id)::int AS credit_count
       FROM public.wallets w
       LEFT JOIN public.ledger_entries le
         ON le.business_id = w.business_id AND le.type = 'payment_credit'
       WHERE w.business_id = $1
       GROUP BY w.business_id`,
      [businessId],
    );

    expect(duplicate.rows[0]).toEqual({ entry_id: firstCredit.entryId, created: false });
    expect(rows[0]).toEqual({ available_cents: 10000, credit_count: 1 });
  });

  it("serializa dois saques concorrentes e aceita somente o que cabe no saldo", async () => {
    const businessId = await newBusiness(seed.ownerA);
    await credit(businessId, 10000);
    const withdrawalIds = [await withdrawal(businessId, 7000), await withdrawal(businessId, 7000)];
    const clients = await Promise.all([connect(), connect()]);

    try {
      const results = await Promise.all(
        clients.map((client, index) =>
          client.query(
            `SELECT accepted, available_cents
             FROM public.ledger_request_withdrawal($1, $2, 7000, $3)`,
            [businessId, withdrawalIds[index], `test-debit:${withdrawalIds[index]}`],
          ),
        ),
      );

      expect(results.map((result) => result.rows[0]?.["accepted"]).sort()).toEqual([false, true]);
      const { rows } = await db.query(
        `SELECT w.available_cents, w.locked_cents,
                count(le.id)::int AS debit_count
         FROM public.wallets w
         LEFT JOIN public.ledger_entries le
           ON le.business_id = w.business_id AND le.type = 'withdrawal_debit'
         WHERE w.business_id = $1
         GROUP BY w.business_id`,
        [businessId],
      );
      expect(rows[0]).toEqual({ available_cents: 3000, locked_cents: 7000, debit_count: 1 });
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("permite saldo negativo por estorno e bloqueia novos saques", async () => {
    const businessId = await newBusiness(seed.ownerB);
    const { paymentId } = await credit(businessId, 10000);
    const originalWithdrawalId = await withdrawal(businessId, 10000);
    const accepted = await db.query(
      `SELECT accepted FROM public.ledger_request_withdrawal($1, $2, 10000, $3)`,
      [businessId, originalWithdrawalId, `test-debit:${originalWithdrawalId}`],
    );
    expect(accepted.rows[0]?.["accepted"]).toBe(true);

    await db.query(
      `SELECT * FROM public.ledger_debit_refund($1, $2, 10000, $3, 'Estorno de teste')`,
      [businessId, paymentId, `test-refund:${paymentId}`],
    );
    const rejectedWithdrawalId = await withdrawal(businessId, 1300);
    const rejected = await db.query(
      `SELECT accepted, available_cents
       FROM public.ledger_request_withdrawal($1, $2, 1300, $3)`,
      [businessId, rejectedWithdrawalId, `test-debit:${rejectedWithdrawalId}`],
    );
    expect(rejected.rows[0]).toEqual({ accepted: false, available_cents: -10000 });
  });
});
