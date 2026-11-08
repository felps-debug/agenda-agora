import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { qaContext, loginMaster, loginOwner, BASE } from "../helpers.mjs";
import { testContext, assertTestBusiness, assertDedicatedOwner } from "../seed.mjs";

export async function ficha(browser) {
  const { admin, business } = await testContext();
  const id = assertTestBusiness(business);
  await assertDedicatedOwner(admin, business);
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,email,full_name")
    .eq("id", business.owner_id)
    .single();
  if (error) throw error;
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(
    business.owner_id,
  );
  if (authError) throw authError;
  assert(authData.user?.email, "Test owner must have an Auth login");
  const originalPhone = process.env.QA_OWNER_PHONE;
  const originalPassword = process.env.QA_OWNER_PASSWORD;
  assert(
    originalPassword && originalPhone === business.phone,
    "Ficha QA requires the dedicated test owner credentials",
  );
  const context = await qaContext(browser);
  const page = await context.newPage();
  let ownerContext;
  let masterClosed = false;
  let edited = false;
  async function save(label, value) {
    await page.getByRole("button", { name: "Editar " + label, exact: true }).click();
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.waitForFunction((label) => {
      const input = [...document.querySelectorAll("input")].find(
        (input) => input.getAttribute("aria-label") === label,
      );
      return !input || !!input.closest("dd")?.querySelector('[role="alert"]');
    }, label);
    const input = page.getByLabel(label, { exact: true });
    if (await input.isVisible())
      throw Error(await input.locator("xpath=ancestor::dd").getByRole("alert").innerText());
  }
  try {
    await loginMaster(page);
    await page.goto(BASE + "/painel/master", { waitUntil: "networkidle" });
    await page.getByRole("searchbox").fill(business.name);
    await page.getByRole("searchbox").press("Escape");
    await page
      .locator("tr")
      .filter({ hasText: business.name })
      .getByRole("button", { name: /Ver detalhes/ })
      .click();
    await page.getByRole("button", { name: "Editar Nome", exact: true }).waitFor();
    // No account is edited until the dedicated fixture has been verified above.
    edited = true;
    await save("Nome", business.name + " QA");
    await save("Responsável", "Responsável QA");
    let phone;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = "119" + String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
      const { data, error } = await admin
        .from("profiles")
        .select("id")
        .eq("email", candidate + "@agenda.local")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        phone = candidate;
        break;
      }
    }
    assert(phone, "Could not allocate a collision-free test phone");
    await save("Telefone de login", phone);
    await page.getByRole("button", { name: "Editar Senha", exact: true }).click();
    await page.getByLabel("Senha", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: /8 a 128/ })
      .waitFor();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    const password = "Qa1" + randomBytes(12).toString("hex");
    await save("Senha", password);
    const { data: stored, error: storedError } = await admin
      .from("businesses")
      .select("name,phone")
      .eq("id", id)
      .single();
    if (storedError) throw storedError;
    assert.equal(stored.name, business.name + " QA");
    assert.equal(stored.phone, phone);
    const { data: responsible } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", business.owner_id)
      .single();
    assert.equal(responsible.full_name, "Responsável QA");
    process.env.QA_OWNER_PHONE = phone;
    process.env.QA_OWNER_PASSWORD = password;
    await context.close();
    masterClosed = true;
    ownerContext = await qaContext(browser);
    await loginOwner(await ownerContext.newPage());
    const { data: events, error: eventError } = await admin
      .from("master_business_events")
      .select("type,actor_id,title,description")
      .eq("business_id", id)
      .in("type", ["edicao_ficha", "troca_senha_dono"]);
    if (eventError) throw eventError;
    assert(
      events.some(
        (event) =>
          event.type === "troca_senha_dono" && event.actor_id && event.title.includes("alterada"),
      ),
      "Password audit missing",
    );
    assert(!JSON.stringify(events).includes(password), "Password leaked to audit");
    console.log("PASS dossier edits, weak-password rejection, owner login and audit");
  } finally {
    process.env.QA_OWNER_PHONE = originalPhone;
    process.env.QA_OWNER_PASSWORD = originalPassword;
    const failures = [];
    if (edited) {
      const restoredAuth = await admin.auth.admin.updateUserById(business.owner_id, {
        email: authData.user.email,
        password: originalPassword,
        email_confirm: true,
      });
      if (restoredAuth.error) failures.push(restoredAuth.error);
      const profileResult = await admin
        .from("profiles")
        .update({ email: profile.email, full_name: profile.full_name })
        .eq("id", business.owner_id);
      if (profileResult.error) failures.push(profileResult.error);
      const businessResult = await admin
        .from("businesses")
        .update({ name: business.name, phone: business.phone })
        .eq("id", id)
        .eq("slug", business.slug);
      if (businessResult.error) failures.push(businessResult.error);
    }
    await ownerContext?.close();
    if (!masterClosed) await context.close();
    if (failures.length) throw new AggregateError(failures, "Test dossier restoration failed");
  }
}
