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

const saveCategoryArgs = (
  businessId: string,
  categoryId: string | null,
  name: string,
  serviceIds: string[],
) => [categoryId, businessId, name, true, serviceIds];

async function saveCategoryAsOwner(ownerId: string, args: unknown[]) {
  await db.query("BEGIN");
  try {
    await db.query("SET LOCAL ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role: "authenticated", sub: ownerId }),
    ]);
    const result = await db.query(
      `SELECT public.save_service_category_with_services(
        $1::uuid, $2::uuid, $3::text, $4::boolean, $5::uuid[]
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

describe("save_service_category_with_services", () => {
  it("cria categoria e vincula serviços do mesmo negócio atomicamente", async () => {
    const serviceId = uuid();
    await db.query("INSERT INTO public.services (id, business_id, name) VALUES ($1, $2, $3)", [
      serviceId,
      seed.businessA,
      "Serviço categorizado",
    ]);

    const categoryId = await saveCategoryAsOwner(
      seed.ownerA,
      saveCategoryArgs(seed.businessA, null, "Cabelo", [serviceId]),
    );
    const state = await db.query(
      `SELECT c.name, c.business_id, s.category_id
       FROM public.service_categories AS c
       JOIN public.services AS s ON s.category_id = c.id
       WHERE c.id = $1 AND s.id = $2`,
      [categoryId, serviceId],
    );
    expect(state.rows).toEqual([
      { name: "Cabelo", business_id: seed.businessA, category_id: categoryId },
    ]);
  });

  it("reverte a alteração da categoria se a atualização de serviços falha", async () => {
    const serviceId = uuid();
    const categoryId = uuid();
    await db.query("INSERT INTO public.services (id, business_id, name) VALUES ($1, $2, $3)", [
      serviceId,
      seed.businessB,
      "Serviço rollback",
    ]);
    await db.query(
      "INSERT INTO public.service_categories (id, business_id, name) VALUES ($1, $2, $3)",
      [categoryId, seed.businessB, "Categoria original"],
    );
    await db.query("UPDATE public.services SET category_id = $1 WHERE id = $2", [
      categoryId,
      serviceId,
    ]);
    await db.query(`
      CREATE FUNCTION public.test_reject_service_category_update()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'falha de teste após atualizar categoria';
      END;
      $$;
      CREATE TRIGGER test_reject_service_category_update
      BEFORE UPDATE OF category_id ON public.services
      FOR EACH ROW EXECUTE FUNCTION public.test_reject_service_category_update();
    `);

    try {
      const failed = await attempt(
        db,
        { role: "authenticated", userId: seed.ownerB },
        `SELECT public.save_service_category_with_services(
          $1::uuid, $2::uuid, $3::text, $4::boolean, $5::uuid[]
        )`,
        saveCategoryArgs(seed.businessB, categoryId, "Nome parcial", [serviceId]),
      );
      expect(failed.ok).toBe(false);

      const state = await db.query(
        `SELECT c.name, s.category_id
         FROM public.service_categories AS c
         JOIN public.services AS s ON s.id = $1
         WHERE c.id = $2`,
        [serviceId, categoryId],
      );
      expect(state.rows).toEqual([{ name: "Categoria original", category_id: categoryId }]);
    } finally {
      await db.query(
        "DROP TRIGGER IF EXISTS test_reject_service_category_update ON public.services",
      );
      await db.query("DROP FUNCTION IF EXISTS public.test_reject_service_category_update()");
    }
  });

  it("recusa associar serviço de outro negócio e preserva a categoria", async () => {
    const categoryId = uuid();
    const serviceA = uuid();
    const serviceB = uuid();
    await db.query(
      "INSERT INTO public.services (id, business_id, name) VALUES ($1, $2, 'A'), ($3, $4, 'B')",
      [serviceA, seed.businessA, serviceB, seed.businessB],
    );
    await db.query(
      "INSERT INTO public.service_categories (id, business_id, name) VALUES ($1, $2, 'Original')",
      [categoryId, seed.businessA],
    );
    await db.query("UPDATE public.services SET category_id = $1 WHERE id = $2", [
      categoryId,
      serviceA,
    ]);

    const failed = await attempt(
      db,
      { role: "authenticated", userId: seed.ownerA },
      `SELECT public.save_service_category_with_services(
        $1::uuid, $2::uuid, $3::text, $4::boolean, $5::uuid[]
      )`,
      saveCategoryArgs(seed.businessA, categoryId, "Alterada", [serviceB]),
    );
    expect(failed.ok).toBe(false);
    const state = await db.query("SELECT name FROM public.service_categories WHERE id = $1", [
      categoryId,
    ]);
    expect(state.rows).toEqual([{ name: "Original" }]);
  });
});
