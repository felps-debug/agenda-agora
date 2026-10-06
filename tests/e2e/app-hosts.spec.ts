import { expect, test } from "@playwright/test";

const productionHosts = [
  "https://app.agendagora.company",
  "https://painel.agendagora.company",
  "https://admin.agendagora.company",
] as const;

test.describe("hosts publicados", () => {
  test.skip(!process.env["SMOKE_PRODUCTION"], "Execute somente com SMOKE_PRODUCTION=true.");

  for (const host of productionHosts) {
    test(`${host} responde sem erro 5xx`, async ({ request }) => {
      const response = await request.get(host, { maxRedirects: 3 });
      expect(response.status(), `${host} retornou ${response.status()}`).toBeLessThan(500);
    });
  }
});
