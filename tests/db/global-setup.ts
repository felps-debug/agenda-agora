import { startEnsaio } from "../../scripts/ensaio/db.mjs";

/**
 * Sobe o banco de ensaio (Postgres descartável + stub do Supabase + todas as migrations)
 * a menos que DATABASE_URL_TEST já aponte para um banco de ensaio pronto.
 */
export default async function setup() {
  if (process.env["DATABASE_URL_TEST"]) return undefined;
  const ensaio = await startEnsaio();
  if (ensaio.failures.length) {
    await ensaio.stop();
    const detail = ensaio.failures.map((f) => `${f.name}: ${f.message}`).join("\n");
    throw new Error(`Migrations falharam no banco de ensaio:\n${detail}`);
  }
  process.env["DATABASE_URL_TEST"] = ensaio.url;
  return async () => {
    await ensaio.stop();
  };
}
