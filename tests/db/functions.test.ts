import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attempt, connect, uuid, seedBasics, type PgClient, type Seed } from "./helpers";

let db: PgClient;
let seed: Seed;
let appointmentFixtureIndex = 0;

const nextAppointmentFixtureIndex = () => ++appointmentFixtureIndex;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
});

afterAll(async () => {
  await db.end();
});

const fail = (key: string, limit = 5, windowMs = 15 * 60_000, lockMs = 30 * 60_000) =>
  db.query("SELECT public.register_auth_failure($1, $2, $3, $4) AS retry", [
    key,
    limit,
    windowMs,
    lockMs,
  ]);

describe("limite de profissionais por negocio", () => {
  const addProfessionals = async (businessId: string, count: number) => {
    for (let index = 0; index < count; index++) {
      await db.query("INSERT INTO public.professionals (business_id, name) VALUES ($1, $2)", [
        businessId,
        `Profissional ${index + 1}`,
      ]);
    }
  };

  it("bloqueia INSERT direto do owner acima de dez profissionais", async () => {
    await addProfessionals(seed.businessA, 10);
    const result = await attempt(
      db,
      { role: "authenticated", userId: seed.ownerA },
      "INSERT INTO public.professionals (business_id, name) VALUES ($1, 'Extra')",
      [seed.businessA],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/limite.*10.*profissionais/i);
  });

  it("serializa criacoes concorrentes quando resta uma vaga", async () => {
    await addProfessionals(seed.businessB, 9);
    const clients = await Promise.all([connect(), connect()]);
    const insertAsOwner = async (client: PgClient, name: string) => {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL ROLE authenticated");
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ role: "authenticated", sub: seed.ownerB }),
        ]);
        await client.query("INSERT INTO public.professionals (business_id, name) VALUES ($1, $2)", [
          seed.businessB,
          name,
        ]);
        await client.query("COMMIT");
        return true;
      } catch {
        await client.query("ROLLBACK");
        return false;
      }
    };
    try {
      const inserted = await Promise.all(
        clients.map((client, index) => insertAsOwner(client, `Concorrente ${index + 1}`)),
      );
      expect(inserted.filter(Boolean)).toHaveLength(1);
      const { rows } = await db.query(
        "SELECT count(*)::int AS n FROM public.professionals WHERE business_id = $1",
        [seed.businessB],
      );
      expect(rows[0]!["n"]).toBe(10);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });
});

