import { expect, test } from "@playwright/test";

/**
 * US2 — Navegar na sidebar não recarrega o estabelecimento do zero.
 * Requer sessão de dono (OWNER_STORAGE_STATE), no padrão dos smokes autenticados.
 */

test.describe("US2 — navegação na sidebar sem reload (requer sessão de dono)", () => {
  test.skip(
    !process.env["OWNER_STORAGE_STATE"],
    "Defina OWNER_STORAGE_STATE com o storageState de um dono para exercitar o painel.",
  );
  test.use({ storageState: process.env["OWNER_STORAGE_STATE"] });

  const telas = [
    { label: /servi[çc]os/i, path: "/painel/servicos" },
    { label: /clientes/i, path: "/painel/clientes" },
    { label: /profissionais/i, path: "/painel/profissionais" },
    { label: /relat[óo]rio/i, path: "/painel/relatorio" },
  ];

  test("troca entre 4+ telas sem exibir 'Carregando estabelecimento...' após o 1º load", async ({
    page,
  }) => {
    await page.goto("/painel");
    // Aguarda o 1º load terminar (estabelecimento resolvido).
    await expect(page.getByText(/Carregando estabelecimento/i)).toHaveCount(0);

    for (const tela of telas) {
      await page.getByRole("link", { name: tela.label }).first().click();
      await expect(page).toHaveURL(new RegExp(tela.path.replace(/\//g, "\\/")));
      // O estabelecimento não deve recarregar do zero entre telas.
      await expect(page.getByText(/Carregando estabelecimento/i)).toHaveCount(0);
    }
  });
});
