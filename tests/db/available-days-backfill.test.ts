import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, migrationSql, uuid, type PgClient } from "./helpers";

const HARDENING = "20261103000000_security_hardening.sql";

let db: PgClient;

beforeAll(async () => {
  db = await connect();
});

afterAll(async () => {
  await db.end();
});

async function business(opensOnSunday: boolean) {
  const owner = uuid();
  const id = uuid();
  await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [
    owner,
    `o-${owner}@agenda.local`,
  ]);
  await db.query(
    "INSERT INTO public.businesses (id, owner_id, name, slug) VALUES ($1, $2, 'Barbearia', $3)",
    [id, owner, `dias-${id.slice(0, 8)}`],
  );
  const days = opensOnSunday ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  for (const weekday of days) {
    await db.query("INSERT INTO public.business_hours (business_id, weekday) VALUES ($1, $2)", [
      id,
      weekday,
    ]);
  }
  return id;
}

async function service(businessId: string, days: number[] | null) {
  const id = uuid();
  if (days === null) {
    await db.query("INSERT INTO public.services (id, business_id, name) VALUES ($1, $2, 'Corte')", [
      id,
      businessId,
    ]);
  } else {
    await db.query(
      "INSERT INTO public.services (id, business_id, name, available_days) VALUES ($1, $2, 'Corte', $3::smallint[])",
      [id, businessId, days],
    );
  }
  return id;
}

const daysOf = async (id: string) =>
  (
    (await db.query("SELECT available_days FROM public.services WHERE id = $1", [id])).rows[0]![
      "available_days"
    ] as number[]
  ).slice();

const marker = async () =>
  (
    await db.query(
      "SELECT value FROM public.platform_settings WHERE key = 'available_days_backfill_done'",
    )
  ).rows[0]!["value"];

describe("T083: backfill de domingo nos dias de atendimento", () => {
  it("o padrão do banco continua segunda a sábado para serviço novo", async () => {
    const id = await service(await business(false), null);
    expect(await daysOf(id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("restaura o domingo só para o padrão legado em negócio que abre no domingo, uma única vez", async () => {
    const opensSunday = await business(true);
    const closedSunday = await business(false);

    const legacyOpen = await service(opensSunday, [1, 2, 3, 4, 5, 6]); // deve ganhar domingo
    const legacyClosed = await service(closedSunday, [1, 2, 3, 4, 5, 6]); // negócio fechado no domingo: intacto
    const customDays = await service(opensSunday, [1, 3]); // escolha real do dono: intacto
    const customWeekdays = await service(opensSunday, [1, 2, 3, 4, 5]); // sem sábado: intacto
    const alreadyHasSunday = await service(opensSunday, [0, 1, 2, 3, 4, 5, 6]);

    await db.query(
      "UPDATE public.platform_settings SET value = 'false'::jsonb WHERE key = 'available_days_backfill_done'",
    );
    await db.query(migrationSql(HARDENING));

    expect(await daysOf(legacyOpen)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(await daysOf(legacyClosed)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await daysOf(customDays)).toEqual([1, 3]);
    expect(await daysOf(customWeekdays)).toEqual([1, 2, 3, 4, 5]);
    expect(await daysOf(alreadyHasSunday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(await marker()).toBe(true);
  });

  it("depois do marcador, reaplicar a migration não mexe mais em nenhum serviço", async () => {
    const opensSunday = await business(true);
    // dono desmarcou o domingo depois do backfill: precisa ser respeitado
    const ownerChoice = await service(opensSunday, [1, 2, 3, 4, 5, 6]);
    expect(await marker()).toBe(true);
    await db.query(migrationSql(HARDENING));
    await db.query(migrationSql(HARDENING));
    expect(await daysOf(ownerChoice)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("o domingo é aceito pelo schema e pode ser desmarcado depois", async () => {
    const id = await service(await business(true), [0, 1, 2, 3, 4, 5, 6]);
    await db.query("UPDATE public.services SET available_days = $2::smallint[] WHERE id = $1", [
      id,
      [1, 2, 3, 4, 5, 6],
    ]);
    expect(await daysOf(id)).toEqual([1, 2, 3, 4, 5, 6]);
    // A faixa 0-6 é validada no servidor (saveServiceInput); o banco não tem CHECK nessa coluna.
  });
});
