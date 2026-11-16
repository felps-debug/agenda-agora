import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  as,
  attempt,
  connect,
  migrationSql,
  seedBasics,
  uuid,
  type PgClient,
  type Seed,
} from "./helpers";

const HARDENING = "20261103000000_security_hardening.sql";
const POST_HARDENING_MIGRATIONS = [
  "20261114120000_fix_paid_trial_lifecycle.sql",
  "20261114150000_restrict_business_owner_insert.sql",
  "20261114204014_restrict_subscription_payment_writes.sql",
  "20261115120000_subscription_payments_owner_read.sql",
];

let db: PgClient;
let seed: Seed;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
});

afterAll(async () => {
  await db.end();
});

const owner = () => ({ role: "authenticated" as const, userId: seed.ownerA });
const otherOwner = () => ({ role: "authenticated" as const, userId: seed.ownerB });
const masterUser = () => ({ role: "authenticated" as const, userId: seed.master });

async function restorePostHardeningMigrations() {
  for (const migration of POST_HARDENING_MIGRATIONS) {
    await db.query(migrationSql(migration));
  }
}

describe("criação de businesses autorizada", () => {
  it("owner não cria negócio nem define campos comerciais diretamente", async () => {
    const result = await attempt(
      db,
      owner(),
      `INSERT INTO public.businesses (owner_id, name, slug, status, monthly_fee_cents, access_until)
       VALUES ($1, 'Não autorizado', $2, 'ativo', 1, now() + interval '1 year')`,
      [seed.ownerA, `nao-autorizado-${uuid()}`],
    );
    expect(result.ok).toBe(false);
  });

  it("service role continua podendo criar negócio pelo fluxo servidor", async () => {
    const result = await as(db, { role: "service_role" }, async () =>
      db.query(
        `INSERT INTO public.businesses (owner_id, name, slug, status, monthly_fee_cents)
         VALUES ($1, 'Criado por serviço', $2, 'ativo', 1000)`,
        [seed.ownerA, `servico-${uuid()}`],
      ),
    );
    expect(result.rowCount).toBe(1);
  });

  it("owner não apaga diretamente o negócio e preserva a linha", async () => {
    const result = await attempt(db, owner(), "DELETE FROM public.businesses WHERE id = $1", [
      seed.businessA,
    ]);
    expect(result.ok).toBe(false);

    const { rows } = await db.query("SELECT id FROM public.businesses WHERE id = $1", [
      seed.businessA,
    ]);
    expect(rows).toEqual([{ id: seed.businessA }]);
  });
});

