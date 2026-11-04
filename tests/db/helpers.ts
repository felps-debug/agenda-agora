import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// `pg` vive nas ferramentas isoladas do banco de ensaio, não no app.
const ensaioRequire = createRequire(path.resolve(process.cwd(), "scripts/ensaio/package.json"));
const pg = ensaioRequire("pg") as {
  Client: new (config: { connectionString: string }) => PgClient;
};

export type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
};

export function databaseUrl(): string {
  const url = process.env["DATABASE_URL_TEST"];
  if (!url) throw new Error("DATABASE_URL_TEST não definida.");
  return url;
}

export async function connect(): Promise<PgClient> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  await client.query("SET client_encoding = 'UTF8'");
  return client;
}

export const uuid = () => randomUUID();

export function migrationSql(fileName: string): string {
  return readFileSync(path.resolve(process.cwd(), "supabase/migrations", fileName), "utf8");
}

export type Actor = { role: "anon" | "authenticated" | "service_role"; userId?: string };

/** Executa `fn` como o papel indicado (com claims do JWT) e sempre desfaz a transação. */
export async function as<T>(client: PgClient, actor: Actor, fn: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${actor.role}`);
    const claims = JSON.stringify({
      role: actor.role,
      ...(actor.userId ? { sub: actor.userId } : {}),
    });
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [claims]);
    return await fn();
  } finally {
    await client.query("ROLLBACK");
  }
}

/** Resultado da consulta ou a mensagem do erro, para asserções sobre o que o banco recusa. */
export async function attempt(
  client: PgClient,
  actor: Actor,
  text: string,
  values: unknown[] = [],
): Promise<{ ok: true; rowCount: number } | { ok: false; error: string }> {
  try {
    return await as(client, actor, async () => {
      const result = await client.query(text, values);
      return { ok: true as const, rowCount: result.rowCount ?? 0 };
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export type Seed = {
  ownerA: string;
  ownerB: string;
  master: string;
  businessA: string;
  businessB: string;
};

/** Cria dois donos, um master e um negócio para cada dono (dados comprometidos, ids únicos). */
export async function seedBasics(client: PgClient): Promise<Seed> {
  const seed: Seed = {
    ownerA: uuid(),
    ownerB: uuid(),
    master: uuid(),
    businessA: uuid(),
    businessB: uuid(),
  };
  for (const [id, label] of [
    [seed.ownerA, "dono-a"],
    [seed.ownerB, "dono-b"],
    [seed.master, "master"],
  ] as const) {
    await client.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [
      id,
      `${label}-${id}@agenda.local`,
    ]);
  }
  await client.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'super_admin')", [
    seed.master,
  ]);
  for (const [businessId, ownerId, slug] of [
    [seed.businessA, seed.ownerA, "a"],
    [seed.businessB, seed.ownerB, "b"],
  ] as const) {
    await client.query(
      "INSERT INTO public.businesses (id, owner_id, name, slug) VALUES ($1, $2, $3, $4)",
      [businessId, ownerId, `Negócio ${slug}`, `negocio-${slug}-${businessId.slice(0, 8)}`],
    );
  }
  return seed;
}
