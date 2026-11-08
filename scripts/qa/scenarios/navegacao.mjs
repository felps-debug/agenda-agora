import { qaContext } from "../helpers.mjs";
import assert from "node:assert/strict";
import { loginOwner, navigateSidebar, collectErrors, assertHealthy } from "../helpers.mjs";

export async function navegacao(browser) {
  const context = await qaContext(browser);
  const page = await context.newPage();
  const errors = collectErrors(page);
  try {
    await loginOwner(page);
    const routes = ["/painel/servicos", "/painel/funcionamento", "/painel/clientes", "/painel"];
    for (const route of routes) {
      await navigateSidebar(page, route);
      await assertHealthy(page, errors);
    }
    const startObserver = () =>
      page.evaluate(() => {
        window.__qaSkeletonSeen = false;
        window.__qaSkeletonObserver = new MutationObserver(() => {
          if (document.querySelector(".owner-route-skeleton")) window.__qaSkeletonSeen = true;
        });
        window.__qaSkeletonObserver.observe(document.body, { childList: true, subtree: true });
      });
    const tables = {
      "/painel/servicos": /\/(services|service_professionals)$/,
      "/painel/funcionamento": /\/business_hours$/,
      "/painel/clientes": /\/(customers|appointments)$/,
      "/painel": /\/(services|professionals|business_hours|time_blocks)$/,
    };
    for (const route of routes) {
      // Refresh this particular route first: initial Vite compilation of all screens
      // on a 4 GB machine can outlast the legitimate 60 second cache window.
      await navigateSidebar(page, route);
      await assertHealthy(page, errors);
      const warmedAt = Date.now();
      const images = await page
        .locator("img")
        .evaluateAll((images) => images.map((image) => image.currentSrc));
      if (route === "/painel/servicos")
        await page.getByRole("heading", { level: 1, name: "Serviços", exact: true }).waitFor();
      await navigateSidebar(page, route === "/painel" ? "/painel/servicos" : "/painel");
      await assertHealthy(page, errors);
      const requests = [];
      const capture = (request) => {
        if (request.url().includes("/rest/v1/")) requests.push(request.url().split("?")[0]);
      };
      page.on("request", capture);
      await startObserver();
      await navigateSidebar(page, route);
      await assertHealthy(page, errors);
      page.off("request", capture);
      const seen = await page.evaluate(() => {
        window.__qaSkeletonObserver.disconnect();
        return window.__qaSkeletonSeen;
      });
      assert(
        Date.now() - warmedAt < 60000,
        "QA precondition: route cache expired before verification",
      );
      assert.equal(seen, false, "Cached navigation displayed route skeleton: " + route);
      assert.deepEqual(
        requests.filter((url) => tables[route].test(url)),
        [],
        "Fresh cached navigation repeated data queries: " + route,
      );
      const currentImages=await page.locator("img").evaluateAll((images) => images.map((image) => image.currentSrc));
      assert(currentImages.length===images.length && currentImages.every((url,index)=>url===images[index]),"Cached image URLs changed on navigation: " + route);
      console.log("PASS cached route " + route);
    }
    await page.locator(".owner-assinatura-nav").click();
    const payment = page.getByRole("button", { name: "Pagar assinatura por Pix", exact: true });
    await payment.waitFor({ state: "visible" });
    assert(
      await payment.evaluate((button) => !!button.closest(".report-luminous-card")),
      "Subscription payment is outside its card",
    );
    console.log("PASS services h1, working-hours keys and payment action inside subscription card");
    console.log("PASS navigation: no route skeleton or core data refetch with fresh cache");
  } finally {
    await context.close();
  }
}