describe("C2: o dono não edita campos de controle do próprio negócio", () => {
  it("bloqueio de acesso ao Ag Pay não pode ser desligado pelo dono", async () => {
    await db.query("UPDATE public.businesses SET agpay_access_blocked = true WHERE id = $1", [
      seed.businessA,
    ]);
    const result = await attempt(
      db,
      owner(),
      "UPDATE public.businesses SET agpay_access_blocked = false WHERE id = $1",
      [seed.businessA],
    );
    expect(result.ok).toBe(false);
    const { rows } = await db.query(
      "SELECT agpay_access_blocked FROM public.businesses WHERE id = $1",
      [seed.businessA],
    );
    expect(rows[0]!["agpay_access_blocked"]).toBe(true);
  });

  it.each([
    ["access_until", "now() + interval '10 years'"],
    ["status", "'ativo'"],
    ["owner_id", `'${uuid()}'::uuid`],
    ["agpay_withdrawal_blocked", "false"],
    ["monthly_fee_cents", "0"],
    ["name", "'Outro nome'"],
  ])("o dono não altera %s", async (column, value) => {
    const result = await attempt(
      db,
      owner(),
      `UPDATE public.businesses SET ${column} = ${value} WHERE id = $1`,
      [seed.businessA],
    );
    expect(result.ok).toBe(false);
  });

  it.each([
    ["logo_url", "'logos/a.png'"],
    ["brand_background_image", "'capas/a.jpg'"],
    ["reminder_enabled", "true"],
    ["reminder_hours_before", "3"],
    ["theme", "'rosa'"],
    ["pix_mode", "'sempre'"],
  ])("a escrita comum do dono continua funcionando: %s", async (column, value) => {
    const result = await as(db, owner(), async () => {
      try {
        return await db.query(`UPDATE public.businesses SET ${column} = ${value} WHERE id = $1`, [
          seed.businessA,
        ]);
      } catch (error) {
        throw new Error(`${column}: ${(error as Error).message}`);
      }
    });
    expect(result.rowCount).toBe(1);
  });

  it.each([
    ["withdrawal_pin_hash", "'abc123'"],
    ["withdrawal_pix_key", "'chave@exemplo.com'"],
    ["withdrawal_pix_key_type", "'email'"],
    ["owner_cpf", "'12345678901'"],
  ])("o dono não altera diretamente campo financeiro privado: %s", async (column, value) => {
    const result = await attempt(
      db,
      owner(),
      `UPDATE public.businesses SET ${column} = ${value} WHERE id = $1`,
      [seed.businessA],
    );
    expect(result.ok).toBe(false);
  });

  it("um dono não altera o negócio de outro dono", async () => {
    const result = await attempt(
      db,
      otherOwner(),
      "UPDATE public.businesses SET logo_url = 'x' WHERE id = $1",
      [seed.businessA],
    );
    // RLS filtra a linha: nenhuma linha atualizada.
    expect(result.ok && result.rowCount).toBe(0);
  });

  it("a service role e o acesso direto ao banco continuam podendo alterar tudo", async () => {
    const asService = await as(db, { role: "service_role" }, async () =>
      db.query("UPDATE public.businesses SET agpay_access_blocked = false WHERE id = $1", [
        seed.businessA,
      ]),
    );
    expect(asService.rowCount).toBe(1);
    await db.query("UPDATE public.businesses SET status = status WHERE id = $1", [seed.businessA]);
  });

  it("o master autenticado também não escreve direto: usa a service role no servidor", async () => {
    const result = await attempt(
      db,
      masterUser(),
      "UPDATE public.businesses SET status = 'suspenso' WHERE id = $1",
      [seed.businessA],
    );
    expect(result.ok).toBe(false);
  });
});

describe("C3: o dono não se autoaprova", () => {
  const insert = (status: string, extra = "") =>
    `INSERT INTO public.pix_key_approvals (business_id, key_type, key, status${extra ? ", " + extra.split("=")[0] : ""}) VALUES ($1, 'cpf', '11144477735', '${status}'${extra ? ", " + extra.split("=")[1] : ""})`;

  it("solicitação pendente funciona", async () => {
    const result = await attempt(db, owner(), insert("pendente"), [seed.businessA]);
    expect(result).toMatchObject({ ok: true, rowCount: 1 });
  });

  it("inserir já aprovada ou recusada é recusado", async () => {
    for (const status of ["aprovado", "recusado"]) {
      const result = await attempt(db, owner(), insert(status), [seed.businessA]);
      expect(result.ok, status).toBe(false);
    }
  });

  it("preencher quem aprovou ou quando é recusado", async () => {
    const byWho = await attempt(db, owner(), insert("pendente", `approved_by='${seed.ownerA}'`), [
      seed.businessA,
    ]);
    const when = await attempt(db, owner(), insert("pendente", "decided_at=now()"), [
      seed.businessA,
    ]);
    expect(byWho.ok).toBe(false);
    expect(when.ok).toBe(false);
  });

  it("não solicita para o negócio de outro dono", async () => {
    const result = await attempt(db, owner(), insert("pendente"), [seed.businessB]);
    expect(result.ok).toBe(false);
  });

  it("o dono não atualiza nem apaga solicitações", async () => {
    const id = uuid();
    await db.query(
      "INSERT INTO public.pix_key_approvals (id, business_id, key_type, key, status) VALUES ($1, $2, 'cpf', '111', 'pendente')",
      [id, seed.businessA],
    );
    const update = await attempt(
      db,
      owner(),
      "UPDATE public.pix_key_approvals SET status = 'aprovado' WHERE id = $1",
      [id],
    );
    const del = await attempt(db, owner(), "DELETE FROM public.pix_key_approvals WHERE id = $1", [
      id,
    ]);
    expect(update.ok).toBe(false);
    expect(del.ok).toBe(false);
    const { rows } = await db.query("SELECT status FROM public.pix_key_approvals WHERE id = $1", [
      id,
    ]);
    expect(rows[0]!["status"]).toBe("pendente");
  });
});

