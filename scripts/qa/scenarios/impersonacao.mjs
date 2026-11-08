import { qaContext } from "../helpers.mjs";
import assert from "node:assert/strict";
import { loginMaster, BASE } from "../helpers.mjs";
import { TEST_BUSINESS, testContext, assertTestBusiness } from "../seed.mjs";

export async function impersonacao(browser) {
  const context = await qaContext(browser);
  const page = await context.newPage();
  const timings = [];
  const starts = new Map();
  let profiling = false;
  page.on("request", (request) => {
    if (profiling) starts.set(request, Date.now());
  });
  page.on("requestfinished", (request) => {
    if (starts.has(request))
      timings.push({
        path: new URL(request.url()).pathname.slice(-50),
        ms: Date.now() - starts.get(request),
      });
  });
  try {
    await loginMaster(page);
    await page.goto(BASE + "/painel/master", { waitUntil: "networkidle" });
    const row = page.locator("tr").filter({ hasText: TEST_BUSINESS.name }).first();
    await row.getByRole("button", { name: /Ver detalhes|Ver informa/ }).click();
    const openPanel = page.getByRole("button", { name: /Abrir Painel 2/ });
    await openPanel.waitFor({ state: "visible" });
    const start = Date.now();
    profiling = true;
    await openPanel.click();
    await page.locator(".impersonation-fab").waitFor({ state: "visible", timeout: 20000 });
    const elapsed = Date.now() - start;
    profiling = false;
    console.log("Support entry: " + elapsed + "ms");
    console.log("Support request timings: " + JSON.stringify(timings));
    await page.locator(".impersonation-fab").click();
    await page.getByRole("button", { name: /Voltar ao Painel Master/ }).click();
    await page.locator("input[type=password]").last().fill(process.env.MASTER_RETURN_PIN);
    await page
      .getByRole("button", { name: /Voltar ao Painel Master/ })
      .last()
      .click();
    await page.waitForURL(/\/painel\/master/, { timeout: 20000, waitUntil: "domcontentloaded" });
    assert(elapsed <= 3000, "Support entry exceeded 3 seconds: " + elapsed + "ms");
    console.log("PASS support entry, indicator and PIN return");
    await row.getByRole("button", { name: /Ver detalhes|Ver informa/ }).click();
    await openPanel.waitFor({ state: "visible" });
    await openPanel.click();
    await page.locator(".impersonation-fab").waitFor({ state: "visible", timeout: 20000 });
    await page.locator(".impersonation-fab").click();
    await page.getByRole("button", { name: /Voltar ao Painel Master/ }).click();
    const realPin = process.env.MASTER_RETURN_PIN;
    const wrongPin = realPin === "00000000" ? "11111111" : "00000000";
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.locator("input[type=password]").last().fill(wrongPin);
      await page
        .getByRole("button", { name: /Voltar ao Painel Master/ })
        .last()
        .click();
      if (attempt < 2)
        await page
          .getByRole("alert")
          .filter({ hasText: /PIN incorreto/ })
          .waitFor();
    }
    await page.waitForURL(/\/auth/, { timeout: 20000, waitUntil: "domcontentloaded" });
    await page.getByText(/Sessão de acesso encerrada por segurança/).waitFor();
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("agenda-agora:impersonation")),
      null,
    );
    console.log("PASS three incorrect PINs close support and return to login with a clear message");
  } finally {
    const raw = await page
      .evaluate(() => sessionStorage.getItem("agenda-agora:impersonation"))
      .catch(() => null);
    if (raw) {
      const value = JSON.parse(raw);
      if (typeof value.token === "string") {
        const { admin, business } = await testContext();
        const id = assertTestBusiness(business);
        const { error } = await admin
          .from("master_impersonation_sessions")
          .delete()
          .eq("business_id", id)
          .eq("token", value.token);
        if (error) throw error;
      }
    }
    await context.close();
  }
}
