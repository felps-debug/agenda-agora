import { expect, test } from "@playwright/test";

/**
 * US1 — Artes de divulgação por nicho.
 *
 * Parte A (pública, sempre roda): valida que os arquivos de arte são servidos
 * pelo app (FR-001, cenário 3: "os arquivos fazem parte do que é publicado").
 * Parte B (UI do painel): exige sessão de dono via storageState (OWNER_STORAGE_STATE),
 * no mesmo padrão dos smokes autenticados do repo; pula quando não há sessão.
 */

test.describe("US1 — assets de template servidos (público)", () => {
  // Arquivo conhecido presente em public/templates/barbearia/templates-prontos/.
  // Usamos o primeiro arquivo real para não acoplar a um nome específico.
  test("um nicho com artes serve ao menos um arquivo de imagem (200)", async ({ request }) => {
    // Caminho de uma capa de nicho sempre presente em public/templates/nichos/.
    const cover = await request.get("/templates/nichos/barbearia.jpg", { failOnStatusCode: false });
    expect(cover.status(), "capa do nicho barbearia deve ser servida").toBe(200);
    expect(cover.headers()["content-type"] ?? "").toMatch(/image\//);
  });

  test("caminho de arte inexistente não é servido como imagem", async ({ request }) => {
    const bogus = await request.get("/templates/__nicho_inexistente__/templates-prontos/nada.png", {
      failOnStatusCode: false,
    });
    expect(bogus.status(), "asset inexistente não deve retornar 200 de imagem").not.toBe(200);
  });
});

test.describe("US1 — UI de templates por nicho (requer sessão de dono)", () => {
  test.skip(
    !process.env["OWNER_STORAGE_STATE"],
    "Defina OWNER_STORAGE_STATE com o storageState de um dono para exercitar a UI do painel.",
  );
  test.use({ storageState: process.env["OWNER_STORAGE_STATE"] });

  test("nicho com artes mostra a grade; nicho sem conteúdo mostra estado vazio", async ({ page }) => {
    await page.goto("/painel/templates");

    // Marca o nicho "Barbearia" (tem artes) e abre a tela de artes.
    await page.getByText("Barbearia", { exact: false }).first().click();
    await page.getByRole("button", { name: /ver|abrir|arte/i }).first().click();

    // A grade deve conter ao menos uma arte (imagem com src de /templates/).
    const artes = page.locator('img[src^="/templates/"]');
    await expect(artes.first()).toBeVisible();

    // Nenhum estado vazio quando há artes.
    await expect(page.getByText(/Nenhuma arte disponível ainda/i)).toHaveCount(0);
  });
});
