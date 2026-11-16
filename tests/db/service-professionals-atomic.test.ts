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

const addProfessional = async (businessId: string, name: string) => {
  const { rows } = await db.query(
    "INSERT INTO public.professionals (business_id, name) VALUES ($1, $2) RETURNING id",
    [businessId, name],
  );
  return rows[0]!["id"] as string;
};

const saveArgs = (businessId: string, serviceId: string | null, professionalIds: string[]) => [
  serviceId,
  businessId,
  "Corte",
  30,
  10_000,
  false,
  "fixed",
  0,
  0,
  null,
  false,
  [1, 2, 3, 4, 5, 6],
  true,
  true,
  true,
  null,
  professionalIds,
];

async function saveAsOwner(ownerId: string, args: unknown[]) {
  await db.query("BEGIN");
  try {
    await db.query("SET LOCAL ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role: "authenticated", sub: ownerId }),
    ]);
    const result = await db.query(
      `SELECT public.save_service_with_professionals(
        $1::uuid, $2::uuid, $3::text, $4::integer, $5::integer, $6::boolean,
        $7::text, $8::integer, $9::integer, $10::text, $11::boolean,
        $12::smallint[], $13::boolean, $14::boolean, $15::boolean, $16::text, $17::uuid[]
      ) AS id`,
      args,
    );
    await db.query("COMMIT");
    return result.rows[0]!["id"] as string;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

describe("save_service_with_professionals", () => {
  it("salva serviço e vínculos na mesma operação para um owner", async () => {
    const professionalId = await addProfessional(seed.businessA, `Atomic ${uuid()}`);
    const serviceId = await saveAsOwner(
      seed.ownerA,
      saveArgs(seed.businessA, null, [professionalId]),
    );

    const service = await db.query("SELECT business_id, name FROM public.services WHERE id = $1", [
      serviceId,
    ]);
    const links = await db.query(
      "SELECT business_id, professional_id FROM public.service_professionals WHERE service_id = $1",
      [serviceId],
    );
    expect(service.rows[0]).toEqual({ business_id: seed.businessA, name: "Corte" });
    expect(links.rows).toEqual([{ business_id: seed.businessA, professional_id: professionalId }]);
  });

  it("reverte update e DELETE de vínculos se o INSERT de vínculos falha", async () => {
    const professionalId = await addProfessional(seed.businessA, `Rollback ${uuid()}`);
    const serviceId = await saveAsOwner(
      seed.ownerA,
      saveArgs(seed.businessA, null, [professionalId]),
    );

    const failed = await attempt(
      db,
      { role: "authenticated", userId: seed.ownerA },
      `SELECT public.save_service_with_professionals(
        $1::uuid, $2::uuid, $3::text, $4::integer, $5::integer, $6::boolean,
        $7::text, $8::integer, $9::integer, $10::text, $11::boolean,
        $12::smallint[], $13::boolean, $14::boolean, $15::boolean, $16::text, $17::uuid[]
      )`,
      saveArgs(seed.businessA, serviceId, [professionalId, professionalId]),
    );
    expect(failed.ok).toBe(false);

    const state = await db.query(
      `SELECT s.name, sp.professional_id
       FROM public.services AS s
       LEFT JOIN public.service_professionals AS sp ON sp.service_id = s.id
       WHERE s.id = $1`,
      [serviceId],
    );
    expect(state.rows).toEqual([{ name: "Corte", professional_id: professionalId }]);
  });

  it("recusa serviço de outro negócio e não altera seus vínculos", async () => {
    const professionalA = await addProfessional(seed.businessA, `Owner A ${uuid()}`);
    const professionalB = await addProfessional(seed.businessB, `Owner B ${uuid()}`);
    const serviceId = await saveAsOwner(
      seed.ownerA,
      saveArgs(seed.businessA, null, [professionalA]),
    );

    const failed = await attempt(
      db,
      { role: "authenticated", userId: seed.ownerA },
      `SELECT public.save_service_with_professionals(
        $1::uuid, $2::uuid, $3::text, $4::integer, $5::integer, $6::boolean,
        $7::text, $8::integer, $9::integer, $10::text, $11::boolean,
        $12::smallint[], $13::boolean, $14::boolean, $15::boolean, $16::text, $17::uuid[]
      )`,
      saveArgs(seed.businessA, serviceId, [professionalB]),
    );
    expect(failed.ok).toBe(false);
    const links = await db.query(
      "SELECT professional_id FROM public.service_professionals WHERE service_id = $1",
      [serviceId],
    );
    expect(links.rows).toEqual([{ professional_id: professionalA }]);
  });
});
