import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertTestBusiness, assertDedicatedOwner } from "./seed.mjs";

export async function verifyErrorLogRls(admin, business) {
  const businessId = assertTestBusiness(business);
  await assertDedicatedOwner(admin, business);
  const makeClient = () =>
    createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const anonymous = makeClient();
  const owner = makeClient();
  const master = makeClient();
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const row = {
    kind: "ui_error",
    message: "QA: error-log RLS",
    source: "qa://error-log-rls",
    business_id: businessId,
    user_id: business.owner_id,
  };
  try {
    const identity = await admin.auth.admin.getUserById(business.owner_id);
    assert.ifError(identity.error);
    const ownerLogin = await owner.auth.signInWithPassword({
      email: identity.data.user.email,
      password: process.env.QA_OWNER_PASSWORD,
    });
    assert.ifError(ownerLogin.error);
    const masterLogin = await master.auth.signInWithPassword({
      email: process.env.QA_MASTER_EMAIL,
      password: process.env.QA_MASTER_PASSWORD,
    });
    assert.ifError(masterLogin.error);

    const anonInsert = await anonymous.from("client_error_log").insert({ ...row, id: ids[0] });
    assert.equal(anonInsert.error?.code, "42501", "Anonymous direct INSERT must be denied");
    const inserted = await owner.from("client_error_log").insert({ ...row, id: ids[1] });
    assert.ifError(inserted.error);
    const ownerRead = await owner.from("client_error_log").select("id").eq("id", ids[1]);
    assert.ifError(ownerRead.error);
    assert.equal(ownerRead.data.length, 0, "Owners must not read the diagnostic feed");
    const anonRead = await anonymous.from("client_error_log").select("id").eq("id", ids[1]);
    assert(
      anonRead.error?.code === "42501" || (!anonRead.error && anonRead.data.length === 0),
      "Anonymous readers must not see diagnostic records",
    );
    const masterRead = await master.from("client_error_log").select("id").eq("id", ids[1]);
    assert.ifError(masterRead.error);
    assert.deepEqual(
      masterRead.data.map((item) => item.id),
      [ids[1]],
    );
    const forged = await owner.from("client_error_log").insert({
      ...row,
      id: ids[2],
      user_id: masterLogin.data.user.id,
    });
    assert.equal(forged.error?.code, "42501", "A caller must not forge the error actor");
    console.log(
      "PASS error-log RLS: anonymous denied, owner insert scoped, only master reads, forged actor denied",
    );
  } finally {
    const cleanup = await admin
      .from("client_error_log")
      .delete()
      .in("id", ids)
      .eq("business_id", businessId);
    await owner.auth.signOut({ scope: "local" });
    await master.auth.signOut({ scope: "local" });
    assert.ifError(cleanup.error);
  }
}
