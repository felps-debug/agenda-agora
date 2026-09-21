import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendaagora:${senha}`;

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito ao painel master.");
  return supabaseAdmin;
}

/** Login dedicado do Master. A conta é criada/promovida no servidor no primeiro acesso. */
export const masterLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().regex(/^\d{8}$/), password: z.string().regex(/^\d{8}$/) }).parse(data))
  .handler(async ({ data }) => {
    const masterCode = "16092006";
    if (data.code !== masterCode || data.password !== data.code) throw new Error("Código ou senha Master inválidos.");
    const email = `${masterCode}@agenda.local`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw new Error(usersError.message);
    let masterUser = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (!masterUser) {
      const created = await supabaseAdmin.auth.admin.createUser({ email, password: masterCode, email_confirm: true, user_metadata: { full_name: "Master Agenda Agora", master_access: true } });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Não foi possível criar o acesso Master.");
      masterUser = created.data.user;
    } else {
      const updated = await supabaseAdmin.auth.admin.updateUserById(masterUser.id, { password: masterCode, email_confirm: true });
      if (updated.error) throw new Error(updated.error.message);
    }
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: masterUser.id, role: "super_admin" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);
    const supabaseUrl = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !publishableKey) throw new Error("Configuração do Supabase não encontrada.");
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: masterCode }) });
    const session = await response.json();
    if (!response.ok || !session.access_token || !session.refresh_token) throw new Error(session.error_description || session.msg || "Não foi possível iniciar a sessão Master.");
    return { access_token: session.access_token as string, refresh_token: session.refresh_token as string };
  });

/** Verifica exclusivamente se a sessão atual pertence ao responsável master. */
export const getMasterStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return { isMaster: !!data, hasMaster: true };
  });

/** Bloqueado por arquitetura: ninguém pode assumir o Master pela própria conta. */
export const claimMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    throw new Error("O painel master possui acesso exclusivo e não pode ser assumido por outra conta.");
  });

/** Lista todos os estabelecimentos com contagem de agendamentos. */
export const listAllBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("businesses").select("id, name, slug, category, phone, owner_id, created_at, status, monthly_fee_cents, asaas_wallet_id, asaas_subaccount_status, asaas_commission_percent").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const businesses = data ?? [];
    const { data: owners } = await supabaseAdmin.from("profiles").select("id, full_name, email");
    const { data: appts } = await supabaseAdmin.from("appointments").select("business_id");
    const counts = new Map<string, number>();
    for (const a of appts ?? []) counts.set(a.business_id, (counts.get(a.business_id) ?? 0) + 1);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: payments } = await supabaseAdmin.from("subscription_payments").select("business_id, status, reference_month");
    return businesses.map((b) => { const owner = (owners ?? []).find((o) => o.id === b.owner_id); const monthPayment = (payments ?? []).find((p) => p.business_id === b.id && p.reference_month.slice(0, 7) === currentMonth); return { ...b, owner_name: owner?.full_name ?? null, owner_login: owner?.email ?? null, appointments: counts.get(b.id) ?? 0, current_month_status: monthPayment?.status ?? "pendente" }; });
  });

const createInput = z.object({ businessName: z.string().min(2), category: z.string().min(1), ownerName: z.string().min(2), phone: z.string().min(10), password: z.string().min(4) });

export const createBusinessWithOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const digits = onlyDigits(data.phone);
    const email = phoneLogin(digits);
    let ownerId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({ email, password: phonePassword(data.password), email_confirm: true, user_metadata: { full_name: data.ownerName, phone: digits } });
    if (created.error) { const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle(); if (!existing) throw new Error(created.error.message); ownerId = existing.id; await supabaseAdmin.auth.admin.updateUserById(ownerId, { password: phonePassword(data.password) }); } else ownerId = created.data.user?.id ?? null;
    if (!ownerId) throw new Error("Não foi possível criar o acesso do dono.");
    await supabaseAdmin.from("user_roles").upsert({ user_id: ownerId, role: "owner" }, { onConflict: "user_id,role" });
    const base = data.businessName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
    const slug = `${base || "negocio"}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: business, error } = await supabaseAdmin.from("businesses").insert({ name: data.businessName, slug, category: data.category, phone: digits, owner_id: ownerId }).select("id, slug").single();
    if (error) throw new Error(error.message);
    return { businessId: business.id, slug: business.slug, phone: digits };
  });

export const deleteBusiness = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data)).handler(async ({ context, data }) => { const supabaseAdmin = await assertSuperAdmin(context.userId); const { error } = await supabaseAdmin.from("businesses").delete().eq("id", data.id); if (error) throw new Error(error.message); return { ok: true }; });
export const setBusinessStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["ativo", "suspenso"]) }).parse(data)).handler(async ({ context, data }) => { const supabaseAdmin = await assertSuperAdmin(context.userId); const { error } = await supabaseAdmin.from("businesses").update({ status: data.status }).eq("id", data.id); if (error) throw new Error(error.message); return { ok: true }; });
export const setMonthlyFee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: unknown) => z.object({ id: z.string().uuid(), amountCents: z.number().int().min(0) }).parse(data)).handler(async ({ context, data }) => { const supabaseAdmin = await assertSuperAdmin(context.userId); const { error } = await supabaseAdmin.from("businesses").update({ monthly_fee_cents: data.amountCents }).eq("id", data.id); if (error) throw new Error(error.message); return { ok: true }; });

