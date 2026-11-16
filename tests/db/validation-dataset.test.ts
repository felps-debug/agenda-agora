import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, seedValidationDataset, type PgClient, type ValidationDataset } from "./helpers";

let db: PgClient;
let fixture: ValidationDataset;

beforeAll(async () => {
  db = await connect();
  fixture = await seedValidationDataset(db);
});

afterAll(async () => {
  await db.end();
});

describe("fixture isolada da validação manual", () => {
  it("prepara dois negócios, dois admins e profissionais com e sem login", async () => {
    const businesses = await db.query(
      "SELECT count(*)::int AS total FROM public.businesses WHERE id = ANY($1::uuid[])",
      [[fixture.businessA, fixture.businessB]],
    );
    const admins = await db.query(
      "SELECT count(*)::int AS total FROM public.user_roles WHERE user_id = ANY($1::uuid[]) AND role = 'super_admin'",
      [[fixture.adminA, fixture.adminB]],
    );
    const professionals = await db.query(
      "SELECT count(*) FILTER (WHERE user_id IS NOT NULL)::int AS linked, count(*) FILTER (WHERE user_id IS NULL)::int AS unlinked FROM public.professionals WHERE id = ANY($1::uuid[])",
      [[fixture.professionalWithLogin, fixture.professionalWithoutLogin]],
    );
    const agpay = await db.query(
      "SELECT value FROM public.platform_settings WHERE key = 'agpay_fees'",
    );

    expect(businesses.rows[0]).toEqual({ total: 2 });
    expect(admins.rows[0]).toEqual({ total: 2 });
    expect(professionals.rows[0]).toEqual({ linked: 1, unlinked: 1 });
    expect(agpay.rows).toHaveLength(1);
    expect(agpay.rows[0]?.["value"]).toMatchObject({
      deposit_fixed_cents: 75,
      withdraw_fixed_cents: 300,
    });
  });
});
