import { fileURLToPath, URL } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Config própria e mínima pra testes unitários de lógica pura (src/lib/*.functions.ts).
// Não usa o vite.config.ts do app de propósito: esse carrega o plugin do
// TanStack Start (SSR, nitro, etc.), que não faz sentido pra rodar testes de
// funções isoladas e só deixaria a suíte mais lenta/frágil.
//
// Testes de integração do ledger falam com o banco de dev e só rodam com
// LEDGER_DB_TESTS=1 (ex.: `$env:LEDGER_DB_TESTS=1; npx vitest run src/lib/ledger`).
// Nesse modo, só estas variáveis do .env entram no process.env dos testes; o `npm test`
// padrão continua hermético e nunca toca o banco.
const LEDGER_DB_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "LEDGER_TEST_BUSINESS_ID"];

export default defineConfig(({ mode }) => {
  const fileEnv = process.env["LEDGER_DB_TESTS"] ? loadEnv(mode, process.cwd(), "") : {};
  const ledgerEnv = Object.fromEntries(
    LEDGER_DB_ENV.flatMap((key) => (fileEnv[key] ? [[key, fileEnv[key]]] : [])),
  );
  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      env: ledgerEnv,
      // Os testes de integração compartilham a carteira do negócio de teste e asserem por delta:
      // arquivos em paralelo se atropelam. No modo banco, rodam um arquivo por vez.
      fileParallelism: !process.env["LEDGER_DB_TESTS"],
      // Idas ao banco remoto passam fácil de 5s; um timeout aborta o teste no meio e deixa
      // operações pendentes contaminando os seguintes.
      ...(process.env["LEDGER_DB_TESTS"] ? { testTimeout: 60_000 } : {}),
    },
  };
});