describe("mensagens de suporte", () => {
  let messageId: string;
  beforeAll(async () => {
    messageId = uuid();
    await db.query(
      "INSERT INTO public.support_messages (id, business_id, sender, message, read_by_user) VALUES ($1, $2, 'master', 'Olá', false)",
      [messageId, seed.businessA],
    );
  });

  it("o dono não reescreve o texto da mensagem", async () => {
    const result = await attempt(
      db,
      owner(),
      "UPDATE public.support_messages SET message = 'adulterada' WHERE id = $1",
      [messageId],
    );
    expect(result.ok).toBe(false);
    const { rows } = await db.query("SELECT message FROM public.support_messages WHERE id = $1", [
      messageId,
    ]);
    expect(rows[0]!["message"]).toBe("Olá");
  });

  it("o dono não muda remetente nem negócio", async () => {
    for (const set of [
      "sender = 'user'",
      `business_id = '${seed.businessB}'`,
      "read_by_master = true",
    ]) {
      const result = await attempt(
        db,
        owner(),
        `UPDATE public.support_messages SET ${set} WHERE id = $1`,
        [messageId],
      );
      expect(result.ok, set).toBe(false);
    }
  });

  it("o dono marca como lida a mensagem do próprio negócio", async () => {
    const result = await attempt(
      db,
      owner(),
      "UPDATE public.support_messages SET read_by_user = true WHERE id = $1",
      [messageId],
    );
    expect(result).toMatchObject({ ok: true, rowCount: 1 });
  });

  it("e não mexe na mensagem de outro negócio", async () => {
    const result = await attempt(
      db,
      otherOwner(),
      "UPDATE public.support_messages SET read_by_user = true WHERE id = $1",
      [messageId],
    );
    expect(result.ok && result.rowCount).toBe(0);
  });
});

describe("PAY-030: historico de pagamentos da assinatura e somente leitura para authenticated", () => {
  it("mantem leitura do owner, recusa DML direto e preserva escrita por service_role", async () => {
    const paymentId = uuid();
    const referenceMonth = "2099-01-01";
    await db.query(
      `INSERT INTO public.subscription_payments
        (id, business_id, reference_month, amount_cents, status, paid_at)
       VALUES ($1, $2, $3, 8990, 'pago', now())`,
      [paymentId, seed.businessA, referenceMonth],
    );
    try {
      const ownerRead = await as(db, owner(), () =>
        db.query("SELECT id, amount_cents FROM public.subscription_payments WHERE id = $1", [
          paymentId,
        ]),
      );
      const insert = await attempt(
        db,
        owner(),
        `INSERT INTO public.subscription_payments (business_id, reference_month, amount_cents, status)
         VALUES ($1, '2099-02-01', 1, 'pago')`,
        [seed.businessA],
      );
      const update = await attempt(
        db,
        owner(),
        "UPDATE public.subscription_payments SET amount_cents = 1 WHERE id = $1",
        [paymentId],
      );
      const del = await attempt(
        db,
        owner(),
        "DELETE FROM public.subscription_payments WHERE id = $1",
        [paymentId],
      );
      const servicePrivileges = await db.query(
        `SELECT has_table_privilege('service_role', 'public.subscription_payments', 'INSERT') AS can_insert,
                has_table_privilege('service_role', 'public.subscription_payments', 'UPDATE') AS can_update,
                has_table_privilege('service_role', 'public.subscription_payments', 'DELETE') AS can_delete`,
      );
      const serviceRoleInsert = await as(db, { role: "service_role" }, () =>
        db.query(
          `INSERT INTO public.subscription_payments (business_id, reference_month, amount_cents, status)
           VALUES ($1, '2099-02-01', 8990, 'pago')`,
          [seed.businessA],
        ),
      );

      expect(ownerRead.rows).toEqual([{ id: paymentId, amount_cents: 8990 }]);
      expect(insert.ok).toBe(false);
      expect(update.ok).toBe(false);
      expect(del.ok).toBe(false);
      expect(servicePrivileges.rows[0]).toEqual({
        can_insert: true,
        can_update: true,
        can_delete: true,
      });
      expect(serviceRoleInsert.rowCount).toBe(1);
    } finally {
      await db.query("DELETE FROM public.subscription_payments WHERE id = $1", [paymentId]);
    }
  });
});

