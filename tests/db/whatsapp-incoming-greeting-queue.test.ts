import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  as,
  attempt,
  connect,
  migrationSql,
  seedBasics,
  uuid,
  type PgClient,
  type Seed,
} from "./helpers";

const MIGRATION = "20261115070000_whatsapp_incoming_greeting_queue.sql";
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

describe("fila durável de saudações recebidas", () => {
  it("permite registrar e consultar evento com service_role", async () => {
    const eventId = uuid();
    const dedupeHash = `hash-${uuid()}`;
    const record = await as(db, { role: "service_role" }, async () => {
      const result = await db.query(
        `INSERT INTO public.whatsapp_incoming_greeting_events (id, business_id, dedupe_hash, sender_phone)
         VALUES ($1, $2, $3, '5511999990000')`,
        [eventId, seed.businessA, dedupeHash],
      );
      const { rows } = await db.query(
        "SELECT status, attempts FROM public.whatsapp_incoming_greeting_events WHERE id = $1",
        [eventId],
      );
      return { rowCount: result.rowCount, row: rows[0] };
    });
    expect(record).toMatchObject({ rowCount: 1, row: { status: "pending", attempts: 0 } });
  });

  it("impede duplicar a chave de idempotência", async () => {
    const hash = `hash-${uuid()}`;
    await db.query(
      `INSERT INTO public.whatsapp_incoming_greeting_events (business_id, dedupe_hash, sender_phone)
       VALUES ($1, $2, '5511999990000')`,
      [seed.businessA, hash],
    );
    const duplicate = await attempt(
      db,
      { role: "service_role" },
      `INSERT INTO public.whatsapp_incoming_greeting_events (business_id, dedupe_hash, sender_phone)
       VALUES ($1, $2, '5511999990000')`,
      [seed.businessA, hash],
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok)
      expect(duplicate.error).toMatch(/whatsapp_incoming_greeting_events_dedupe_hash_key/i);
  });

  it("nega acesso direto a anon e authenticated", async () => {
    const anon = await attempt(
      db,
      { role: "anon" },
      "SELECT id FROM public.whatsapp_incoming_greeting_events",
    );
    const owner = await attempt(
      db,
      { role: "authenticated", userId: seed.ownerA },
      "SELECT id FROM public.whatsapp_incoming_greeting_events",
    );
    expect(anon.ok).toBe(false);
    expect(owner.ok).toBe(false);
  });
});
