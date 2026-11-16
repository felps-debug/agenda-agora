import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, seedBasics, type PgClient, type Seed } from "./helpers";

let db: PgClient;
let seed: Seed;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
});

afterAll(async () => {
  await db.end();
});

describe("idempotência de avisos do ciclo de assinatura", () => {
  it("permite só um aviso por negócio e chave de ciclo", async () => {
    const competitor = await connect();
    const dedupeKey = `fatura-vence|${new Date("2027-05-20T03:00:00.000Z").toISOString()}`;
    const insert = (client: PgClient, key: string) =>
      client.query(
        `INSERT INTO public.master_business_events (business_id, type, title, dedupe_key)
         VALUES ($1, 'assinatura', 'Fatura vence em 7 dias', $2)
         ON CONFLICT (business_id, dedupe_key) DO NOTHING
         RETURNING id`,
        [seed.businessA, key],
      );

    try {
      await db.query("BEGIN");
      const first = await insert(db, dedupeKey);
      await competitor.query("BEGIN");
      const competingInsert = insert(competitor, dedupeKey);
      await new Promise((resolve) => setTimeout(resolve, 40));
      await db.query("COMMIT");
      const second = await competingInsert;
      await competitor.query("COMMIT");

      expect(first.rowCount).toBe(1);
      expect(second.rowCount).toBe(0);
      await expect(insert(db, `${dedupeKey}|novo-ciclo`)).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      await db.query("ROLLBACK").catch(() => undefined);
      await competitor.query("ROLLBACK").catch(() => undefined);
      await competitor.end();
    }
  });
});
