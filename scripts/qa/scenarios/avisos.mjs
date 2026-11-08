import { qaContext } from "../helpers.mjs";
import assert from "node:assert/strict";
import { loginOwner, navigateSidebar } from "../helpers.mjs";
import { withBillingStage } from "../seed.mjs";

export async function avisos(browser) {
  let persisted = null;
  for (const stage of ["amanha", "venceu_hoje", "atrasado", "urgente"]) {
    await withBillingStage(stage, async () => {
      // Keep only one page alive; carry device dismissals across bounded contexts.
      const context = await qaContext(browser);
      if (persisted)
        await context.addInitScript((value) => {
          if (!localStorage.getItem("agenda-agora:avisos-dismissed"))
            localStorage.setItem("agenda-agora:avisos-dismissed", value);
        }, persisted);
      const page = await context.newPage();
      try {
        await loginOwner(page);
        await page.waitForLoadState("networkidle");
        if (stage === "amanha") {
          const broadcast = page.locator(".aa-aviso-pop--broadcast");
          await broadcast.waitFor({ state: "visible", timeout: 10000 });
          await broadcast.getByRole("button", { name: /Fechar/ }).click();
          await page.reload({ waitUntil: "networkidle" });
          assert.equal(await broadcast.count(), 0, "Broadcast dismissal lost on F5");
          console.log("PASS broadcast dismissal survives F5");
        }
        console.log("Billing scenario stage: " + stage);
        const notice = page.locator(
          stage === "urgente" ? "#expired-modal-card" : ".aa-aviso-faturamento",
        );
        await notice.waitFor({ state: "visible", timeout: 20000 });
        await notice.getByRole("button", { name: /Fechar/ }).click();
        await navigateSidebar(page, "/painel/servicos");
        await navigateSidebar(page, "/painel");
        assert.equal(await notice.count(), 0, "Dismissal lost on SPA navigation: " + stage);
        await page.reload({ waitUntil: "networkidle" });
        assert.equal(await notice.count(), 0, "Dismissal lost on F5: " + stage);
        const marker = await page.evaluate((stage) => {
          const map = JSON.parse(localStorage.getItem("agenda-agora:avisos-dismissed") ?? "{}");
          return map.cobranca?.find((value) => value.includes(":" + stage + ":"));
        }, stage);
        assert(marker, "Missing persistent marker: " + stage);
        // Simulate an expired dismissal without changing Auth/session clocks.
        await page.evaluate((marker) => {
          const map = JSON.parse(localStorage.getItem("agenda-agora:avisos-dismissed"));
          map.cobranca = map.cobranca.map((value) =>
            value === marker ? value.slice(0, -10) + "2000-01-01" : value,
          );
          localStorage.setItem("agenda-agora:avisos-dismissed", JSON.stringify(map));
        }, marker);
        await page.reload({ waitUntil: "domcontentloaded" });
        await notice.waitFor({ state: "visible", timeout: 20000 });
        await notice.getByRole("button", { name: /Fechar/ }).click();
        console.log("PASS aviso " + stage + ": SPA, F5, expired-day marker");
        await page.waitForLoadState("networkidle");
        persisted = await page.evaluate(() =>
          localStorage.getItem("agenda-agora:avisos-dismissed"),
        );
      } catch (error) {
        console.error(
          "Billing failure at " +
            page.url() +
            ": " +
            (await page.locator("body").innerText()).slice(-1800),
        );
        throw error;
      } finally {
        await context.close();
      }
    });
  }
}
