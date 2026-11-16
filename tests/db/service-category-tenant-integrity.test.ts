import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, connect, seedBasics, uuid, type PgClient, type Seed } from "./helpers";

let db: PgClient;
let seed: Seed;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
});

afterAll(async () => {
  await db.end();
});

describe("integridade entre serviços e categorias", () => {
  it("impede que um negócio vincule serviço à categoria de outro", async () => {
    const categoryA = uuid();
    const categoryB = uuid();
    const serviceA = uuid();

    await db.query(
      `INSERT INTO public.service_categories (id, business_id, name)
       VALUES ($1, $2, 'Categoria A'), ($3, $4, 'Categoria B')`,
      [categoryA, seed.businessA, categoryB, seed.businessB],
    );
    await db.query(
      "INSERT INTO public.services (id, business_id, name) VALUES ($1, $2, 'Serviço A')",
      [serviceA, seed.businessA],
    );

    await expect(
      as(db, { role: "authenticated", userId: seed.ownerA }, () =>
        db.query("UPDATE public.services SET category_id = $1 WHERE id = $2", [
          categoryB,
          serviceA,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("mantém a exclusão de categorias restrita ao negócio correspondente", async () => {
    const categoryA = uuid();
    const categoryB = uuid();
    const serviceA = uuid();
    await db.query(
      `INSERT INTO public.service_categories (id, business_id, name)
       VALUES ($1, $2, 'Categoria A'), ($3, $4, 'Categoria B')`,
      [categoryA, seed.businessA, categoryB, seed.businessB],
    );
    await db.query(
      "INSERT INTO public.services (id, business_id, name) VALUES ($1, $2, 'Serviço A')",
      [serviceA, seed.businessA],
    );

    await as(db, { role: "authenticated", userId: seed.ownerA }, async () => {
      await db.query("UPDATE public.services SET category_id = $1 WHERE id = $2", [
        categoryA,
        serviceA,
      ]);
      await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "authenticated", sub: seed.ownerB }),
      ]);
      await db.query("DELETE FROM public.service_categories WHERE id = $1", [categoryB]);
      await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "authenticated", sub: seed.ownerA }),
      ]);

      const unchanged = await db.query(
        "SELECT business_id, category_id FROM public.services WHERE id = $1",
        [serviceA],
      );
      expect(unchanged.rows[0]).toEqual({ business_id: seed.businessA, category_id: categoryA });

      await db.query("DELETE FROM public.service_categories WHERE id = $1", [categoryA]);
      const afterOwnCategoryDelete = await db.query(
        "SELECT business_id, category_id FROM public.services WHERE id = $1",
        [serviceA],
      );
      expect(afterOwnCategoryDelete.rows[0]).toEqual({
        business_id: seed.businessA,
        category_id: null,
      });
    });
  });
});
