import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, connect, migrationSql, seedBasics, uuid, type PgClient, type Seed } from "./helpers";

const MIGRATION = "20261115080000_retry_deposit_payment_whatsapp_confirmation.sql";
let db: PgClient;
let seed: Seed;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
  await db.query(migrationSql(MIGRATION));
});

afterAll(async () => {
  await db.end();
});

describe("claim durável da confirmação WhatsApp do sinal", () => {
  it("reivindica uma vez, libera para retry e impede claim depois de enviado", async () => {
    await as(db, { role: "service_role" }, async () => {
      const appointmentId = uuid();
      const paymentId = uuid();
      await db.query(
        `INSERT INTO public.appointments (id, business_id, customer_name, customer_phone, starts_at, ends_at)
         VALUES ($1, $2, 'Cliente Teste', '5511999990000', now() + interval '1 day', now() + interval '1 day 30 minutes')`,
        [appointmentId, seed.businessA],
      );
      await db.query(
        `INSERT INTO public.deposit_payments (id, business_id, appointment_id, amount_cents, status)
         VALUES ($1, $2, $3, 5000, 'pago')`,
        [paymentId, seed.businessA, appointmentId],
      );

      const first = await db.query(
        "SELECT public.claim_deposit_payment_whatsapp_confirmation($1) AS token",
        [paymentId],
      );
      expect(first.rows[0]?.["token"]).toBeTruthy();
      const competing = await db.query(
        "SELECT public.claim_deposit_payment_whatsapp_confirmation($1) AS token",
        [paymentId],
      );
      expect(competing.rows[0]?.["token"]).toBeNull();

      await db.query(
        `UPDATE public.deposit_payment_whatsapp_confirmations
         SET status = 'pending', claim_token = NULL, claimed_at = NULL
         WHERE deposit_payment_id = $1`,
        [paymentId],
      );
      const retry = await db.query(
        "SELECT public.claim_deposit_payment_whatsapp_confirmation($1) AS token",
        [paymentId],
      );
      expect(retry.rows[0]?.["token"]).toBeTruthy();
      expect(retry.rows[0]?.["token"]).not.toBe(first.rows[0]?.["token"]);

      await db.query(
        `UPDATE public.deposit_payment_whatsapp_confirmations
         SET status = 'sent', claim_token = NULL, claimed_at = NULL
         WHERE deposit_payment_id = $1`,
        [paymentId],
      );
      const sent = await db.query(
        "SELECT public.claim_deposit_payment_whatsapp_confirmation($1) AS token",
        [paymentId],
      );
      expect(sent.rows[0]?.["token"]).toBeNull();
    });
  });

  it("restringe a execução do claim a service_role", async () => {
    const { rows } = await db.query(
      `SELECT has_function_privilege('anon', 'public.claim_deposit_payment_whatsapp_confirmation(uuid)', 'EXECUTE') AS anon,
              has_function_privilege('authenticated', 'public.claim_deposit_payment_whatsapp_confirmation(uuid)', 'EXECUTE') AS authenticated,
              has_function_privilege('service_role', 'public.claim_deposit_payment_whatsapp_confirmation(uuid)', 'EXECUTE') AS service_role`,
    );
    expect(rows[0]).toEqual({ anon: false, authenticated: false, service_role: true });
  });

  it("keeps the queue inaccessible to anon and authenticated", async () => {
    const { rows } = await db.query(
      `SELECT has_table_privilege('anon', 'public.deposit_payment_whatsapp_confirmations', 'SELECT') AS anon,
              has_table_privilege('authenticated', 'public.deposit_payment_whatsapp_confirmations', 'SELECT') AS authenticated,
              has_table_privilege('service_role', 'public.deposit_payment_whatsapp_confirmations', 'SELECT') AS service_role`,
    );
    expect(rows[0]).toEqual({ anon: false, authenticated: false, service_role: true });
  });
});
