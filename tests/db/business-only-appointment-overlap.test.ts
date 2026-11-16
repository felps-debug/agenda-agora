import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, seedBasics, type PgClient, type Seed } from "./helpers";

let db: PgClient;
let seed: Seed;

beforeAll(async () => {
  db = await connect();
  seed = await seedBasics(db);
});

afterAll(async () => {
  await db.end();
});

const createAppointment = async (
  client: PgClient,
  startsAt: string,
  endsAt: string,
  status = "agendado",
  professionalId: string | null = null,
) => {
  await client.query(
    `INSERT INTO public.appointments
       (business_id, professional_id, customer_name, starts_at, ends_at, status)
     VALUES ($1, $5, 'Cliente de ensaio', $2, $3, $4)`,
    [seed.businessA, startsAt, endsAt, status, professionalId],
  );
};

describe("conflito concorrente no calendário sem profissional", () => {
  it("mantém a proteção existente para o calendário de um profissional", async () => {
    const { rows } = await db.query(
      "INSERT INTO public.professionals (business_id, name) VALUES ($1, 'Profissional de ensaio') RETURNING id",
      [seed.businessA],
    );
    const professionalId = rows[0]!["id"] as string;
    const clients = await Promise.all([connect(), connect()]);
    const insert = async (client: PgClient) => {
      await client.query("BEGIN");
      try {
        await createAppointment(
          client,
          "2035-05-09T10:00:00Z",
          "2035-05-09T11:00:00Z",
          "agendado",
          professionalId,
        );
        await client.query("COMMIT");
        return true;
      } catch {
        await client.query("ROLLBACK");
        return false;
      }
    };
    try {
      const results = await Promise.all(clients.map(insert));
      expect(results.filter(Boolean)).toHaveLength(1);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("permite somente uma criação concorrente no mesmo intervalo", async () => {
    const clients = await Promise.all([connect(), connect()]);
    const insert = async (client: PgClient) => {
      await client.query("BEGIN");
      try {
        await createAppointment(client, "2035-05-10T10:00:00Z", "2035-05-10T11:00:00Z");
        await client.query("COMMIT");
        return true;
      } catch {
        await client.query("ROLLBACK");
        return false;
      }
    };
    try {
      const results = await Promise.all(clients.map(insert));
      expect(results.filter(Boolean)).toHaveLength(1);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("permite somente uma remarcação concorrente para o mesmo intervalo", async () => {
    await createAppointment(db, "2035-05-11T08:00:00Z", "2035-05-11T09:00:00Z");
    await createAppointment(db, "2035-05-11T09:00:00Z", "2035-05-11T10:00:00Z");
    const { rows } = await db.query(
      `SELECT id FROM public.appointments
       WHERE business_id = $1 AND starts_at::date = '2035-05-11'
       ORDER BY starts_at`,
      [seed.businessA],
    );
    const clients = await Promise.all([connect(), connect()]);
    const reschedule = async (client: PgClient, appointmentId: unknown) => {
      await client.query("BEGIN");
      try {
        await client.query(
          `UPDATE public.appointments
           SET starts_at = '2035-05-11T12:00:00Z', ends_at = '2035-05-11T13:00:00Z'
           WHERE id = $1`,
          [appointmentId],
        );
        await client.query("COMMIT");
        return true;
      } catch {
        await client.query("ROLLBACK");
        return false;
      }
    };
    try {
      const results = await Promise.all(
        clients.map((client, index) => reschedule(client, rows[index]!["id"])),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("permite horários adjacentes e cancelados, mas mantém o hold de sinal", async () => {
    await createAppointment(db, "2035-05-12T10:00:00Z", "2035-05-12T11:00:00Z");
    await expect(
      createAppointment(db, "2035-05-12T11:00:00Z", "2035-05-12T12:00:00Z"),
    ).resolves.toBeUndefined();
    await expect(
      createAppointment(db, "2035-05-12T10:15:00Z", "2035-05-12T10:45:00Z", "cancelado"),
    ).resolves.toBeUndefined();
    await createAppointment(db, "2035-05-13T10:00:00Z", "2035-05-13T11:00:00Z", "aguardando_sinal");
    await expect(
      createAppointment(db, "2035-05-13T10:15:00Z", "2035-05-13T10:45:00Z"),
    ).rejects.toThrow();
  });

  it("mantém o hold de sinal para agendamentos de um profissional", async () => {
    const { rows } = await db.query(
      "INSERT INTO public.professionals (business_id, name) VALUES ($1, 'Profissional hold') RETURNING id",
      [seed.businessA],
    );
    const professionalId = rows[0]!["id"] as string;
    await createAppointment(
      db,
      "2035-05-14T10:00:00Z",
      "2035-05-14T11:00:00Z",
      "aguardando_sinal",
      professionalId,
    );
    await expect(
      createAppointment(
        db,
        "2035-05-14T10:15:00Z",
        "2035-05-14T10:45:00Z",
        "agendado",
        professionalId,
      ),
    ).rejects.toThrow();
  });
});
