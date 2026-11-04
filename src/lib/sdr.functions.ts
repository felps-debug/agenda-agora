import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { signSdrToken, verifySdrToken } from "@/lib/sdr-token";
import { conversionRate, monthKey, percentChange, weeklyBuckets } from "@/lib/sdr-stats";
import { getSdrTokenSecret } from "@/lib/env-security.server";
import { checkLock, registerFailure, registerSuccess } from "@/lib/login-attempts.server";
import { clientIp } from "@/lib/rate-limit.server";

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendaagora:${senha}`;
const isExistingAuthUserError = (error: { code?: string | undefined; message: string }) =>
  ["email_exists", "user_already_exists", "identity_already_exists"].includes(error.code ?? "") ||
  /already (registered|exists)|already been registered/i.test(error.message);

/** PIN de quatro dígitos é armazenado com scrypt; SHA-256 legado só para migração no login. */
const sha256Pin = (pin: string, email: string) =>
  createHash("sha256").update(`${email.trim().toLowerCase()}::${pin}`).digest("hex");
const scrypt = promisify(scryptCallback);

async function hashPin(pin: string, email: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(`${email.trim().toLowerCase()}::${pin}`, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPin(stored: string, pin: string, email: string) {
  if (!stored.startsWith("scrypt$")) return stored === sha256Pin(pin, email) ? "legacy" : false;
  const [, salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(`${email.trim().toLowerCase()}::${pin}`, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type AdminClient = Awaited<ReturnType<typeof adminClient>>;

/** Segredo de assinatura dos tokens, configurado no ambiente do servidor. */
async function getSdrSecret(_supabaseAdmin: AdminClient) {
  return getSdrTokenSecret();
}

/** Valida o token do painel do SDR e devolve o client admin + o SDR atual. */
async function requireSdr(token: string) {
  const supabaseAdmin = await adminClient();
  const secret = await getSdrSecret(supabaseAdmin);
  const sdrId = verifySdrToken(token, secret);
  if (!sdrId) throw new Error("Sessão expirada. Entre novamente com seu e-mail e senha.");
  const { data: sdr, error } = await supabaseAdmin
    .from("sdrs")
    .select(
      "id, name, email, active, signup_goal, sales_goal, commission_cents, preset_scripts, script_notes",
    )
    .eq("id", sdrId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sdr || !sdr.active) throw new Error("Conta inativa. Fale com o administrador.");
  return {
    supabaseAdmin,
    sdr: sdr as {
      id: string;
      name: string;
      email: string;
      active: boolean;
      signup_goal: number | null;
      sales_goal: number | null;
      commission_cents: number | null;
      preset_scripts: string | null;
      script_notes: string | null;
    },
  };
}

const emailField = z.string().trim().toLowerCase().min(5).email("Informe um e-mail válido.");
const pinField = z
  .string()
  .regex(/^\d{4}$/, "A senha deve ter exatamente 4 dígitos numéricos.");

const sdrFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do SDR."),
  email: emailField,
  pin: pinField,
  signupGoal: z.number().int().min(0).max(10000),
  salesGoal: z.number().int().min(0).max(10000),
  commissionCents: z.number().int().min(0).max(10000000),
});

/* ------------------------------------------------------------------ */
/* Login do SDR (público: e-mail + senha de 4 dígitos)                 */
/* ------------------------------------------------------------------ */

export const sdrLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: emailField, pin: pinField }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminClient();
    const emailKey = `sdr:${data.email}`;
    const ipKey = `ip:${clientIp()}`;
    const [lock, ipLock] = await Promise.all([checkLock(emailKey), checkLock(ipKey)]);
    if (lock.locked || ipLock.locked)
      throw new Error(`TOO_MANY_ATTEMPTS:${Math.max(lock.retryAfterSeconds, ipLock.retryAfterSeconds)}`);
    const { data: sdr, error } = await supabaseAdmin
      .from("sdrs")
      .select("id, name, pin, active")
      .eq("email", data.email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const verification = sdr?.active ? await verifyPin(sdr.pin as string, data.pin, data.email) : false;
    if (!sdr || !sdr.active || !verification) {
      const result = await registerFailure(emailKey, { limit: 5, windowMs: 15 * 60_000, lockMs: 30 * 60_000 });
      const ipResult = await registerFailure(ipKey, { limit: 30, windowMs: 60 * 60_000, lockMs: 60 * 60_000 });
      if (sdr?.id && (result.locked || ipResult.locked)) {
        const { data: business } = await supabaseAdmin
          .from("businesses")
          .select("id")
          .eq("sdr_id", sdr.id)
          .limit(1)
          .maybeSingle();
        if (business) {
          const { error: auditError } = await supabaseAdmin.from("master_business_events").insert({
            business_id: business.id,
            actor_id: null,
            type: "security",
            title: "Bloqueio temporário de acesso SDR",
            description: "O limite de tentativas inválidas de acesso do SDR foi atingido.",
          });
          if (auditError) console.error("Falha ao registrar bloqueio de acesso SDR:", auditError.message);
        }
      }
      if (result.locked || ipResult.locked)
        throw new Error(`TOO_MANY_ATTEMPTS:${Math.max(result.retryAfterSeconds, ipResult.retryAfterSeconds)}`);
      throw new Error("E-mail ou senha incorretos.");
    }
    await registerSuccess(emailKey);
    await registerSuccess(ipKey);
    if (verification === "legacy") {
      const { error: migrationError } = await supabaseAdmin
        .from("sdrs")
        .update({ pin: await hashPin(data.pin, data.email) })
        .eq("id", sdr.id);
      if (migrationError) throw new Error("Não foi possível atualizar a proteção do PIN.");
    }
    const secret = await getSdrSecret(supabaseAdmin);
    return {
      token: signSdrToken(sdr.id as string, secret),
      name: sdr.name as string,
    };
  });

/* ------------------------------------------------------------------ */
/* Painel 3 Master: equipe + performance                               */
/* ------------------------------------------------------------------ */

export type SdrTeamRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  signupGoal: number;
  salesGoal: number;
  commissionCents: number;
  presetScripts: string;
  cadastros: number;
  vendas: number;
  conversao: number;
  comissaoCents: number;
  vendas30: number;
};

export const getSdrTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const now = new Date();
    const current = monthKey(now);
    const previous = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [sdrsRes, businessesRes, paymentsRes] = await Promise.all([
      supabaseAdmin.from("sdrs").select("*").order("created_at", { ascending: true }),
      supabaseAdmin
        .from("businesses")
        .select("id, name, created_at, sdr_id")
        .not("sdr_id", "is", null),
      supabaseAdmin
        .from("subscription_payments")
        .select("business_id, reference_month, status, paid_at")
        .eq("status", "pago"),
    ]);
    if (sdrsRes.error) throw new Error(sdrsRes.error.message);
    if (businessesRes.error) throw new Error(businessesRes.error.message);
    if (paymentsRes.error) throw new Error(paymentsRes.error.message);

    const sdrs = (sdrsRes.data ?? []) as Array<{
      id: string;
      name: string;
      email: string;
      active: boolean;
      signup_goal: number | null;
      sales_goal: number | null;
      commission_cents: number | null;
      preset_scripts: string | null;
    }>;
    const businesses = (businessesRes.data ?? []) as Array<{
      id: string;
      name: string;
      created_at: string;
      sdr_id: string | null;
    }>;
    const payments = (paymentsRes.data ?? []) as Array<{
      business_id: string;
      reference_month: string;
      paid_at: string | null;
    }>;

    const sdrIdByBusiness = new Map(
      businesses
        .filter((b) => b.sdr_id)
        .map((b) => [b.id, b.sdr_id as string]),
    );

    const paidBySdr = new Map<string, Array<{ month: string; paidAt: string | null }>>();
    for (const payment of payments) {
      const sdrId = sdrIdByBusiness.get(payment.business_id);
      if (!sdrId) continue;
      const list = paidBySdr.get(sdrId) ?? [];
      list.push({ month: payment.reference_month.slice(0, 7), paidAt: payment.paid_at });
      paidBySdr.set(sdrId, list);
    }

    const rows: SdrTeamRow[] = sdrs.map((sdr) => {
      const paid = paidBySdr.get(sdr.id) ?? [];
      const cadastros = businesses.filter(
        (b) => b.sdr_id === sdr.id && b.created_at.slice(0, 7) === current,
      ).length;
      const cadastrosPrev = businesses.filter(
        (b) => b.sdr_id === sdr.id && b.created_at.slice(0, 7) === previous,
      ).length;
      const vendas = paid.filter((p) => p.month === current).length;
      const vendasPrev = paid.filter((p) => p.month === previous).length;
      const vendas30 = paid.filter(
        (p) => p.paidAt != null && p.paidAt >= thirtyDaysAgo,
      ).length;
      return {
        id: sdr.id,
        name: sdr.name,
        email: sdr.email,
        active: !!sdr.active,
        signupGoal: sdr.signup_goal ?? 0,
        salesGoal: sdr.sales_goal ?? 0,
        commissionCents: sdr.commission_cents ?? 0,
        presetScripts: sdr.preset_scripts ?? "",
        cadastros,
        vendas,
        conversao: conversionRate(cadastros, vendas),
        comissaoCents: vendas * (sdr.commission_cents ?? 0),
        vendas30,
      };
    });

    const totalCadastros = rows.reduce((sum, row) => sum + row.cadastros, 0);
    const totalCadastrosPrev = businesses.filter(
      (b) => b.created_at.slice(0, 7) === previous,
    ).length;
    const totalVendas = rows.reduce((sum, row) => sum + row.vendas, 0);
    const totalVendasPrev = [...paidBySdr.values()]
      .flat()
      .filter((p) => p.month === previous).length;
    const conversao = conversionRate(totalCadastros, totalVendas);
    const conversaoPrev = conversionRate(totalCadastrosPrev, totalVendasPrev);

    const buckets = weeklyBuckets(4, now);
    const weekData = buckets.map((bucket) => ({
      label: bucket.label,
      cadastros: businesses.filter(
        (b) => b.created_at >= bucket.start && b.created_at <= bucket.end,
      ).length,
    }));

    return {
      generatedAt: now.toISOString(),
      sdrs: rows,
      kpis: {
        activeSdrs: rows.filter((row) => row.active).length,
        cadastros: { value: totalCadastros, delta: percentChange(totalCadastros, totalCadastrosPrev) },
        vendas: { value: totalVendas, delta: percentChange(totalVendas, totalVendasPrev) },
        conversao: { value: conversao, delta: percentChange(conversao, conversaoPrev) },
      },
      barData: rows.map((row) => ({
        name: row.name.split(" ")[0] ?? row.name,
        vendas: row.vendas30,
      })),
      weekData,
    };
  });

export const createSdr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sdrFormSchema.parse(input))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: created, error } = await supabaseAdmin
      .from("sdrs")
      .insert({
        name: data.name,
        email: data.email,
        pin: await hashPin(data.pin, data.email),
        signup_goal: data.signupGoal,
        sales_goal: data.salesGoal,
        commission_cents: data.commissionCents,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um SDR com este e-mail.");
      throw new Error(error.message);
    }
    return { id: created.id as string };
  });

export const updateSdr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    sdrFormSchema
      .extend({
        id: z.string().uuid(),
        pin: z.union([pinField, z.literal("")]),
        active: z.boolean(),
        presetScripts: z.string().max(20000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const patch: {
      name: string;
      email: string;
      signup_goal: number;
      sales_goal: number;
      commission_cents: number;
      active: boolean;
      pin?: string;
      preset_scripts?: string;
    } = {
      name: data.name,
      email: data.email,
      signup_goal: data.signupGoal,
      sales_goal: data.salesGoal,
      commission_cents: data.commissionCents,
      active: data.active,
    };
    if (data.pin) patch.pin = await hashPin(data.pin, data.email);
    if (data.presetScripts !== undefined) patch.preset_scripts = data.presetScripts;
    const { error } = await supabaseAdmin.from("sdrs").update(patch).eq("id", data.id);
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um SDR com este e-mail.");
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Scripts pré-definidos e Quadro de ideias (escrito pelo master)      */
/* ------------------------------------------------------------------ */

const ideaSchema = z.object({
  sdrId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe o título da ideia.").max(160),
  details: z.string().max(4000).optional(),
});

export const getSdrIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sdrId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("sdr_ideas")
      .select("id, title, details, created_by, created_at")
      .eq("sdr_id", data.sdrId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      details: (row.details as string) ?? "",
      createdBy: (row.created_by as string) ?? "master",
      createdAt: row.created_at as string,
    }));
  });

export const addSdrIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ideaSchema.parse(input))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin.from("sdr_ideas").insert({
      sdr_id: data.sdrId,
      title: data.title,
      details: data.details ?? "",
      created_by: "master",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeSdrIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ideaId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin.from("sdr_ideas").delete().eq("id", data.ideaId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Kit de scripts do próprio SDR (lê e salva no painel do SDR)         */
/* ------------------------------------------------------------------ */

export const getSdrScriptKit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sdr } = await requireSdr(data.token);
    const { data: ideas, error } = await supabaseAdmin
      .from("sdr_ideas")
      .select("id, title, details, created_by, created_at")
      .eq("sdr_id", sdr.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      presetScripts: (sdr.preset_scripts as string | null) ?? "",
      notes: (sdr.script_notes as string | null) ?? "",
      ideas: (ideas ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        details: (row.details as string) ?? "",
        createdBy: (row.created_by as string) ?? "master",
        createdAt: row.created_at as string,
      })),
    };
  });

export const sdrSaveScriptNotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ token: z.string().min(10), notes: z.string().max(20000) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, sdr } = await requireSdr(data.token);
    const { error } = await supabaseAdmin
      .from("sdrs")
      .update({ script_notes: data.notes })
      .eq("id", sdr.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const sdrAddIdea = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().min(10),
        title: z.string().trim().min(1, "Informe o título da ideia.").max(160),
        details: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, sdr } = await requireSdr(data.token);
    const { error } = await supabaseAdmin.from("sdr_ideas").insert({
      sdr_id: sdr.id,
      title: data.title,
      details: data.details ?? "",
      created_by: "sdr",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const sdrDeleteIdea = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(10), ideaId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, sdr } = await requireSdr(data.token);
    // O SDR só pode apagar ideias que ele mesmo criou.
    const { error } = await supabaseAdmin
      .from("sdr_ideas")
      .delete()
      .eq("id", data.ideaId)
      .eq("sdr_id", sdr.id)
      .eq("created_by", "sdr");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Painel exclusivo do SDR                                             */
/* ------------------------------------------------------------------ */

export const getSdrDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sdr } = await requireSdr(data.token);
    const now = new Date();
    const current = monthKey(now);

    const { data: businesses, error } = await supabaseAdmin
      .from("businesses")
      .select("id, name, created_at")
      .eq("sdr_id", sdr.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (businesses ?? []) as Array<{ id: string; name: string; created_at: string }>;
    const businessNames = new Map(list.map((b) => [b.id, b.name]));

    const ids = list.map((b) => b.id);
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("subscription_payments")
      .select("business_id, reference_month, amount_cents, paid_at")
      .eq("status", "pago")
      .in("business_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("paid_at", { ascending: false });
    if (paymentsError) throw new Error(paymentsError.message);
    const paidList = (payments ?? []) as Array<{
      business_id: string;
      reference_month: string;
      amount_cents: number | null;
      paid_at: string | null;
    }>;

    const cadastros = list.filter((b) => b.created_at.slice(0, 7) === current).length;
    const vendas = paidList.filter((p) => p.reference_month.slice(0, 7) === current).length;

    return {
      sdr: { name: sdr.name as string, email: sdr.email as string },
      goals: {
        signupGoal: (sdr.signup_goal as number | null) ?? 0,
        salesGoal: (sdr.sales_goal as number | null) ?? 0,
      },
      commissionCents: (sdr.commission_cents as number | null) ?? 0,
      month: {
        cadastros,
        vendas,
        conversao: conversionRate(cadastros, vendas),
        comissaoCents: vendas * ((sdr.commission_cents as number | null) ?? 0),
      },
      cadastros: list.slice(0, 20).map((b) => ({
        id: b.id,
        name: b.name,
        createdAt: b.created_at,
      })),
      vendas: paidList.slice(0, 20).map((p) => ({
        id: `${p.business_id}-${p.reference_month}`,
        businessName: businessNames.get(p.business_id) ?? "Estabelecimento",
        referenceMonth: p.reference_month.slice(0, 7),
        paidAt: p.paid_at,
        amountCents: p.amount_cents ?? 0,
      })),
    };
  });

/* ------------------------------------------------------------------ */
/* Cadastro de estabelecimento feito pelo próprio SDR                  */

/* ------------------------------------------------------------------ */
/* Cadastros criados pelo SDR (menu lateral do painel do SDR)          */
/* ------------------------------------------------------------------ */

export const getSdrCadastros = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sdr } = await requireSdr(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("businesses")
      .select("id, name, category, phone, created_at")
      .eq("sdr_id", sdr.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      category: row.category as string,
      phone: (row.phone as string) ?? "",
      login: `${(row.phone as string) ?? ""}@agenda.local`,
      createdAt: row.created_at as string,
    }));
  });

export const resetSdrOwnerPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10), businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sdr } = await requireSdr(data.token);
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .eq("sdr_id", sdr.id)
      .maybeSingle();
    if (error || !business) throw new Error("Estabelecimento não encontrado.");
    const { error: auditError } = await supabaseAdmin.from("master_business_events").insert({
      business_id: business.id,
      actor_id: null,
      type: "suporte",
      title: "Reset de senha solicitado pelo SDR",
      description: `Reset temporário solicitado pelo SDR ${sdr.name}.`,
    });
    if (auditError) throw new Error("Não foi possível registrar a auditoria do reset.");
    const temporaryPassword = randomBytes(18).toString("base64url");
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(business.owner_id, {
      password: phonePassword(temporaryPassword),
    });
    if (resetError) throw new Error("Não foi possível redefinir a senha do dono.");
    return { temporaryPassword };
  });

export const sdrCreateBusiness = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().min(10),
        businessName: z.string().trim().min(2, "Informe o nome do estabelecimento."),
        category: z.enum(["barbearia", "salao", "consultorio", "estetica", "pet", "outro"]),
        ownerName: z.string().trim().min(2, "Informe o nome do dono."),
        phone: z.string().min(10, "Informe o telefone com DDD."),
        password: z.string().min(4, "A senha do dono precisa de pelo menos 4 caracteres."),
        trialDays: z.number().int().min(0).max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, sdr } = await requireSdr(data.token);
    const digits = onlyDigits(data.phone);
    if (digits.length < 10 || digits.length > 11) throw new Error("Informe um telefone brasileiro com DDD.");
    const email = phoneLogin(digits);
    let ownerId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: phonePassword(data.password),
      email_confirm: true,
      user_metadata: { full_name: data.ownerName, phone: digits },
    });
    if (created.error) {
      if (isExistingAuthUserError(created.error)) throw new Error("PHONE_ALREADY_REGISTERED");
      throw new Error("Não foi possível criar o acesso do dono.");
    } else ownerId = created.data.user?.id ?? null;
    if (!ownerId) throw new Error("Não foi possível criar o acesso do dono.");
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: ownerId, role: "owner" }, { onConflict: "user_id,role" });
    const base = data.businessName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);
    const slug = `${base || "negocio"}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: data.businessName,
        slug,
        category: data.category,
        phone: digits,
        owner_id: ownerId,
        sdr_id: sdr.id,
        trial_days: data.trialDays ?? null,
        trial_created_at: data.trialDays != null ? new Date().toISOString() : null,
        access_until:
          data.trialDays != null
            ? new Date(Date.now() + data.trialDays * 86_400_000).toISOString()
            : new Date().toISOString(),
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return {
      businessId: business.id as string,
      slug: business.slug as string,
      phone: digits,
      initialPassword: data.password,
    };
  });
