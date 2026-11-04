/**
 * Banco de ensaio das migrations (Spec 010, T090).
 *
 * Sobe um Postgres 17 real e descartável (sem Docker), cria o stub do Supabase
 * (`supabase/test-support/auth-stub.sql`) e aplica TODAS as migrations de
 * `supabase/migrations/` em ordem, a partir de um banco vazio.
 *
 * Uso:
 *   node scripts/ensaio/db.mjs up       sobe, aplica tudo, imprime DATABASE_URL_TEST e fica rodando (Ctrl+C encerra)
 *   node scripts/ensaio/db.mjs check    sobe, aplica tudo, mede o tempo e encerra (código 1 se alguma migration falhar)
 *
 * Como biblioteca: `startEnsaio({ port, migrations })` devolve `{ url, query, stop }`.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "../..");
const dataDir = path.join(here, ".data");
const DEFAULT_PORT = Number(process.env.ENSAIO_PORT ?? 54330);
const PASSWORD = "ensaio";

export function ensureTooling() {
  if (fs.existsSync(path.join(here, "node_modules", "embedded-postgres"))) return;
  console.log("[ensaio] instalando ferramentas (uma vez só)…");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["install", "--no-audit", "--no-fund", "--no-package-lock"], {
    cwd: here,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0)
    throw new Error("Não foi possível instalar as ferramentas do banco de ensaio.");
}

export function loadPg() {
  ensureTooling();
  return createRequire(path.join(here, "package.json"))("pg");
}

export function migrationFiles(dir = path.join(appRoot, "supabase", "migrations")) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, path: path.join(dir, name) }));
}

export async function startEnsaio(options = {}) {
  ensureTooling();
  const port = options.port ?? DEFAULT_PORT;
  const { default: EmbeddedPostgres } = await import(
    pathToFileURL(path.join(here, "node_modules", "embedded-postgres", "dist", "index.js")).href
  );
  const pg = loadPg();
  fs.rmSync(dataDir, { recursive: true, force: true });
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: PASSWORD,
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  const url = `postgresql://postgres:${PASSWORD}@localhost:${port}/postgres`;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("SET client_encoding = 'UTF8'");
  const applied = [];
  const failures = [];
  try {
    await client.query(
      fs.readFileSync(path.join(appRoot, "supabase", "test-support", "auth-stub.sql"), "utf8"),
    );
    for (const file of options.migrations ?? migrationFiles()) {
      try {
        await client.query(fs.readFileSync(file.path, "utf8"));
        applied.push(file.name);
      } catch (error) {
        failures.push({ name: file.name, message: String(error.message).split("\n")[0] });
        try {
          await client.query("ROLLBACK");
        } catch {
          /* sem transação aberta */
        }
      }
    }
  } finally {
    await client.end();
  }
  return {
    url,
    pg,
    applied,
    failures,
    async stop() {
      await server.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

async function main() {
  const command = process.argv[2] ?? "up";
  if (!["up", "check"].includes(command)) {
    console.error("Uso: node scripts/ensaio/db.mjs <up|check>");
    process.exit(2);
  }
  const startedAt = Date.now();
  const ensaio = await startEnsaio();
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[ensaio] ${ensaio.applied.length} migrations aplicadas em ${seconds}s`);
  for (const failure of ensaio.failures)
    console.error(`[ensaio] FALHOU ${failure.name}: ${failure.message}`);
  if (command === "check" || ensaio.failures.length) {
    await ensaio.stop();
    process.exit(ensaio.failures.length ? 1 : 0);
  }
  console.log(`DATABASE_URL_TEST=${ensaio.url}`);
  console.log("[ensaio] banco no ar. Ctrl+C para encerrar.");
  const shutdown = async () => {
    await ensaio.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