describe("A5: tabelas internas não são legíveis por usuários comuns", () => {
  it.each([
    "sdrs",
    "sdr_config",
    "sdr_ideas",
    "master_impersonation_sessions",
    "auth_attempts",
    "platform_settings",
  ])("SELECT em %s é negado para anon e authenticated", async (table) => {
    for (const actor of [{ role: "anon" as const }, owner(), masterUser()]) {
      const result = await attempt(db, actor, `SELECT * FROM public.${table} LIMIT 1`);
      expect(result.ok, `${table} como ${actor.role}`).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/permission denied/i);
    }
  });

  it("INSERT, UPDATE e DELETE também são negados", async () => {
    for (const sql of [
      "INSERT INTO public.sdrs (name, email, pin) VALUES ('x', 'x@x.com', 'x')",
      "UPDATE public.sdrs SET active = true",
      "DELETE FROM public.master_impersonation_sessions",
      "INSERT INTO public.platform_settings (key, value) VALUES ('agpay_fees', '{}'::jsonb)",
    ]) {
      const result = await attempt(db, owner(), sql);
      expect(result.ok, sql).toBe(false);
    }
  });

  it("a service role lê e escreve normalmente", async () => {
    const result = await as(db, { role: "service_role" }, async () =>
      db.query("SELECT key FROM public.platform_settings WHERE key = 'agpay_fees'"),
    );
    expect(result.rows).toHaveLength(1);
  });

  it("valores iniciais das configurações da plataforma", async () => {
    const { rows } = await db.query("SELECT key, value FROM public.platform_settings ORDER BY key");
    const byKey = Object.fromEntries(rows.map((r) => [r["key"] as string, r["value"]]));
    expect(byKey["agpay_fees"]).toEqual({ deposit_fixed_cents: 75, withdraw_fixed_cents: 300 });
    expect(byKey["lifecycle_auto_cancel_enabled"]).toBe(false);
  });
});

