import { expect, test } from "@playwright/test";

/**
 * US5 — A área de pagamento se chama "Ag Pay" (não "Carteira").
 * Requer sessão de dono. Valida que nenhuma string "Carteira" é visível e que
 * o rótulo "Ag Pay" aparece na sidebar/topo.
 */

test.describe("US5 — rebrand Ag Pay (requer sessão de dono)", () => {
  test.skip(
    !process.env["OWNER_STORAGE_STATE"],
    "Defina OWNER_STORAGE_STATE com o storageState de um dono para varrer a interface.",
  );
  test.use({ storageState: process.env["OWNER_STORAGE_STATE"] });

  test("nenhuma ocorrência visível de 'Carteira'; 'Ag Pay' presente", async ({ page }) => {
    await page.goto("/painel");
    await expect(page.getByText(/Carregando estabelecimento/i)).toHaveCount(0);

    // "Ag Pay" presente na navegação.
    await expect(page.getByText(/Ag Pay/i).first()).toBeVisible();

    // Varre as telas financeiras e confirma ausência de "Carteira" no texto visível.
    for (const path of ["/painel", "/painel/as-pay", "/painel/servicos"]) {
      await page.goto(path);
      await expect(page.getByText(/Carregando estabelecimento/i)).toHaveCount(0);
      const carteira = page.getByText(/\bCarteira\b/);
      await expect(carteira, `"Carteira" não deve aparecer em ${path}`).toHaveCount(0);
    }
  });

  test("a tela de performance exibe 'Ag Pay — Performance' (slug mantido por brand-privacy)", async ({
    page,
  }) => {
    // O slug da rota continua `carteira-desempenho` (o guard brand-privacy proíbe
    // "agpay" compacto em rotas); o rótulo visível é "Ag Pay — Performance".
    await page.goto("/painel/carteira-desempenho");
    await expect(page.getByText(/Ag Pay — Performance/i).first()).toBeVisible();
    await expect(page.getByText(/\bCarteira\b/)).toHaveCount(0);
  });
});
