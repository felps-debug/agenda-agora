import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Config própria e mínima pra testes unitários de lógica pura (src/lib/*.functions.ts).
// Não usa o vite.config.ts do app de propósito: esse carrega o plugin do
// TanStack Start (SSR, nitro, etc.), que não faz sentido pra rodar testes de
// funções isoladas e só deixaria a suíte mais lenta/frágil.
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
