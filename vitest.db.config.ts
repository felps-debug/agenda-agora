import { defineConfig } from "vitest/config";

// Testes de contrato de banco (Spec 010). Rodam contra o banco de ensaio descartável
// (`scripts/ensaio/db.mjs`) ou contra `DATABASE_URL_TEST`, se definida. Nunca contra produção.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    pool: "forks",
  },
});
