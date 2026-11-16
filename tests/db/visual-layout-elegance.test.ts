import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, migrationSql, seedBasics, type PgClient, type Seed } from "./helpers";

let db: PgClient;
let seed: Seed;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
});

afterAll(async () => {
  await db.end();
});

describe("migração dos layouts publicados para Elegance", () => {
  it("normaliza o layout sem alterar cores, conteúdo ou layout_media e pode ser reaplicada", async () => {
    const appearance = {
      header_background: "#123456",
      service_background: "#abcdef",
      layout_media: {
        classic: { logoPath: "business/logo.png", backgroundPath: "business/cover.webp" },
      },
    };
    const content = { title: "Minha empresa", description: "Descrição mantida" };
    await db.query(
      `INSERT INTO public.business_visual_settings
         (business_id, layout_key, appearance, content)
       VALUES ($1, 'classic', $2::jsonb, $3::jsonb)`,
      [seed.businessA, JSON.stringify(appearance), JSON.stringify(content)],
    );

    const migration = migrationSql("20261116044100_force_elegance_for_existing_businesses.sql");
    await db.query(migration);
    await db.query(migration);

    const { rows } = await db.query(
      `SELECT layout_key, appearance, content
       FROM public.business_visual_settings WHERE business_id = $1`,
      [seed.businessA],
    );
    expect(rows[0]).toEqual({ layout_key: "elegance", appearance, content });
  });
});
