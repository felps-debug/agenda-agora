import { qaContext } from "../helpers.mjs";
import assert from "node:assert/strict";
import { BASE, collectErrors, assertHealthy } from "../helpers.mjs";
import { TEST_BUSINESS, testContext, assertTestBusiness } from "../seed.mjs";

export async function agendamento(browser) {
  const { admin, business } = await testContext();
  const id = assertTestBusiness(business);
  const context = await qaContext(browser);
  const page = await context.newPage();
  const errors = collectErrors(page);
  const customerName = "QA Public " + Date.now();
  try {
    await page.goto(BASE + "/agendar/" + TEST_BUSINESS.slug, { waitUntil: "networkidle" });
    const cookies = page.getByRole("button", { name: "Concordo", exact: true });
    if (await cookies.isVisible()) await cookies.click();
    await assertHealthy(page, errors);
    const service = page.getByRole("button").filter({ hasText: "QA Corte" }).first();
    if (await service.count()) await service.click();
    else
      await page
        .getByText("QA Corte", { exact: true })
        .locator('xpath=ancestor::*[.//button[normalize-space()="Agendar"]][1]')
        .getByRole("button", { name: "Agendar", exact: true })
        .click();
    const dialog = page.getByRole("dialog").last();
    const classicProfessional = dialog.getByRole("button", { name: /QA Principal/ }).first();
    const classicChosen = await classicProfessional.isVisible();
    if (classicChosen) await classicProfessional.click();
    const picker = dialog.locator('button[aria-haspopup="listbox"]');
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const iso = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const ddmm =
      String(date.getDate()).padStart(2, "0") + "/" + String(date.getMonth() + 1).padStart(2, "0");
    const eleganceDate = dialog.locator('[data-date="' + iso + '"]');
    if (await eleganceDate.count()) await eleganceDate.click();
    else
      await dialog
        .getByRole("button", { name: new RegExp("^" + ddmm) })
        .first()
        .click();
    if (!classicChosen) {
      await picker.waitFor({ state: "visible" });
      await picker.click();
      await dialog.getByRole("option", { name: /QA Principal/ }).click();
    }
    const time = dialog.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
    await time.click();
    await dialog.locator("#nome,#elegance-nome").fill(customerName);
    await dialog.locator("#fone,#elegance-fone").fill(business.phone);
    await dialog.getByRole("button", { name: "Agendar", exact: true }).click();
    await page
      .getByRole("heading", { name: /Agendamento confirmado/i })
      .waitFor({ timeout: 20000 });
    const { data: records, error } = await admin
      .from("appointments")
      .select("id,business_id,customer_name")
      .eq("business_id", id)
      .eq("customer_name", customerName);
    if (error) throw error;
    assert.equal(records.length, 1, "Public booking was not persisted exactly once");
    await assertHealthy(page, errors);
    console.log("PASS public booking persisted on dedicated test business");
  } catch (error) {
    console.error(
      "Public booking failure: " + (await page.locator("body").innerText()).slice(-2000),
    );
    console.error("Public console errors: " + JSON.stringify(errors));
    throw error;
  } finally {
    // Only this scenario's unique fixture can be removed; never touch seed/customer data.
    const result = await admin
      .from("appointments")
      .delete()
      .eq("business_id", id)
      .eq("customer_name", customerName);
    await context.close();
    if (result.error) throw result.error;
  }
  const { data: services, error } = await admin
    .from("services")
    .select("id,active")
    .eq("business_id", id);
  if (error) throw error;
  const emptyContext = await qaContext(browser);
  try {
    const result = await admin.from("services").update({ active: false }).eq("business_id", id);
    if (result.error) throw result.error;
    const emptyPage = await emptyContext.newPage();
    const emptyErrors = collectErrors(emptyPage);
    await emptyPage.goto(BASE + "/agendar/" + TEST_BUSINESS.slug, { waitUntil: "networkidle" });
    await emptyPage
      .getByText(/Nenhum serviço/i)
      .first()
      .waitFor();
    await assertHealthy(emptyPage, emptyErrors);
    console.log("PASS empty public catalog");
  } finally {
    for (const service of services) {
      const result = await admin
        .from("services")
        .update({ active: service.active })
        .eq("business_id", id)
        .eq("id", service.id);
      if (result.error) throw result.error;
    }
    await emptyContext.close();
  }
}
