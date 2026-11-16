/**
 * Banco de ensaio das migrations (Spec 010, T090).
 *
 * Sobe um Postgres 17 real e descartável (sem Docker), cria o stub do Supabase
 * (`supabase/test-support/auth-stub.sql`) e aplica a baseline atualmente registrada
 * no Supabase mais as migrations locais posteriores a ela, em ordem.
 *
 * Uso:
 *   node scripts/ensaio/db.mjs up       sobe, aplica baseline + pendentes, imprime DATABASE_URL_TEST e fica rodando (Ctrl+C encerra)
 *   node scripts/ensaio/db.mjs check    sobe, aplica baseline + pendentes, mede o tempo e encerra (código 1 se alguma migration falhar)
 *
 * Como biblioteca: `startEnsaio({ port, migrations })` devolve `{ url, pg, applied, failures, stop }`.
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
  const baselinePath = path.join(appRoot, "supabase", "test-support", "migration-baseline.json");
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const appliedVersions = new Set(baseline.appliedVersions);
  const allFiles = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, path: path.join(dir, name) }));
  const byVersion = new Map(allFiles.map((file) => [file.name.slice(0, 14), file]));
  const missingBaseline = [...appliedVersions].filter((version) => !byVersion.has(version));
  if (missingBaseline.length) {
    throw new Error(`Migrations da baseline sem arquivo local: ${missingBaseline.join(", ")}`);
  }
  return allFiles.filter((file) => file.name.slice(0, 14) > baseline.latestAppliedVersion);
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
    await client.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
    // Snapshot ACLs must describe the captured production objects exactly. The Supabase-like
    // defaults from auth-stub would otherwise grant access to objects as they are imported,
    // and pg_dump's later REVOKEs cannot remove those direct grants.
    await client.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
    `);
    await client.query(
      fs.readFileSync(
        path.join(appRoot, "supabase", "test-support", "production-schema-baseline.sql"),
        "utf8",
      ),
    );
    await client.query(
      fs.readFileSync(
        path.join(appRoot, "supabase", "test-support", "production-baseline-fixtures.sql"),
        "utf8",
      ),
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
