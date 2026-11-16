import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attempt, connect, migrationSql, seedBasics, type PgClient, type Seed } from "./helpers";

const MIGRATION = "20261115010000_business_hours_end_after_start.sql";

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

describe("intervalos de funcionamento", () => {
  it.each([
    ["19:00", "08:30"],
    ["08:30", "08:30"],
  ])("rejeita fim %s não posterior ao início %s para owner", async (startsAt, endsAt) => {
    const result = await attempt(
      db,
      { role: "authenticated", userId: seed.ownerA },
      `INSERT INTO public.business_hours (business_id, weekday, starts_at, ends_at)
       VALUES ($1, 6, $2, $3)`,
      [seed.businessA, startsAt, endsAt],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/business_hours_end_after_start/i);
  });

  it("mantém a gravação de um intervalo válido", async () => {
    const result = await attempt(
      db,
      { role: "authenticated", userId: seed.ownerA },
      `INSERT INTO public.business_hours (business_id, weekday, starts_at, ends_at)
       VALUES ($1, 6, '08:30', '19:00')`,
      [seed.businessA],
    );
    expect(result.ok).toBe(true);
  });
});
