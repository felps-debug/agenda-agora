import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin, getSuperAdminStatus } from "@/lib/auth/require-super-admin";

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendaagora:${senha}`;

/** Verifica exclusivamente se a sessão atual pertence ao responsável master. */
export const getMasterStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Estado mínimo do fluxo de MFA. Leituras de dados Master exigem assertSuperAdmin.
    return getSuperAdminStatus(context);
  });

/** Lista todos os estabelecimentos com contagem de agendamentos. */
export const listAllBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select(
        "id, name, slug, category, phone, owner_id, created_at, status, monthly_fee_cents, agpay_split_email, agpay_split_status, agpay_commission_percent",
      )
      .order("created_at", { ascending: false });
    let businesses = (data ?? []).map((business) => ({ ...business, agpay_schema_ready: true }));
    if (error) {
      // Durante a troca do gateway, a agenda e a lista Master continuam utilizáveis
      // mesmo que a migração das colunas AgPay ainda não tenha sido aplicada.
      if (error.code !== "42703" || !error.message.includes("agpay_"))
        throw new Error(error.message);
      const legacy = await supabaseAdmin
        .from("businesses")
        .select("id, name, slug, category, phone, owner_id, created_at, status, monthly_fee_cents")
        .order("created_at", { ascending: false });
      if (legacy.error) throw new Error(legacy.error.message);
      businesses = (legacy.data ?? []).map((business) => ({
        ...business,
        agpay_split_email: null,
        agpay_split_status: "pendente",
        agpay_commission_percent: 0,
        agpay_schema_ready: false,
      }));
    }
    const { data: owners } = await supabaseAdmin.from("profiles").select("id, full_name, email");
    const { data: appts } = await supabaseAdmin.from("appointments").select("business_id");
    const counts = new Map<string, number>();
    for (const a of appts ?? []) counts.set(a.business_id, (counts.get(a.business_id) ?? 0) + 1);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: payments } = await supabaseAdmin
      .from("subscription_payments")
      .select("business_id, status, reference_month");
    return businesses.map((b) => {
      const owner = (owners ?? []).find((o) => o.id === b.owner_id);
      const monthPayment = (payments ?? []).find(
        (p) => p.business_id === b.id && p.reference_month.slice(0, 7) === currentMonth,
      );
      return {
        ...b,
        owner_name: owner?.full_name ?? null,
        owner_login: owner?.email ?? null,
        appointments: counts.get(b.id) ?? 0,
        current_month_status: monthPayment?.status ?? "pendente",
      };
    });
  });

const createInput = z.object({
  businessName: z.string().min(2),
  category: z.string().min(1),
  ownerName: z.string().min(2),
  phone: z.string().min(10),
  password: z.string().min(4),
});

export const createBusinessWithOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const digits = onlyDigits(data.phone);
    const email = phoneLogin(digits);
    let ownerId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: phonePassword(data.password),
      email_confirm: true,
      user_metadata: { full_name: data.ownerName, phone: digits },
    });
    if (created.error) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!existing) throw new Error(created.error.message);
      ownerId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(ownerId, {
        password: phonePassword(data.password),
      });
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
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return { businessId: business.id, slug: business.slug, phone: digits };
  });

/** T033: estabelecimentos com saldo disponível negativo (revisão manual, FR-014). */
export const listNegativeBalanceBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: wallets, error } = await supabaseAdmin
      .from("wallets")
      .select("business_id, available_cents");
    if (error) throw new Error("Não foi possível carregar os saldos.");
    const negative = (wallets ?? []).filter(
      (wallet: { available_cents: number | null }) => (wallet.available_cents ?? 0) < 0,
    );
    const businessIds: string[] = negative.map(
      (wallet: { business_id: string }) => wallet.business_id,
    );
    const { data: businesses } = businessIds.length
      ? await supabaseAdmin.from("businesses").select("id, name").in("id", businessIds)
      : { data: [] };
    const names = new Map((businesses ?? []).map((b) => [b.id, b.name]));
    return negative
      .map((wallet: { business_id: string; available_cents: number | null }) => ({
        id: wallet.business_id,
        name: names.get(wallet.business_id) ?? "Negócio",
        available_cents: wallet.available_cents ?? 0,
      }))
      .sort((a, b) => a.available_cents - b.available_cents);
  });

/** T042: FK de ledger_entries é ON DELETE RESTRICT — traduz o erro cru do Postgres. */
const FOREIGN_KEY_VIOLATION = "23503";
const LEDGER_HISTORY_MESSAGE = "Este negócio tem histórico financeiro e não pode ser excluído.";

export const deleteBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin.from("businesses").delete().eq("id", data.id);
    if (error) {
      if (error.code === FOREIGN_KEY_VIOLATION && error.message.includes("ledger_entries"))
        throw new Error(LEDGER_HISTORY_MESSAGE);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const setBusinessStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["ativo", "suspenso"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const setMonthlyFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), amountCents: z.number().int().min(0) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ monthly_fee_cents: data.amountCents })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBusinessAgpaySplit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        splitEmail: z.string().email(),
        commissionPercent: z.number().min(0).max(99.99),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error: businessError } = await supabaseAdmin
      .from("businesses")
      .update({
        agpay_split_email: data.splitEmail,
        agpay_commission_percent: data.commissionPercent,
      })
      .eq("id", data.businessId);
    if (businessError) throw new Error(businessError.message);
    return { ok: true };
  });

export const setAgpaySplitStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        status: z.enum(["pendente", "aprovada", "bloqueada"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ agpay_split_status: data.status })
      .eq("id", data.businessId)
      .not("agpay_split_email", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
const monthRegex = /^\d{4}-\d{2}$/;
export const registerSubscriptionCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        month: z.string().regex(monthRegex),
        status: z.enum(["pago", "pendente"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: business, error: bErr } = await supabaseAdmin
      .from("businesses")
      .select("monthly_fee_cents")
      .eq("id", data.businessId)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!business) throw new Error("Estabelecimento não encontrado.");
    const referenceMonth = `${data.month}-01`;
    const { data: existing } = await supabaseAdmin
      .from("subscription_payments")
      .select("id")
      .eq("business_id", data.businessId)
      .eq("reference_month", referenceMonth)
      .maybeSingle();
    const payload = {
      business_id: data.businessId,
      reference_month: referenceMonth,
      amount_cents: business.monthly_fee_cents ?? 8990,
      status: data.status,
      paid_at: data.status === "pago" ? new Date().toISOString() : null,
    };
    const { error } = existing
      ? await supabaseAdmin.from("subscription_payments").update(payload).eq("id", existing.id)
      : await supabaseAdmin.from("subscription_payments").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const getPlatformMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: businesses, error } = await supabaseAdmin
      .from("businesses")
      .select("id, status, monthly_fee_cents");
    if (error) throw new Error(error.message);
    const list = businesses ?? [];
    const active = list.filter((b) => b.status !== "suspenso");
    const { data: payments } = await supabaseAdmin
      .from("subscription_payments")
      .select("business_id, amount_cents, status, reference_month");
    const paidThisMonth = (payments ?? []).filter(
      (p) => p.status === "pago" && p.reference_month.slice(0, 7) === currentMonth,
    );
    const revenueTotal = (payments ?? [])
      .filter((p) => p.status === "pago")
      .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
    const { data: deposits } = await supabaseAdmin
      .from("deposit_payments")
      .select("amount_cents, status");
    const depositsTotal = (deposits ?? [])
      .filter((d) => d.status === "pago" || d.status === "aprovado")
      .reduce((sum, d) => sum + (d.amount_cents ?? 0), 0);
    const { count: appointmentsCount } = await supabaseAdmin
      .from("appointments")
      .select("id", { count: "exact", head: true });
    return {
      currentMonth,
      totalBusinesses: list.length,
      activeBusinesses: active.length,
      suspendedBusinesses: list.length - active.length,
      mrrCents: active.reduce((sum, b) => sum + (b.monthly_fee_cents ?? 0), 0),
      paidThisMonthCount: paidThisMonth.length,
      paidThisMonthCents: paidThisMonth.reduce((s, p) => s + (p.amount_cents ?? 0), 0),
      delinquentCount: active.length - paidThisMonth.length,
      revenueTotalCents: revenueTotal,
      depositsTotalCents: depositsTotal,
      appointments: appointmentsCount ?? 0,
    };
  });

export const getDepositPaymentDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ chargeId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: charge, error: chargeError } = await supabaseAdmin
      .from("deposit_payments")
      .select(
        "id, status, provider_status, provider_payment_id, amount_cents, business_id, created_at, paid_at",
      )
      .eq("id", data.chargeId)
      .maybeSingle();
    if (chargeError) throw new Error(chargeError.message);
    if (!charge) throw new Error("Cobrança não encontrada.");

    let events: Array<{
      id: string;
      dedupe_hash: string;
      event_type: string;
      transaction_uuid: string | null;
      status: string;
      last_error: string | null;
      received_at: string;
    }> = [];
    if (charge.provider_payment_id) {
      const { data: relatedEvents, error: eventsError } = await supabaseAdmin
        .from("agpay_webhook_events")
        .select("id, dedupe_hash, event_type, transaction_uuid, status, last_error, received_at")
        .eq("transaction_uuid", charge.provider_payment_id)
        .order("received_at", { ascending: false });
      if (eventsError) throw new Error(eventsError.message);
      events = relatedEvents ?? [];
    }

    return { charge, events };
  });

export const listAdminWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("withdrawals")
      .select(
        "id, business_id, amount_cents, status, pix_key_snapshot, provider_ref, created_at, updated_at",
      )
      .in("status", ["requested", "processing", "failed", "paid"])
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Não foi possível carregar os saques.");
    const businessIds: string[] = [
      ...new Set<string>((rows ?? []).map((row: { business_id: string }) => row.business_id)),
    ];
    const { data: businesses } = businessIds.length
      ? await supabaseAdmin.from("businesses").select("id, name").in("id", businessIds)
      : { data: [] };
    const names = new Map((businesses ?? []).map((business) => [business.id, business.name]));
    return (rows ?? []).map(
      (row: {
        id: string;
        business_id: string;
        amount_cents: number;
        status: string;
        pix_key_snapshot: string;
        provider_ref: string | null;
        created_at: string;
        updated_at: string;
      }) => ({
        ...row,
        business_name: names.get(row.business_id) ?? "Negócio",
      }),
    );
  });

export const updateAdminWithdrawalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ withdrawalId: z.string().uuid(), status: z.enum(["paid", "failed"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    // Passa pelo ledger: paid libera o valor bloqueado; failed devolve ao saldo disponível.
    const { settleWithdrawal } = await import("./ledger.server");
    try {
      await settleWithdrawal(supabaseAdmin, {
        withdrawalId: data.withdrawalId,
        outcome: data.status,
      });
    } catch {
      throw new Error("Não foi possível atualizar o saque.");
    }
    return { ok: true };
  });

/** T036: totais agregados em centavos para a conciliação manual do Master (FR-015). */
export const getLedgerReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: wallets, error: walletsError } = await supabaseAdmin
      .from("wallets")
      .select("available_cents, pending_cents, locked_cents");
    if (walletsError) throw new Error("Não foi possível carregar os saldos.");
    const totals = (wallets ?? []).reduce(
      (
        acc,
        wallet: {
          available_cents: number | null;
          pending_cents: number | null;
          locked_cents: number | null;
        },
      ) => ({
        availableCents: acc.availableCents + (wallet.available_cents ?? 0),
        pendingCents: acc.pendingCents + (wallet.pending_cents ?? 0),
        lockedCents: acc.lockedCents + (wallet.locked_cents ?? 0),
      }),
      { availableCents: 0, pendingCents: 0, lockedCents: 0 },
    );
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("deposit_payments")
      .select("status, paid_at, platform_commission_cents");
    if (paymentsError) throw new Error("Não foi possível carregar os pagamentos.");
    const platformRevenueCents = (payments ?? [])
      .filter(
        (payment: { status: string; paid_at: string | null }) =>
          payment.status === "pago" || payment.status === "paid" || !!payment.paid_at,
      )
      .reduce(
        (sum: number, payment: { platform_commission_cents: number | null }) =>
          sum + (payment.platform_commission_cents ?? 0),
        0,
      );
    return { ...totals, platformRevenueCents };
  });

/** FR-013: saque em `processing` sem movimento há mais de 24h. */
const STUCK_WITHDRAWAL_HOURS = 24;

export const listStuckWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const threshold = new Date(Date.now() - STUCK_WITHDRAWAL_HOURS * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .select("id, business_id, amount_cents, status, updated_at")
      .eq("status", "processing")
      .lt("updated_at", threshold)
      .order("updated_at", { ascending: true });
    if (error) throw new Error("Não foi possível carregar os saques.");
    return data ?? [];
  });