describe("privacidade dos bloqueios de agenda", () => {
  it("anon não pode consultar diretamente os motivos dos bloqueios", async () => {
    const blockId = uuid();
    await db.query(
      `INSERT INTO public.time_blocks (id, business_id, recurring, weekday, starts_at, ends_at, reason)
       VALUES ($1, $2, true, 1, '12:00', '13:00', 'MOTIVO_PRIVADO_SENTINELA')`,
      [blockId, seed.businessA],
    );

    const result = await attempt(
      db,
      { role: "anon" },
      "SELECT reason FROM public.time_blocks WHERE id = $1",
      [blockId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission denied/i);

    const ownerResult = await attempt(
      db,
      owner(),
      "SELECT reason FROM public.time_blocks WHERE id = $1",
      [blockId],
    );
    expect(ownerResult).toMatchObject({ ok: true, rowCount: 1 });

    const otherOwnerResult = await attempt(
      db,
      otherOwner(),
      "SELECT reason FROM public.time_blocks WHERE id = $1",
      [blockId],
    );
    expect(otherOwnerResult).toMatchObject({ ok: true, rowCount: 0 });
  });
});

describe("isolamento das mídias visuais", () => {
  it("confirma bucket privado, tabelas de produto e policies Storage esperadas", async () => {
    const relations = await db.query(
      `SELECT to_regclass('public.services') AS services,
              to_regclass('public.user_roles') AS user_roles,
              to_regclass('storage.objects') AS storage_objects`,
    );
    expect(relations.rows[0]).toMatchObject({
      services: "services",
      user_roles: "user_roles",
      storage_objects: "storage.objects",
    });

    const buckets = await db.query(
      "SELECT id, public FROM storage.buckets WHERE id = 'business-logos'",
    );
    expect(buckets.rows).toEqual([{ id: "business-logos", public: false }]);

    const policies = await db.query(
      `SELECT policyname FROM pg_policies
       WHERE schemaname = 'storage' AND tablename = 'objects'`,
    );
    const policyNames = policies.rows.map((row) => row["policyname"]);
    expect(policyNames).toEqual(
      expect.arrayContaining([
        "business_logos_images_read",
        "visual_assets_images_read",
        "visual_assets_public_logos_read",
      ]),
    );
  });

  it("anon só lê logos publicados, não fotos de serviço, capas, staging ou JSON", async () => {
    const candidates = [
      { kind: "logo", name: `${seed.businessA}/logo-${uuid()}.webp` },
      { kind: "service", name: `${seed.businessA}/services/${uuid()}-service.webp` },
      { kind: "background", name: `${seed.businessA}/background/${uuid()}.webp` },
      { kind: "staging", name: `${seed.businessA}/staging/${seed.ownerA}/${uuid()}/draft.webp` },
      { kind: "settings", name: `${seed.businessA}/panel1-settings.json` },
      { kind: "nested-logo", name: `${seed.businessA}/logo/nested.webp` },
    ].map((candidate) => ({ ...candidate, id: uuid() }));

    await db.query(
      `INSERT INTO storage.objects (id, bucket_id, name)
       SELECT (value->>'id')::uuid, 'business-logos', value->>'name'
       FROM jsonb_array_elements($1::jsonb) AS value`,
      [JSON.stringify(candidates)],
    );

    const visible = await as(db, { role: "anon" }, async () =>
      db.query("SELECT id FROM storage.objects WHERE id = ANY($1::uuid[])", [
        candidates.map((candidate) => candidate.id),
      ]),
    );

    expect(visible.rows.map((row) => row["id"]).sort()).toEqual([candidates[0]!.id].sort());
  });

  it("restringe mídia publicada a membros e staging ao usuário que enviou", async () => {
    const professionalUser = uuid();
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [
      professionalUser,
      `visual-${professionalUser}@agenda.local`,
    ]);
    await db.query(
      `INSERT INTO public.professionals (business_id, user_id, name, permissions)
       VALUES ($1, $2, 'Editor visual', '{"manage_appearance": true}'::jsonb)`,
      [seed.businessA, professionalUser],
    );

    const ownIds = [uuid(), uuid(), uuid(), uuid()];
    const professionalStagingId = uuid();
    const otherBusinessIds = [uuid(), uuid(), uuid(), uuid()];
    await db.query(
      `INSERT INTO storage.objects (id, bucket_id, name) VALUES
       ($1, 'business-logos', $2), ($3, 'business-logos', $4),
       ($5, 'business-logos', $6), ($7, 'business-logos', $8),
       ($9, 'business-logos', $10), ($11, 'business-logos', $12),
       ($13, 'business-logos', $14), ($15, 'business-logos', $16),
       ($17, 'business-logos', $18)`,
      [
        ownIds[0],
        `${seed.businessA}/logo-${uuid()}.png`,
        ownIds[1],
        `${seed.businessA}/services/${uuid()}-service.png`,
        ownIds[2],
        `${seed.businessA}/background/${uuid()}.png`,
        ownIds[3],
        `${seed.businessA}/staging/${seed.ownerA}/${uuid()}/draft.png`,
        professionalStagingId,
        `${seed.businessA}/staging/${professionalUser}/${uuid()}/draft.png`,
        otherBusinessIds[0],
        `${seed.businessB}/logo-${uuid()}.png`,
        otherBusinessIds[1],
        `${seed.businessB}/services/${uuid()}-service.png`,
        otherBusinessIds[2],
        `${seed.businessB}/background/${uuid()}.png`,
        otherBusinessIds[3],
        `${seed.businessB}/staging/${seed.ownerB}/${uuid()}/draft.png`,
      ],
    );

    const visibleIds = async (actor: { role: "authenticated"; userId: string }) =>
      as(db, actor, () =>
        db.query("SELECT id FROM storage.objects WHERE id = ANY($1::uuid[])", [
          [...ownIds, professionalStagingId, ...otherBusinessIds],
        ]),
      );
    const ownerRows = await visibleIds(owner());
    expect(ownerRows.rows.map((row) => row["id"]).sort()).toEqual([...ownIds].sort());

    const professionalRows = await visibleIds({ role: "authenticated", userId: professionalUser });
    expect(professionalRows.rows.map((row) => row["id"]).sort()).toEqual(
      [...ownIds.slice(0, 3), professionalStagingId].sort(),
    );

    const otherOwnerRows = await visibleIds(otherOwner());
    expect(otherOwnerRows.rows.map((row) => row["id"]).sort()).toEqual(otherBusinessIds.sort());
  });
});

