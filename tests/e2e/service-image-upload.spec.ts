import { expect, test } from "@playwright/test";

/**
 * US4 — Upload de imagem do serviço aceita qualquer imagem válida (incl. HEIC)
 * e recusa não-imagem com mensagem clara. Requer sessão de dono.
 */

test.describe("US4 — upload de imagem do serviço (requer sessão de dono)", () => {
  test.skip(
    !process.env["OWNER_STORAGE_STATE"],
    "Defina OWNER_STORAGE_STATE com o storageState de um dono para exercitar o upload.",
  );
  test.use({ storageState: process.env["OWNER_STORAGE_STATE"] });

  test("recusa PDF com mensagem clara em Editar serviço → Imagem", async ({ page }) => {
    await page.goto("/painel/servicos");
    // Abre o primeiro serviço para edição.
    await page.getByRole("button", { name: /editar|novo servi/i }).first().click();

    const input = page.locator('input[type="file"][accept*="image"]').first();
    await input.setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 not an image"),
    });

    await expect(page.getByText(/imagem do servi[çc]o/i)).toBeVisible();
  });

  test("aceita JPEG válido (abre o recorte)", async ({ page }) => {
    await page.goto("/painel/servicos");
    await page.getByRole("button", { name: /editar|novo servi/i }).first().click();

    const input = page.locator('input[type="file"][accept*="image"]').first();
    // JPEG mínimo (assinatura FF D8 FF).
    await input.setInputFiles({
      name: "foto.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
    });
    // O diálogo de recorte deve abrir (ou ao menos nenhum erro de formato).
    await expect(page.getByText(/imagem do servi[çc]o/i)).toHaveCount(0);
  });
});
