import { describe, expect, it } from "vitest";
import { loadConfigFromFile } from "vite";

describe("hardening do servidor Vite de desenvolvimento", () => {
  it("não aceita qualquer host HTTP quando acessível na rede", async () => {
    const loaded = await loadConfigFromFile(
      { command: "serve", mode: "development" },
      `${process.cwd()}/vite.config.ts`,
    );

    expect(loaded?.config.server?.host).toBe(true);
    expect(loaded?.config.server?.allowedHosts).not.toBe(true);
  });
});