describe("funções SECURITY DEFINER", () => {
  it.each(["owns_business", "is_business_member", "has_business_permission"])(
    "%s fixa o search_path em public",
    async (name) => {
      const { rows } = await db.query(
        "SELECT proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1",
        [name],
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(String(row["proconfig"])).toContain("search_path=public");
    },
  );

  it.each([
    ["register_auth_failure", "('k', 5, 1000, 1000)"],
    ["cancel_overdue_business", `('${uuid()}')`],
    ["claim_post_service_messages", "(10)"],
    ["claim_whatsapp_greeting", `('${uuid()}', '5511999990000')`],
    ["claim_whatsapp_reminder", `('${uuid()}', '${uuid()}', 'whatsapp')`],
    ["finish_whatsapp_reminder", `('${uuid()}', '${uuid()}', 'whatsapp', '${uuid()}', true, NULL)`],
  ])("%s não é executável por anon nem authenticated", async (fn, args) => {
    for (const actor of [{ role: "anon" as const }, owner()]) {
      const result = await attempt(db, actor, `SELECT public.${fn}${args}`);
      expect(result.ok, `${fn} como ${actor.role}`).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/permission denied/i);
    }
  });
});

describe("T023: a migration de endurecimento é idempotente", () => {
  it("rodar a migration uma segunda e uma terceira vez não falha e não duplica policies nem triggers", async () => {
    const snapshot = async () => {
      const policies = await db.query(
        "SELECT count(*)::int AS n FROM pg_policies WHERE schemaname IN ('public','storage')",
      );
      const triggers = await db.query(
        "SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal",
      );
      const fees = await db.query(
        "SELECT value FROM public.platform_settings WHERE key = 'agpay_fees'",
      );
      return {
        policies: policies.rows[0]!["n"],
        triggers: triggers.rows[0]!["n"],
        fees: fees.rows[0]!["value"],
      };
    };
    // Valor alterado pelo master depois da primeira aplicação não pode ser sobrescrito pela reaplicação.
    await db.query(
      "UPDATE public.platform_settings SET value = '{\"deposit_fixed_cents\":99,\"withdraw_fixed_cents\":399}'::jsonb WHERE key = 'agpay_fees'",
    );
    const before = await snapshot();
    await db.query(migrationSql(HARDENING));
    await db.query(migrationSql(HARDENING));
    await restorePostHardeningMigrations();
    const after = await snapshot();
    expect(after).toEqual(before);
    expect(after.fees).toEqual({ deposit_fixed_cents: 99, withdraw_fixed_cents: 399 });
    await db.query(
      "UPDATE public.platform_settings SET value = '{\"deposit_fixed_cents\":75,\"withdraw_fixed_cents\":300}'::jsonb WHERE key = 'agpay_fees'",
    );
  });

  it("a reaplicação zera de novo qualquer segredo de SDR que reapareça", async () => {
    await db.query("DELETE FROM public.sdr_config");
    await db.query("INSERT INTO public.sdr_config (secret) VALUES ('segredo-antigo-em-texto')");
    await db.query(migrationSql(HARDENING));
    await restorePostHardeningMigrations();
    const { rows } = await db.query("SELECT secret FROM public.sdr_config");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row["secret"]).not.toBe("segredo-antigo-em-texto");
  });
});

