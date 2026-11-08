import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { avisos } from "./scenarios/avisos.mjs";
import { navegacao } from "./scenarios/navegacao.mjs";
import { impersonacao } from "./scenarios/impersonacao.mjs";
import { agendamento } from "./scenarios/agendamento.mjs";
import { varredura } from "./scenarios/varredura.mjs";
import { ficha } from "./scenarios/ficha.mjs";
import { monitoramento } from "./scenarios/monitoramento.mjs";
const available = { avisos, navegacao, impersonacao, agendamento, ficha, monitoramento, varredura };
const requested = (
  process.env.QA_SCENARIOS ??
  "avisos,navegacao,impersonacao,agendamento,ficha,monitoramento,varredura"
).split(",");
const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];
const persist = () => {
  mkdirSync("test-results/qa", { recursive: true });
  const injected =
    process.env.QA_INJECT_REGRESSION || (process.env.QA_INJECT_DISMISSAL === "1" ? "avisos" : "");
  const filename = injected
    ? "injected-" + injected.replace(/[^a-z0-9_-]/gi, "") + ".json"
    : "latest.json";
  writeFileSync(
    "test-results/qa/" + filename,
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
  );
};
try {
  for (const name of requested) {
    console.log("START " + name);
    if (!available[name]) throw Error("Unknown QA scenario: " + name);
    const started = Date.now();
    try {
      await available[name](browser);
      results.push({ name, ok: true, ms: Date.now() - started });
    } catch (error) {
      failures.push(error);
      results.push({ name, ok: false, ms: Date.now() - started, error: error.message });
      console.error("FAIL " + name + ": " + error.message);
    }
    persist();
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "QA scenarios failed: " +
        results
          .filter((result) => !result.ok)
          .map((result) => result.name)
          .join(", "),
    );
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      console.error("FAILED URL " + page.url());
      console.error(
        (
          await page
            .locator("body")
            .innerText()
            .catch(() => "")
        ).slice(-3000),
      );
    }
  throw error;
} finally {
  await browser.close();
}
