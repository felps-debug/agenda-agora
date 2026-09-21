import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Config própria e mínima pra testes unitários de lógica pura (src/lib/*.functions.ts).
// Não usa o vite.config.ts do app de propósito: esse carrega o plugin do
// TanStack Start (SSR, nitro, etc.), que não faz sentido pra rodar testes de
// funções isoladas e só deixaria a suíte mais lenta/frágil.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
