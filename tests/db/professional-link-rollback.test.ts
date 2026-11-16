import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attempt, connect, seedBasics, uuid, type PgClient, type Seed } from "./helpers";

let db: PgClient;
let seed: Seed;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
});

afterAll(async () => {
  await db.end();
});

describe("replace_professional_services", () => {
  it("preserva vínculos existentes quando rejeita serviço de outro negócio", async () => {
    const professionalId = uuid();
    const serviceA = uuid();
    const serviceB = uuid();

    await db.query("INSERT INTO public.professionals (id, business_id, name) VALUES ($1, $2, $3)", [
      professionalId,
      seed.businessA,
      "Profissional de validação",
    ]);
    await db.query(
      "INSERT INTO public.services (id, business_id, name) VALUES ($1, $2, $3), ($4, $5, $6)",
      [serviceA, seed.businessA, "Serviço A", serviceB, seed.businessB, "Serviço B"],
    );
    await db.query(
      "INSERT INTO public.service_professionals (business_id, professional_id, service_id) VALUES ($1, $2, $3)",
      [seed.businessA, professionalId, serviceA],
    );

    const rejected = await attempt(
      db,
      { role: "authenticated", userId: seed.ownerA },
      "SELECT public.replace_professional_services($1, $2, $3::uuid[])",
      [seed.businessA, professionalId, [serviceB]],
    );
    const links = await db.query(
      "SELECT service_id FROM public.service_professionals WHERE business_id = $1 AND professional_id = $2",
      [seed.businessA, professionalId],
    );

    expect(rejected.ok).toBe(false);
    expect(links.rows).toEqual([{ service_id: serviceA }]);
  });
});
