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

describe("renovação monotônica de acesso", () => {
  it("preserva o maior prazo quando duas gravações condicionais concorrem", async () => {
    const competitor = await connect();
    const earlier = "2027-01-20T03:00:00.000Z";
    const later = "2027-06-20T03:00:00.000Z";

    const reset = async () => {
      await db.query("UPDATE public.businesses SET access_until = NULL WHERE id = $1", [
        seed.businessA,
      ]);
    };
    const update = (client: PgClient, target: string) =>
      client.query(
        `UPDATE public.businesses
         SET access_until = $2
         WHERE id = $1 AND (access_until IS NULL OR access_until < $2::timestamptz)`,
        [seed.businessA, target],
      );

    try {
      await reset();
      await db.query("BEGIN");
      await update(db, later);
      await competitor.query("BEGIN");
      const olderWaiting = update(competitor, earlier);
      await new Promise((resolve) => setTimeout(resolve, 40));
      await db.query("COMMIT");
      const olderResult = await olderWaiting;
      await competitor.query("COMMIT");
      expect(olderResult.rowCount).toBe(0);
      let result = await db.query("SELECT access_until FROM public.businesses WHERE id = $1", [
        seed.businessA,
      ]);
      expect(new Date(String(result.rows[0]!["access_until"])).toISOString()).toBe(later);

      await reset();
      await db.query("BEGIN");
      await update(db, earlier);
      await competitor.query("BEGIN");
      const newerWaiting = update(competitor, later);
      await new Promise((resolve) => setTimeout(resolve, 40));
      await db.query("COMMIT");
      const newerResult = await newerWaiting;
      await competitor.query("COMMIT");
      expect(newerResult.rowCount).toBe(1);
      result = await db.query("SELECT access_until FROM public.businesses WHERE id = $1", [
        seed.businessA,
      ]);
      expect(new Date(String(result.rows[0]!["access_until"])).toISOString()).toBe(later);
    } finally {
      await db.query("ROLLBACK").catch(() => undefined);
      await competitor.query("ROLLBACK").catch(() => undefined);
      await competitor.end();
    }
  });
});
