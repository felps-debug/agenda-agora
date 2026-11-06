import { expect, test } from "@playwright/test";

/**
 * US3 — Aviso/pop-up é exibido no máximo uma vez.
 * Requer sessão de dono (OWNER_STORAGE_STATE) e um aviso ativo criado pelo Master.
 * Além do fluxo de UI (gated), valida a lógica de persistência no localStorage,
 * que é a fonte de verdade da não-repetição.
 */

test.describe("US3 — aviso exibido uma vez (requer sessão de dono)", () => {
  test.skip(
    !process.env["OWNER_STORAGE_STATE"],
    "Defina OWNER_STORAGE_STATE com o storageState de um dono para exercitar o popup.",
  );
  test.use({ storageState: process.env["OWNER_STORAGE_STATE"] });

  test("popup aparece, é fechado e não reaparece ao navegar nem ao recarregar", async ({
    page,
  }) => {
    await page.goto("/painel");

    const popup = page.locator(".aa-aviso-pop--broadcast");
    // Se houver aviso ativo mais novo que o seenAt, ele aparece.
    if ((await popup.count()) === 0) {
      test.skip(true, "Nenhum aviso ativo para exercitar; crie um pelo Master.");
    }

    await expect(popup.first()).toBeVisible();
    // Fecha no X.
    await popup
      .first()
      .getByRole("button", { name: /fechar|close|×/i })
      .first()
      .click();
    await expect(popup).toHaveCount(0);

    // Navega e volta: não reaparece.
    await page
      .getByRole("link", { name: /clientes/i })
      .first()
      .click();
    await page
      .getByRole("link", { name: /in[íi]cio|agenda|painel/i })
      .first()
      .click();
    await expect(page.locator(".aa-aviso-pop--broadcast")).toHaveCount(0);

    // Recarrega a mesma sessão: continua não repetido (persistido em localStorage).
    await page.reload();
    await expect(page.locator(".aa-aviso-pop--broadcast")).toHaveCount(0);

    // O estado de dispensa deve estar persistido.
    const dismissed = await page.evaluate(() =>
      window.localStorage.getItem("agenda-agora:broadcasts-dismissed"),
    );
    expect(dismissed, "ids dispensados devem persistir no localStorage").toBeTruthy();
  });
});
