import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, connect, seedBasics, uuid, type PgClient, type Seed } from "./helpers";

let db: PgClient;
let seed: Seed;
let otherMaster: string;
let templateId: string;
let noteId: string;
let eventId: string;
let errorId: string;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
  otherMaster = uuid();
  templateId = uuid();
  noteId = uuid();
  eventId = uuid();
  errorId = uuid();

  await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [
    otherMaster,
    `master-extra-${otherMaster}@agenda.local`,
  ]);
  await db.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'super_admin')", [
    otherMaster,
  ]);
  await db.query(
    "INSERT INTO public.outreach_templates (id, title, usage_type, body, active) VALUES ($1, 'Template inativo', 'outro', 'conteúdo privado', false)",
    [templateId],
  );
  await db.query(
    "INSERT INTO public.master_business_notes (id, business_id, author_id, body) VALUES ($1, $2, $3, 'nota privada')",
    [noteId, seed.businessA, seed.master],
  );
  await db.query(
    "INSERT INTO public.master_business_events (id, business_id, actor_id, type, title) VALUES ($1, $2, $3, 'suspensao', 'evento privado')",
    [eventId, seed.businessA, seed.master],
  );
  await db.query(
    "INSERT INTO public.client_error_log (id, kind, message, source, business_id, user_id) VALUES ($1, 'ui_error', 'erro privado', '/painel', $2, $3)",
    [errorId, seed.businessA, seed.ownerA],
  );
});

afterAll(async () => {
  await db.end();
});

const aal1Master = () => ({
  role: "authenticated" as const,
  userId: seed.master,
  aal: "aal1" as const,
});
const aal2Master = () => ({
  role: "authenticated" as const,
  userId: seed.master,
  aal: "aal2" as const,
});

const masterOnlyReads = () =>
  [
    ["empresas", "SELECT id FROM public.businesses WHERE id = $1", () => seed.businessA],
    [
      "roles de outros administradores",
      "SELECT user_id FROM public.user_roles WHERE user_id = $1",
      () => otherMaster,
    ],
    [
      "templates inativos",
      "SELECT id FROM public.outreach_templates WHERE id = $1",
      () => templateId,
    ],
    [
      "anotações internas",
      "SELECT id FROM public.master_business_notes WHERE id = $1",
      () => noteId,
    ],
    [
      "eventos internos",
      "SELECT id FROM public.master_business_events WHERE id = $1",
      () => eventId,
    ],
    ["erros de clientes", "SELECT id FROM public.client_error_log WHERE id = $1", () => errorId],
  ] as const;

describe("acesso direto Master por role no RLS", () => {
  it.each(masterOnlyReads())(
    "Master AAL1 acessa %s pelo PostgREST",
    async (_name, query, getId) => {
      const result = await as(db, aal1Master(), () => db.query(query, [getId()]));
      expect(result.rowCount).toBe(1);
    },
  );

  it.each(masterOnlyReads())("Master AAL2 também acessa %s", async (_name, query, getId) => {
    const result = await as(db, aal2Master(), () => db.query(query, [getId()]));
    expect(result.rowCount).toBe(1);
  });
});

describe("dados financeiros privados não ficam no SELECT de businesses", () => {
  it("dono e profissional consultam campos operacionais sem ler CPF, chave, PIN ou token", async () => {
    const professionalId = uuid();
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [
      professionalId,
      `profissional-${professionalId}@agenda.local`,
    ]);
    await db.query(
      "INSERT INTO public.professionals (business_id, name, active, user_id) VALUES ($1, 'Profissional', true, $2)",
      [seed.businessA, professionalId],
    );
    await db.query(
      "UPDATE public.businesses SET owner_cpf = '12345678901', withdrawal_pix_key = 'chave@privada.com', withdrawal_pix_key_type = 'email', withdrawal_pin_hash = 'hash-privado', whatsapp_instance_id = 'instancia-privada', whatsapp_instance_token = 'token-privado' WHERE id = $1",
      [seed.businessA],
    );

    for (const actor of [
      { role: "authenticated" as const, userId: seed.ownerA },
      { role: "authenticated" as const, userId: professionalId },
    ]) {
      const safe = await as(db, actor, () =>
        db.query("SELECT id, name FROM public.businesses WHERE id = $1", [seed.businessA]),
      );
      expect(safe.rowCount).toBe(1);

      await expect(
        as(db, actor, () =>
          db.query(
            "SELECT owner_cpf, withdrawal_pix_key, withdrawal_pix_key_type, withdrawal_pin_hash, whatsapp_instance_id, whatsapp_instance_token FROM public.businesses WHERE id = $1",
            [seed.businessA],
          ),
        ),
      ).rejects.toThrow();
    }
  });

  it("a service role mantém acesso servidor aos campos privados", async () => {
    const result = await as(db, { role: "service_role" }, () =>
      db.query(
        "SELECT owner_cpf, withdrawal_pix_key, withdrawal_pin_hash, whatsapp_instance_token FROM public.businesses WHERE id = $1",
        [seed.businessA],
      ),
    );
    expect(result.rows[0]).toMatchObject({
      owner_cpf: "12345678901",
      withdrawal_pix_key: "chave@privada.com",
      withdrawal_pin_hash: "hash-privado",
      whatsapp_instance_token: "token-privado",
    });
  });
});
