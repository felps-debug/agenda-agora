import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { qaContext, BASE, loginMaster } from "../helpers.mjs";
import { TEST_BUSINESS, testContext, assertTestBusiness } from "../seed.mjs";
import { verifyErrorLogRls } from "../error-log-rls.mjs";

export async function monitoramento(browser) {
  const { admin, business } = await testContext();
  assertTestBusiness(business);
  const { error } = await admin.from("client_error_log").select("id").limit(1);
  if (error)
    throw Error(
      "Apply qa_client_error_log migration before monitoring acceptance: " + error.message,
    );
  await verifyErrorLogRls(admin, business);
  const marker = "QA_MONITOR_" + randomBytes(16).toString("hex").replace(/\d/g, "x");
  const context = await qaContext(browser);
  const page = await context.newPage();
  try {
    await page.goto(BASE + "/agendar/" + TEST_BUSINESS.slug, { waitUntil: "networkidle" });
    await page.evaluate(
      async ({ marker, development }) => {
        if (development) {
          const { installErrorCollector } = await import("/src/lib/error-collector.ts");
          const { logClientError } = await import("/src/lib/error-log.functions.ts");
          window.__qaStopMonitor = installErrorCollector((error) =>
            logClientError({ data: error }),
          );
        }
        for (let i = 0; i < 2; i++)
          window.dispatchEvent(
            new ErrorEvent("error", { message: marker, error: new Error(marker) }),
          );
      },
      { marker, development: process.env.QA_PRODUCTION !== "1" },
    );
    let rows = [];
    for (let attempt = 0; attempt < 30; attempt++) {
      const result = await admin
        .from("client_error_log")
        .select("id,message,source,kind")
        .eq("message", marker);
      if (result.error) throw result.error;
      rows = result.data;
      if (rows.length) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(
      rows.length,
      1,
      "Client monitoring failed to persist/deduplicate the injected UI error",
    );
    assert.equal(rows[0].kind, "ui_error");
    await page.evaluate(() => window.__qaStopMonitor?.());
    await loginMaster(page);
    await page.goto(BASE + "/painel/erros", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: marker, exact: true }).waitFor({ timeout: 20000 });
    console.log("PASS anonymous UI error, deduplicated record and master error dashboard");
  } finally {
    await context.close();
    const cleanup = await admin
      .from("client_error_log")
      .delete()
      .eq("message", marker)
      .eq("source", BASE + "/agendar/" + TEST_BUSINESS.slug);
    if (cleanup.error) throw cleanup.error;
  }
}