describe("SDR session version schema", () => {
  it("defaults the version to zero and rejects negative values", async () => {
    const email = `sdr-${uuid()}@example.test`;
    const inserted = await db.query(
      "INSERT INTO public.sdrs (name, email, pin) VALUES ('Test SDR', $1, 'hash') RETURNING id, session_version",
      [email],
    );
    const id = String(inserted.rows[0]!["id"]);
    expect(inserted.rows[0]!["session_version"]).toBe(0);

    await expect(
      db.query("UPDATE public.sdrs SET session_version = -1 WHERE id = $1", [id]),
    ).rejects.toThrow(/sdrs_session_version_nonnegative/i);

    await db.query("DELETE FROM public.sdrs WHERE id = $1", [id]);
  });
});

describe("SEC-011: histórico de assinatura reservado ao owner", () => {
  it("nega leitura ao profissional e preserva leitura do owner", async () => {
    const professionalUser = uuid();
    const paymentId = uuid();
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [
      professionalUser,
      "billing-professional-" + professionalUser + "@agenda.local",
    ]);
    await db.query(
      "INSERT INTO public.professionals (business_id, user_id, name, permissions) VALUES ($1, $2, 'Profissional', '{}'::jsonb)",
      [seed.businessA, professionalUser],
    );
    await db.query(
      "INSERT INTO public.subscription_payments (id, business_id, reference_month, amount_cents, status) VALUES ($1, $2, '2099-03-01', 8990, 'pago')",
      [paymentId, seed.businessA],
    );

    try {
      const ownerRead = await as(db, owner(), () =>
        db.query("SELECT id, amount_cents FROM public.subscription_payments WHERE id = $1", [
          paymentId,
        ]),
      );
      const professionalRead = await as(
        db,
        { role: "authenticated", userId: professionalUser },
        () =>
          db.query("SELECT id, amount_cents FROM public.subscription_payments WHERE id = $1", [
            paymentId,
          ]),
      );

      expect(ownerRead.rows).toEqual([{ id: paymentId, amount_cents: 8990 }]);
      expect(professionalRead.rowCount).toBe(0);
    } finally {
      await db.query("DELETE FROM public.subscription_payments WHERE id = $1", [paymentId]);
    }
  });
});
describe("SEC-014: catÃ¡logo pÃºblico somente pelo endpoint por slug", () => {
  it("nega SELECT anon direto no catÃ¡logo e preserva acesso autenticado e server-side", async () => {
    const tables = [
      "businesses",
      "services",
      "professionals",
      "service_professionals",
      "business_hours",
      "service_categories",
      "time_blocks",
    ];
    const { rows } = await db.query(
      `SELECT table_name,
              has_table_privilege('anon', format('public.%I', table_name), 'SELECT') AS table_select,
              EXISTS (
                SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public' AND c.table_name = t.table_name
                  AND has_column_privilege('anon', format('public.%I', t.table_name), c.column_name, 'SELECT')
              ) AS column_select,
              has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') AS authenticated_select,
              has_table_privilege('service_role', format('public.%I', table_name), 'SELECT') AS service_select
       FROM unnest($1::text[]) AS t(table_name)
       ORDER BY table_name`,
      [tables],
    );

    expect(rows).toHaveLength(tables.length);
    for (const row of rows) {
      expect(row["table_select"], `${row["table_name"]} table grant`).toBe(false);
      expect(row["column_select"], `${row["table_name"]} column grant`).toBe(false);
      if (row["table_name"] === "businesses") {
        expect(row["authenticated_select"], "businesses não tem grant SELECT de tabela").toBe(
          false,
        );
      } else {
        expect(row["authenticated_select"], `${row["table_name"]} authenticated grant`).toBe(true);
      }
      expect(row["service_select"], `${row["table_name"]} service grant`).toBe(true);
    }

    const businessColumnGrants = await db.query(
      `SELECT has_column_privilege('authenticated', 'public.businesses', 'id', 'SELECT') AS safe_select,
              has_column_privilege('authenticated', 'public.businesses', 'withdrawal_pix_key', 'SELECT') AS secret_select,
              has_column_privilege('anon', 'public.businesses', 'name', 'SELECT') AS anon_select`,
    );
    expect(businessColumnGrants.rows[0]).toEqual({
      safe_select: true,
      secret_select: false,
      anon_select: false,
    });
  });
});