describe("register_auth_failure: limite de tentativas no banco", () => {
  it("conta falhas, bloqueia na quinta e informa o tempo restante", async () => {
    const key = `sdr:${uuid()}`;
    for (let i = 0; i < 4; i++) expect((await fail(key)).rows[0]!["retry"]).toBe(0);
    const fifth = (await fail(key)).rows[0]!["retry"] as number;
    expect(fifth).toBeGreaterThan(1790);
    expect(fifth).toBeLessThanOrEqual(1800);
  });

  it("enquanto bloqueado, novas falhas não estendem o bloqueio nem inflam a contagem", async () => {
    const key = `sdr:${uuid()}`;
    for (let i = 0; i < 5; i++) await fail(key);
    const before = await db.query(
      "SELECT failures, locked_until FROM public.auth_attempts WHERE key = $1",
      [key],
    );
    await fail(key);
    await fail(key);
    const after = await db.query(
      "SELECT failures, locked_until FROM public.auth_attempts WHERE key = $1",
      [key],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("a janela expira e a contagem recomeça em 1", async () => {
    const key = `sdr:${uuid()}`;
    for (let i = 0; i < 4; i++) await fail(key);
    await db.query(
      "UPDATE public.auth_attempts SET window_started_at = now() - interval '16 minutes' WHERE key = $1",
      [key],
    );
    expect((await fail(key)).rows[0]!["retry"]).toBe(0);
    const { rows } = await db.query("SELECT failures FROM public.auth_attempts WHERE key = $1", [
      key,
    ]);
    expect(rows[0]!["failures"]).toBe(1);
  });

  it("depois que o bloqueio vence, a próxima falha abre uma janela nova", async () => {
    const key = `sdr:${uuid()}`;
    for (let i = 0; i < 5; i++) await fail(key);
    await db.query(
      "UPDATE public.auth_attempts SET locked_until = now() - interval '1 second', window_started_at = now() - interval '40 minutes' WHERE key = $1",
      [key],
    );
    expect((await fail(key)).rows[0]!["retry"]).toBe(0);
    const { rows } = await db.query(
      "SELECT failures, locked_until FROM public.auth_attempts WHERE key = $1",
      [key],
    );
    expect(rows[0]!["failures"]).toBe(1);
    expect(rows[0]!["locked_until"]).toBeNull();
  });

  it("chamadas concorrentes não perdem contagem: exatamente 5 falhas bloqueiam", async () => {
    const key = `sdr:${uuid()}`;
    const clients = await Promise.all(Array.from({ length: 10 }, () => connect()));
    try {
      const results = await Promise.all(
        clients.map((client) =>
          client.query("SELECT public.register_auth_failure($1, 5, 900000, 1800000) AS retry", [
            key,
          ]),
        ),
      );
      const locked = results.filter((r) => (r.rows[0]!["retry"] as number) > 0).length;
      expect(locked).toBe(6); // a 5ª e as 5 seguintes veem o bloqueio já gravado
      const { rows } = await db.query("SELECT failures FROM public.auth_attempts WHERE key = $1", [
        key,
      ]);
      expect(rows[0]!["failures"]).toBe(5);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("chaves diferentes (e-mail x IP) são independentes", async () => {
    const a = `sdr:${uuid()}`;
    const b = `ip:${uuid()}`;
    for (let i = 0; i < 5; i++) await fail(a);
    expect((await fail(b)).rows[0]!["retry"]).toBe(0);
  });
});

describe("cancel_overdue_business: regra do dia 15", () => {
  const create = async (overrides: {
    accessUntilDays: number | null;
    trialDays?: number | null;
    cancelledAt?: boolean;
  }) => {
    const id = uuid();
    const owner = uuid();
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [
      owner,
      `o-${owner}@agenda.local`,
    ]);
    await db.query(
      `INSERT INTO public.businesses (id, owner_id, name, slug, trial_days, access_until, cancelled_at, status)
       VALUES ($1, $2, 'Inadimplente', $3, $4,
               CASE WHEN $5::int IS NULL THEN NULL ELSE now() - ($5::int * interval '1 day') END,
               CASE WHEN $6 THEN now() ELSE NULL END, 'ativo')`,
      [
        id,
        owner,
        `inad-${id.slice(0, 8)}`,
        overrides.trialDays ?? null,
        overrides.accessUntilDays,
        overrides.cancelledAt ?? false,
      ],
    );
    return id;
  };
  const cancel = async (id: string) =>
    (await db.query("SELECT public.cancel_overdue_business($1) AS done", [id])).rows[0]![
      "done"
    ] as boolean;

  it("cancela com 15+ dias, bloqueia o acesso, audita e avisa o dono", async () => {
    const id = await create({ accessUntilDays: 16 });
    expect(await cancel(id)).toBe(true);
    const business = await db.query(
      "SELECT status, cancelled_at FROM public.businesses WHERE id = $1",
      [id],
    );
    expect(business.rows[0]!["status"]).toBe("cancelado");
    expect(business.rows[0]!["cancelled_at"]).not.toBeNull();
    const events = await db.query(
      "SELECT type, title FROM public.master_business_events WHERE business_id = $1",
      [id],
    );
    expect(events.rows).toEqual([
      { type: "assinatura", title: "Acesso cancelado por inadimplência (dia 15)" },
    ]);
    const messages = await db.query(
      "SELECT sender, read_by_user FROM public.support_messages WHERE business_id = $1",
      [id],
    );
    expect(messages.rows).toEqual([{ sender: "master", read_by_user: false }]);
  });

  it("é idempotente: a segunda chamada não cancela nem duplica registros", async () => {
    const id = await create({ accessUntilDays: 20 });
    expect(await cancel(id)).toBe(true);
    expect(await cancel(id)).toBe(false);
    const events = await db.query(
      "SELECT count(*)::int AS n FROM public.master_business_events WHERE business_id = $1",
      [id],
    );
    expect(events.rows[0]!["n"]).toBe(1);
  });

  it("14 dias de atraso, conta em teste, já cancelada ou sem vencimento não são canceladas", async () => {
    expect(await cancel(await create({ accessUntilDays: 14 }))).toBe(false);
    expect(await cancel(await create({ accessUntilDays: 30, trialDays: 7 }))).toBe(false);
    expect(await cancel(await create({ accessUntilDays: 30, cancelledAt: true }))).toBe(false);
    expect(await cancel(await create({ accessUntilDays: null }))).toBe(false);
    expect(await cancel(uuid())).toBe(false);
  });

  it("conta criada como trial mas com pagamento confirmado segue a regra de assinante", async () => {
    const id = await create({ accessUntilDays: 30, trialDays: 7 });
    await db.query(
      `INSERT INTO public.subscription_payments (business_id, reference_month, amount_cents, status, paid_at)
       VALUES ($1, date_trunc('month', now())::date, 8990, 'pago', now())`,
      [id],
    );

    expect(await cancel(id)).toBe(true);
  });

  it("reconhece cobrança paga mesmo se o histórico best-effort não foi gravado", async () => {
    const id = await create({ accessUntilDays: 30, trialDays: 7 });
    await db.query(
      `INSERT INTO public.subscription_charges (business_id, provider_payment_id, amount_cents, status)
       VALUES ($1, $2, 8990, 'paid')`,
      [id, `tx-${id}`],
    );

    expect(await cancel(id)).toBe(true);
  });

  it("chamadas simultâneas cancelam uma única vez", async () => {
    const id = await create({ accessUntilDays: 25 });
    const clients = await Promise.all(Array.from({ length: 5 }, () => connect()));
    try {
      const results = await Promise.all(
        clients.map((client) =>
          client.query("SELECT public.cancel_overdue_business($1) AS done", [id]),
        ),
      );
      expect(results.filter((r) => r.rows[0]!["done"] === true)).toHaveLength(1);
      const events = await db.query(
        "SELECT count(*)::int AS n FROM public.master_business_events WHERE business_id = $1",
        [id],
      );
      expect(events.rows[0]!["n"]).toBe(1);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });
});

describe("saudação do WhatsApp: reserva atômica e janela de 30 min", () => {
  const claim = async (phone: string) =>
    (
      await db.query("SELECT public.claim_whatsapp_greeting($1, $2) AS token", [
        seed.businessA,
        phone,
      ])
    ).rows[0]!["token"] as string | null;
  const finish = async (phone: string, token: string, sent: boolean) =>
    (
      await db.query("SELECT public.finish_whatsapp_greeting($1, $2, $3, $4) AS ok", [
        seed.businessA,
        phone,
        token,
        sent,
      ])
    ).rows[0]!["ok"] as boolean;

  it("a primeira mensagem reserva o envio; a segunda, enquanto reservado, não", async () => {
    const phone = "5511900000001";
    const token = await claim(phone);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(await claim(phone)).toBeNull();
  });

  it("permite nova saudação após 30 min, mas não antes", async () => {
    const phone = "5511900000002";
    const token = (await claim(phone))!;
    expect(await finish(phone, token, true)).toBe(true);
    expect(await claim(phone)).toBeNull();
    await db.query(
      "UPDATE public.whatsapp_greeting_replies SET replied_at = now() - interval '29 minutes 59 seconds' WHERE business_id = $1 AND sender_phone = $2",
      [seed.businessA, phone],
    );
    expect(await claim(phone)).toBeNull();
    await db.query(
      "UPDATE public.whatsapp_greeting_replies SET replied_at = now() - interval '30 minutes' WHERE business_id = $1 AND sender_phone = $2",
      [seed.businessA, phone],
    );
    expect(await claim(phone)).not.toBeNull();
  });

  it("envio que falhou libera nova tentativa na hora (replied_at antigo mantido)", async () => {
    const phone = "5511900000003";
    const token = (await claim(phone))!;
    expect(await finish(phone, token, false)).toBe(true);
    expect(await claim(phone)).not.toBeNull();
  });

  it("finish com token errado não altera nada", async () => {
    const phone = "5511900000004";
    await claim(phone);
    expect(await finish(phone, uuid(), true)).toBe(false);
    expect(await claim(phone)).toBeNull();
  });

  it("reservas simultâneas do mesmo contato: só uma vence", async () => {
    const phone = "5511900000005";
    const clients = await Promise.all(Array.from({ length: 6 }, () => connect()));
    try {
      const results = await Promise.all(
        clients.map((client) =>
          client.query("SELECT public.claim_whatsapp_greeting($1, $2) AS token", [
            seed.businessA,
            phone,
          ]),
        ),
      );
      expect(results.filter((r) => r.rows[0]!["token"] !== null)).toHaveLength(1);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });
});

describe("claim de lembretes WhatsApp", () => {
  const claim = async (appointmentId: string, channel = "whatsapp") =>
    (
      await db.query("SELECT public.claim_whatsapp_reminder($1, $2, $3) AS token", [
        seed.businessA,
        appointmentId,
        channel,
      ])
    ).rows[0]!["token"] as string | null;
  const finish = async (appointmentId: string, channel: string, token: string, sent: boolean) =>
    (
      await db.query("SELECT public.finish_whatsapp_reminder($1, $2, $3, $4, $5, $6) AS ok", [
        seed.businessA,
        appointmentId,
        channel,
        token,
        sent,
        sent ? null : "provider offline",
      ])
    ).rows[0]!["ok"] as boolean;
  const createAppointment = async () => {
    const id = uuid();
    await db.query(
      `INSERT INTO public.appointments (id, business_id, customer_name, starts_at, ends_at, status)
       VALUES ($1, $2, 'Maria', now() + ($3::int * interval '2 hours'),
         now() + ($3::int * interval '2 hours') + interval '1 hour', 'agendado')`,
      [id, seed.businessA, nextAppointmentFixtureIndex()],
    );
    return id;
  };

  it("libera retry após falha, bloqueia claim concorrente e não repete envio concluído", async () => {
    const appointmentId = await createAppointment();
    const first = await claim(appointmentId);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(await claim(appointmentId)).toBeNull();
    expect(await finish(appointmentId, "whatsapp", first!, false)).toBe(true);

    const retry = await claim(appointmentId);
    expect(retry).toMatch(/^[0-9a-f-]{36}$/);
    expect(retry).not.toBe(first);
    expect(await finish(appointmentId, "whatsapp", retry!, true)).toBe(true);
    expect(await claim(appointmentId)).toBeNull();

    const { rows } = await db.query(
      "SELECT status, error, claim_token FROM public.reminder_logs WHERE appointment_id = $1 AND channel = 'whatsapp'",
      [appointmentId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "enviado", error: null, claim_token: null });
  });

  it("concede no máximo um claim entre processos simultâneos", async () => {
    const appointmentId = await createAppointment();
    const clients = await Promise.all(Array.from({ length: 6 }, () => connect()));
    try {
      const results = await Promise.all(
        clients.map((client) =>
          client.query("SELECT public.claim_whatsapp_reminder($1, $2, $3) AS token", [
            seed.businessA,
            appointmentId,
            "whatsapp-extra",
          ]),
        ),
      );
      expect(results.filter((result) => result.rows[0]!["token"] !== null)).toHaveLength(1);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });
});

describe("fila pós-atendimento", () => {
  const appointment = async () => {
    const id = uuid();
    await db.query(
      `INSERT INTO public.appointments (id, business_id, customer_name, starts_at, ends_at, status)
       VALUES ($1, $2, 'Maria', now() - ($3::int * interval '2 hours'),
         now() - ($3::int * interval '2 hours') + interval '1 hour', 'concluido')`,
      [id, seed.businessA, nextAppointmentFixtureIndex()],
    );
    return id;
  };

  it("entrega cada item uma vez só e ignora o que ainda não venceu", async () => {
    const due = await appointment();
    const future = await appointment();
    await db.query(
      "INSERT INTO public.post_service_message_queue (appointment_id, scheduled_at) VALUES ($1, now() - interval '1 minute')",
      [due],
    );
    await db.query(
      "INSERT INTO public.post_service_message_queue (appointment_id, scheduled_at) VALUES ($1, now() + interval '1 hour')",
      [future],
    );
    const first = await db.query("SELECT * FROM public.claim_post_service_messages(50)");
    expect(first.rows.map((r) => r["appointment_id"])).toEqual([due]);
    const second = await db.query("SELECT * FROM public.claim_post_service_messages(50)");
    expect(second.rows).toHaveLength(0);
  });

  it("um item preso por mais de 10 minutos volta para a fila", async () => {
    const id = await appointment();
    await db.query(
      "INSERT INTO public.post_service_message_queue (appointment_id, scheduled_at) VALUES ($1, now() - interval '1 hour')",
      [id],
    );
    await db.query("SELECT * FROM public.claim_post_service_messages(50)");
    await db.query(
      "UPDATE public.post_service_message_queue SET locked_at = now() - interval '11 minutes' WHERE appointment_id = $1",
      [id],
    );
    const again = await db.query("SELECT * FROM public.claim_post_service_messages(50)");
    expect(again.rows.map((r) => r["appointment_id"])).toContain(id);
  });

  it("o mesmo atendimento não entra duas vezes na fila", async () => {
    const id = await appointment();
    await db.query(
      "INSERT INTO public.post_service_message_queue (appointment_id, scheduled_at) VALUES ($1, now())",
      [id],
    );
    await expect(
      db.query(
        "INSERT INTO public.post_service_message_queue (appointment_id, scheduled_at) VALUES ($1, now())",
        [id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });
});
