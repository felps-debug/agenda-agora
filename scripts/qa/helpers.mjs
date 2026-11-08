import assert from "node:assert/strict";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
export const BASE = process.env.QA_BASE_URL ?? "http://localhost:3002";
export async function qaContext(browser) {
  const context = await browser.newContext({
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 900 },
  });
  if (process.env.QA_INJECT_DISMISSAL === "1") {
    await context.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "agenda-agora:avisos-dismissed") return;
        return original.call(this, key, value);
      };
    });
  }
  const fault = process.env.QA_INJECT_REGRESSION;
  if (fault)
    await context.addInitScript((fault) => {
      if (fault === "impersonacao") {
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            const style = document.createElement("style");
            style.textContent = ".impersonation-fab{visibility:hidden!important}";
            document.head.append(style);
          },
          { once: true },
        );
      }
      if (fault === "navegacao")
        document.addEventListener(
          "click",
          (event) => {
            if (!(event.target instanceof Element) || !event.target.closest('a[href^="/painel"]'))
              return;
            const skeleton = document.createElement("div");
            skeleton.className = "owner-route-skeleton";
            skeleton.textContent = "Carregando…";
            skeleton.style.cssText =
              "position:fixed;inset:0;z-index:99999;background:#000;color:white";
            document.body.append(skeleton);
            setTimeout(() => skeleton.remove(), 300);
          },
          true,
        );
      if (fault === "agendamento")
        document.addEventListener(
          "click",
          (event) => {
            if (!(event.target instanceof Element)) return;
            const button = event.target.closest("button");
            if (button?.closest('[role="dialog"]') && button.textContent.trim() === "Agendar") {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
          },
          true,
        );
    }, fault);
  return context;
}
export async function login(page, role = "owner") {
  const identifier = role === "master" ? process.env.QA_MASTER_EMAIL : process.env.QA_OWNER_PHONE;
  const password =
    role === "master" ? process.env.QA_MASTER_PASSWORD : process.env.QA_OWNER_PASSWORD;
  assert(
    identifier && password,
    "Set QA_" + (role === "master" ? "MASTER_EMAIL/MASTER_PASSWORD" : "OWNER_PHONE/OWNER_PASSWORD"),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(BASE + "/auth", { waitUntil: "domcontentloaded" });
    // SSR paints the form before React can handle submit. Wait for hydration.
    await page.waitForFunction(() => {
      const input = document.querySelector("#identifier");
      return input && Object.keys(input).some((key) => key.startsWith("__reactProps$"));
    });
    await page.locator("#identifier").fill(identifier);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /^Entrar$/ }).click();
    try {
      await page.waitForURL(/\/painel/, { timeout: 25000, waitUntil: "domcontentloaded" });
      await page
        .locator(role === "master" ? 'a[href="/painel/master"]' : 'a[href="/painel/servicos"]')
        .first()
        .waitFor({ state: "visible" });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}
export const loginOwner = (page) => login(page, "owner");
export const loginMaster = (page) => login(page, "master");
export async function navigateSidebar(page, route) {
  const target = new URL(route, BASE);
  await page
    .locator('a[href="' + route + '"]')
    .first()
    .click();
  {
    await page.waitForFunction(
      (target) =>
        (location.pathname === target.pathname && location.search === target.search) ||
        Array.from(document.querySelectorAll("button")).some(
          (button) => button.getClientRects().length && button.textContent.trim() === "Acessar",
        ),
      { pathname: target.pathname, search: target.search },
    );
    const access = page.getByRole("button", { name: "Acessar", exact: true });
    if (await access.isVisible()) {
      await page.locator('input[type="password"]').fill(process.env.MASTER_SECURITY_PIN);
      await access.click();
    }
  }
  await page.waitForURL((url) => url.pathname === target.pathname && url.search === target.search, {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator('main[data-resolved-pathname="' + target.pathname + '"][aria-busy="false"]')
    .waitFor({ state: "visible" });
}
export function collectErrors(page) {
  const errors = [];
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
export async function assertHealthy(page, errors) {
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("main p, main span")).some(
        (element) =>
          element.getClientRects().length > 0 &&
          /^(Carregando|Buscando)(\s|\.|…)/i.test(element.textContent.trim()),
      ),
    undefined,
    { timeout: 30000 },
  );
  await page.waitForFunction(() => [...document.images].every((img) => img.complete), undefined, {
    timeout: 15000,
  });
  const broken = await page
    .locator("img")
    .evaluateAll((imgs) =>
      imgs.filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.currentSrc.split(/[?#]/)[0]),
    );
  assert.deepEqual(broken, [], "Broken images at " + page.url());
  let text = await page.locator("body").innerText();
  // Literal error messages/stacks are diagnostic content, not broken UI placeholders.
  for (const diagnostic of await page.locator("[data-qa-diagnostic]").allInnerTexts())
    text = text.replace(diagnostic, "");
  assert(
    !/\bNaN\b|\bundefined\b|Invalid Date|\[object Object\]/.test(text),
    "Invalid text at " + page.url(),
  );
  assert.deepEqual(errors, [], "Console errors at " + page.url());
  const alerts = await page
    .locator('main [role="alert"]:visible, [data-sonner-toast][data-type="error"]:visible')
    .allInnerTexts();
  assert.deepEqual(alerts, [], "Visible error state at " + page.url());
  assert.equal(
    await page.getByRole("heading", { name: "Algo deu errado", exact: true }).count(),
    0,
    "Route error boundary at " + page.url(),
  );
}
