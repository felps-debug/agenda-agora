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
    ["withdrawal_pin_hash", "'abc123'"],
    ["withdrawal_pix_key", "'chave@exemplo.com'"],
    ["withdrawal_pix_key_type", "'email'"],
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
    const { rows } = await db.query("SELECT secret FROM public.sdr_config");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row["secret"]).not.toBe("segredo-antigo-em-texto");
  });
});
