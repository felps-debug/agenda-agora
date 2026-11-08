import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const TEST_BUSINESS = Object.freeze({ name: "Teste sdr", slug: "teste-sdr-g1jw" });
export function assertTestBusiness(business) {
  assert(
    business?.id && business.name === TEST_BUSINESS.name && business.slug === TEST_BUSINESS.slug,
    "Seed refused: writes are restricted to the dedicated test business",
  );
  return business.id;
}
export async function assertDedicatedOwner(admin, business) {
  const id = assertTestBusiness(business);
  const { data, error } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", business.owner_id);
  if (error) throw error;
  assert(
    data.length === 1 && data[0].id === id,
    "QA credential changes require an owner exclusive to the dedicated test business",
  );
}
export async function testContext() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  assert(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Server Supabase environment is required for seed",
  );
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: business, error } = await admin
    .from("businesses")
    .select("id,name,slug,owner_id,phone,access_until,status")
    .eq("slug", TEST_BUSINESS.slug)
    .single();
  if (error) throw error;
  assertTestBusiness(business);
  return { admin, business };
}

function fixtureId(businessId, key) {
  const hex = createHash("sha256")
    .update(businessId + ":qa:" + key)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
async function checked(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}

export async function seed() {
  const { admin, business } = await testContext();
  const businessId = assertTestBusiness(business);
  // Keep the dedicated fixture usable after its original trial/access has expired.
  const accessUntil = new Date();
  accessUntil.setDate(accessUntil.getDate() + 7);
  accessUntil.setHours(12, 0, 0, 0);
  await checked(
    admin
      .from("businesses")
      .update({
        status: "ativo",
        access_until: accessUntil.toISOString(),
        trial_days: null,
        trial_created_at: null,
        monthly_fee_cents: 8990,
      })
      .eq("id", businessId)
      .eq("slug", TEST_BUSINESS.slug),
  );
  const professionalId = fixtureId(businessId, "professional");
  await checked(
    admin.from("professionals").upsert(
      {
        id: professionalId,
        business_id: businessId,
        name: "QA Principal",
        public_name: "QA Principal",
        user_id: business.owner_id,
        permissions: { admin: true },
        active: true,
        working_days: [0, 1, 2, 3, 4, 5, 6],
      },
      { onConflict: "id" },
    ),
  );
  for (let weekday = 0; weekday < 7; weekday++) {
    await checked(
      admin
        .from("business_hours")
        .upsert(
          { business_id: businessId, weekday, starts_at: "08:00", ends_at: "18:00" },
          { onConflict: "business_id,weekday" },
        ),
    );
  }
  const images = ["servico-azul.png", "servico-rosa.png"];
  const services = [];
  for (let i = 0; i < 2; i++) {
    const imagePath = `${businessId}/services/qa-${i}.png`;
    const fixture = new URL("../../test-results/img/" + images[i], import.meta.url);
    assert(existsSync(fixture), "Generate QA image fixtures first: node scripts/qa/images.mjs");
    const upload = await admin.storage
      .from("business-logos")
      .upload(imagePath, readFileSync(fixture), { contentType: "image/png", upsert: true });
    if (upload.error) throw upload.error;
    const service = {
      id: fixtureId(businessId, "service-" + i),
      business_id: businessId,
      name: i ? "QA Barba" : "QA Corte",
      price_cents: i ? 3500 : 5000,
      duration_minutes: 30,
      active: true,
      requires_deposit: false,
      available_days: [0, 1, 2, 3, 4, 5, 6],
      image_path: imagePath,
      show_service: true,
      show_price: true,
      show_duration: true,
    };
    await checked(admin.from("services").upsert(service, { onConflict: "id" }));
    await checked(
      admin
        .from("service_professionals")
        .upsert(
          { business_id: businessId, service_id: service.id, professional_id: professionalId },
          { onConflict: "service_id,professional_id" },
        ),
    );
    services.push(service);
  }
  for (let i = 1; i <= 2; i++) {
    const start = new Date();
    start.setDate(start.getDate() + i);
    start.setHours(10 + i, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    await checked(
      admin.from("appointments").upsert(
        {
          id: fixtureId(businessId, "appointment-" + start.toISOString().slice(0, 10)),
          business_id: businessId,
          professional_id: professionalId,
          service_id: services[0].id,
          customer_name: "QA Seed",
          customer_phone: null,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          status: i === 1 ? "agendado" : "confirmado",
          notes: "QA:seed:v1",
        },
        { onConflict: "id" },
      ),
    );
  }
  // A dedicated password is optional; no customer account is ever modified.
  if (process.env.QA_TEST_OWNER_PASSWORD) {
    await assertDedicatedOwner(admin, business);
    assert(
      /^(?=.*[a-z])(?=.*\d).{8,128}$/i.test(process.env.QA_TEST_OWNER_PASSWORD),
      "QA test password must be strong",
    );
    const result = await admin.auth.admin.updateUserById(business.owner_id, {
      password: process.env.QA_TEST_OWNER_PASSWORD,
    });
    if (result.error) throw result.error;
  }
  return { businessId, professionalId, services };
}

/** Exercise stages serially on the dedicated business, restoring the original access in finally. */
export async function withBillingStage(stage, action) {
  const offsets = { ok: 5, amanha: 1, venceu_hoje: 0, atrasado: -1, urgente: -2, bloqueado: -4 };
  assert(Object.hasOwn(offsets, stage), "Invalid billing stage");
  const { admin, business } = await testContext();
  const id = assertTestBusiness(business);
  const until = new Date();
  until.setDate(until.getDate() + offsets[stage]);
  until.setHours(12, 0, 0, 0);
  await checked(
    admin
      .from("businesses")
      .update({ access_until: until.toISOString(), status: "ativo" })
      .eq("id", id)
      .eq("slug", TEST_BUSINESS.slug),
  );
  try {
    return await action(business);
  } finally {
    await checked(
      admin
        .from("businesses")
        .update({ access_until: business.access_until, status: business.status })
        .eq("id", id)
        .eq("slug", TEST_BUSINESS.slug),
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await seed()));
}
