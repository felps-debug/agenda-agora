import { qaContext } from "../helpers.mjs";
import {
  BASE,
  loginOwner,
  loginMaster,
  navigateSidebar,
  collectErrors,
  assertHealthy,
} from "../helpers.mjs";
import { TEST_BUSINESS } from "../seed.mjs";

export async function varredura(browser) {
  const failures = [];
  for (const role of ["owner", "master"]) {
    const context = await qaContext(browser);
    const page = await context.newPage();
    const errors = collectErrors(page);
    try {
      await (role === "owner" ? loginOwner(page) : loginMaster(page));
      await page.waitForLoadState("networkidle");
      const routes = await page
        .locator('aside a[href^="/painel"]:visible')
        .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))]);
      if (role === "owner")
        routes.push(
          "/painel/configuracoes?secao=preferencias",
          "/painel/configuracoes?secao=aparencia",
        );
      for (const route of routes) {
        try {
          if (role === "master" && route === "/painel") {
            await page.locator('a[href="/painel"]').first().click();
            await page.waitForURL(/\/painel\/master/, { waitUntil: "domcontentloaded" });
            await page
              .locator('main[data-resolved-pathname="/painel/master"][aria-busy="false"]')
              .waitFor();
          } else if (route.includes("/configuracoes?"))
            await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
          else await navigateSidebar(page, route);
          const pin = page.locator("input[type=password]").first();
          if (await pin.isVisible()) {
            await pin.fill(process.env.MASTER_SECURITY_PIN);
            await page.getByRole("button", { name: "Acessar", exact: true }).click();
          }
          await assertHealthy(page, errors);
          console.log("PASS " + role + " " + route);
        } catch (error) {
          failures.push(new Error(role + " " + route + ": " + error.message));
          console.error("FAIL " + role + " " + route + ": " + error.message);
          errors.length = 0;
        }
      }
    } finally {
      await context.close();
    }
  }
  const context = await qaContext(browser);
  try {
    const page = await context.newPage();
    const errors = collectErrors(page);
    for (const route of ["/auth", "/agendar/" + TEST_BUSINESS.slug]) {
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await assertHealthy(page, errors);
      console.log("PASS public " + route);
    }
  } finally {
    await context.close();
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Route sweep failed: " + failures.map((error) => error.message).join("; "),
    );
}