const provisionAsaasInput = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  cpfCnpj: z.string().transform(onlyDigits).refine((value) => value.length === 11 || value.length === 14, "CPF/CNPJ inválido"),
  mobilePhone: z.string().transform(onlyDigits).refine((value) => value.length >= 10 && value.length <= 11, "Telefone inválido"),
  incomeValue: z.number().positive(),
  address: z.string().min(2).max(100),
  addressNumber: z.string().min(1).max(20),
  province: z.string().min(2).max(60),
  postalCode: z.string().transform(onlyDigits).refine((value) => value.length === 8, "CEP inválido"),
  companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).optional(),
  commissionPercent: z.number().min(0).max(99.99).default(0),
});

/** Cria a subconta com Webhook e guarda a API key somente em formato criptografado. */
export const provisionAsaasSubaccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => provisionAsaasInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("asaas_business_credentials")
      .select("business_id")
      .eq("business_id", data.businessId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) throw new Error("Este estabelecimento já possui uma subconta Asaas.");

    const { createSubaccount, encryptAsaasApiKey } = await import("./asaas.server");
    const account = await createSubaccount({
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj,
      mobilePhone: data.mobilePhone,
      incomeValue: data.incomeValue,
      address: data.address,
      addressNumber: data.addressNumber,
      province: data.province,
      postalCode: data.postalCode,
      ...(data.companyType ? { companyType: data.companyType } : {}),
    });

    const { error: credentialError } = await supabaseAdmin
      .from("asaas_business_credentials")
      .insert({
        business_id: data.businessId,
        asaas_account_id: account.accountId,
        api_key_encrypted: encryptAsaasApiKey(account.apiKey),
      });
    if (credentialError) throw new Error(credentialError.message);

    const { error: businessError } = await supabaseAdmin
      .from("businesses")
      .update({
        asaas_wallet_id: account.walletId,
        asaas_subaccount_status: "em_analise",
        asaas_commission_percent: data.commissionPercent,
      })
      .eq("id", data.businessId);
    if (businessError) throw new Error(businessError.message);

    return { walletId: account.walletId, status: "em_analise" as const };
  });

export const setAsaasSubaccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      businessId: z.string().uuid(),
      status: z.enum(["em_analise", "aprovada", "bloqueada"]),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ asaas_subaccount_status: data.status })
      .eq("id", data.businessId)
      .not("asaas_wallet_id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
const monthRegex = /^\d{4}-\d{2}$/;
export const registerSubscriptionCharge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: unknown) => z.object({ businessId: z.string().uuid(), month: z.string().regex(monthRegex), status: z.enum(["pago", "pendente"]) }).parse(data)).handler(async ({ context, data }) => { const supabaseAdmin = await assertSuperAdmin(context.userId); const { data: business, error: bErr } = await supabaseAdmin.from("businesses").select("monthly_fee_cents").eq("id", data.businessId).maybeSingle(); if (bErr) throw new Error(bErr.message); if (!business) throw new Error("Estabelecimento não encontrado."); const referenceMonth = `${data.month}-01`; const { data: existing } = await supabaseAdmin.from("subscription_payments").select("id").eq("business_id", data.businessId).eq("reference_month", referenceMonth).maybeSingle(); const payload = { business_id: data.businessId, reference_month: referenceMonth, amount_cents: business.monthly_fee_cents ?? 8990, status: data.status, paid_at: data.status === "pago" ? new Date().toISOString() : null }; const { error } = existing ? await supabaseAdmin.from("subscription_payments").update(payload).eq("id", existing.id) : await supabaseAdmin.from("subscription_payments").insert(payload); if (error) throw new Error(error.message); return { ok: true }; });
export const getPlatformMetrics = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { const supabaseAdmin = await assertSuperAdmin(context.userId); const currentMonth = new Date().toISOString().slice(0, 7); const { data: businesses, error } = await supabaseAdmin.from("businesses").select("id, status, monthly_fee_cents"); if (error) throw new Error(error.message); const list = businesses ?? []; const active = list.filter((b) => b.status !== "suspenso"); const { data: payments } = await supabaseAdmin.from("subscription_payments").select("business_id, amount_cents, status, reference_month"); const paidThisMonth = (payments ?? []).filter((p) => p.status === "pago" && p.reference_month.slice(0, 7) === currentMonth); const revenueTotal = (payments ?? []).filter((p) => p.status === "pago").reduce((sum, p) => sum + (p.amount_cents ?? 0), 0); const { data: deposits } = await supabaseAdmin.from("deposit_payments").select("amount_cents, status"); const depositsTotal = (deposits ?? []).filter((d) => d.status === "pago" || d.status === "aprovado").reduce((sum, d) => sum + (d.amount_cents ?? 0), 0); const { count: appointmentsCount } = await supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }); return { currentMonth, totalBusinesses: list.length, activeBusinesses: active.length, suspendedBusinesses: list.length - active.length, mrrCents: active.reduce((sum, b) => sum + (b.monthly_fee_cents ?? 0), 0), paidThisMonthCount: paidThisMonth.length, paidThisMonthCents: paidThisMonth.reduce((s, p) => s + (p.amount_cents ?? 0), 0), delinquentCount: active.length - paidThisMonth.length, revenueTotalCents: revenueTotal, depositsTotalCents: depositsTotal, appointments: appointmentsCount ?? 0 }; });
