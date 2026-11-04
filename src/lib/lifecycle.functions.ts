import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import {
  ATTENTION_REASON_LABEL,
  classifyLifecycle,
  type AttentionReason,
  type LifecycleCategory,
} from "@/lib/subscription-lifecycle";
import {
  computeAccessCycle,
  computeInvoiceStatus,
  nextAccessAfterPayment,
  subscriptionTotalCents,
} from "@/lib/billing-cycle";
import { createHash } from "node:crypto";
import { masterReturnPinMatches } from "@/lib/impersonation-pin.server";
import { summarizeSetup } from "@/lib/master/business-intelligence";
import { trialInfo } from "@/lib/trial-store";
import { getAllowedAppOrigins } from "@/lib/env-security.server";

const DAY_MS = 86_400_000;

export type LifecycleItem = {
  id: string;
  name: string;
  phone: string | null;
  category: string;
  status: string;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  category_: LifecycleCategory;
  reason: AttentionReason | null;
  reasonLabel: string | null;
  isTrial: boolean;
  trialDays: number | null;
  accessUntil: string | null;
  trialEnd: string | null;
  trialDaysLeft: number | null;
  trialAlert: 3 | 1 | 0 | null;
  dueDate: string | null;
  nextDue: string | null;
  dueInDays: number | null;
  dueAlert: 7 | 3 | 1 | 0 | null;
  daysLate: number;
  firstPaymentAt: string | null;
  lastPaymentAt: string | null;
  paymentsCount: number;
  totalPaidCents: number;
  monthlyFeeCents: number;
  monthlyTotalCents: number;
  planLabel: string;
  paid: boolean;
  appointmentsCount: number;
  setupPercent: number;
  lastAccessAt: string | null;
  daysSinceLastAccess: number | null;
  cancelRequestedAt: string | null;
  cancelledAt: string | null;
  salesOwner: string | null;
};

export const getSubscriptionLifecycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const now = new Date();

    const [
      businessesRes,
      profilesRes,
      paymentsRes,
      appointmentsRes,
      servicesRes,
      professionalsRes,
      hoursRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select(
          "id, name, phone, category, status, created_at, owner_id, monthly_fee_cents, trial_days, trial_created_at, slug, cancel_requested_at, cancelled_at, sales_owner, access_until",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin
        .from("subscription_payments")
        .select("business_id, reference_month, status, amount_cents, paid_at, created_at"),
      supabaseAdmin.from("appointments").select("id, business_id").limit(20000),
      supabaseAdmin.from("services").select("id, business_id").limit(20000),
      supabaseAdmin.from("professionals").select("id, business_id").limit(20000),
      supabaseAdmin.from("business_hours").select("id, business_id").limit(20000),
    ]);
    for (const [label, result] of [
      ["estabelecimentos", businessesRes],
      ["responsáveis", profilesRes],
      ["pagamentos", paymentsRes],
      ["agendamentos", appointmentsRes],
      ["serviços", servicesRes],
      ["profissionais", professionalsRes],
      ["horários", hoursRes],
    ] as const) {
      if (result.error) throw new Error(`Falha ao carregar ${label}: ${result.error.message}`);
    }

    const businesses = businessesRes.data ?? [];
    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const payments = paymentsRes.data ?? [];
    const appointmentsByBusiness = new Map<string, number>();
    for (const appointment of appointmentsRes.data ?? []) {
      appointmentsByBusiness.set(
        appointment.business_id,
        (appointmentsByBusiness.get(appointment.business_id) ?? 0) + 1,
      );
    }
    const countBy = (rows: Array<{ business_id: string }>) => {
      const map = new Map<string, number>();
      for (const row of rows) map.set(row.business_id, (map.get(row.business_id) ?? 0) + 1);
      return map;
    };
    const servicesCount = countBy(servicesRes.data ?? []);
    const professionalsCount = countBy(professionalsRes.data ?? []);
    const hoursCount = countBy(hoursRes.data ?? []);

    // Último acesso real do dono (uma chamada por proprietário).
    const lastAccessByOwner = new Map<string, string | null>();
    for (const business of businesses) {
      if (lastAccessByOwner.has(business.owner_id)) continue;
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(business.owner_id);
        lastAccessByOwner.set(business.owner_id, authUser?.user?.last_sign_in_at ?? null);
      } catch {
        lastAccessByOwner.set(business.owner_id, null);
      }
    }

    const items: LifecycleItem[] = [];
    let assinantes = 0;
    let emTeste = 0;
    let vencemSete = 0;
    let atencao = 0;
    let semAcessoSete = 0;

    for (const business of businesses) {
      const paidRows = payments
        .filter((p) => p.business_id === business.id && p.status === "pago")
        .map((p) => ({
          referenceMonth: p.reference_month.slice(0, 7),
          paidAt: p.paid_at ?? p.created_at,
          amountCents: p.amount_cents ?? 0,
        }))
        .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
      const everPaid = paidRows.length > 0;
      const firstPaymentAt = paidRows[0]?.paidAt ?? null;
      const lastPaymentAt = paidRows.at(-1)?.paidAt ?? null;
      const totalPaidCents = paidRows.reduce((sum, p) => sum + p.amountCents, 0);
      const isTrial = business.trial_days != null && !everPaid;

      const lifecycle = classifyLifecycle({
        status: business.status,
        isTrial,
        accessUntil: business.access_until,
        cancelRequestedAt: business.cancel_requested_at,
        cancelledAt: business.cancelled_at,
        now,
      });

      const trial = trialInfo(business);
      const setup = summarizeSetup({
        hasBasicData: !!business.name && !!business.category && !!business.phone,
        servicesCount: servicesCount.get(business.id) ?? 0,
        professionalsCount: professionalsCount.get(business.id) ?? 0,
        hasBusinessHours: (hoursCount.get(business.id) ?? 0) > 0,
        hasPublicLink: !!business.slug,
        usesReminders: false,
        usesWhatsapp: false,
        usesPix: false,
        hasReceivedAppointments: (appointmentsByBusiness.get(business.id) ?? 0) > 0,
      });

      const lastAccessAt = lastAccessByOwner.get(business.owner_id) ?? null;
      const daysSinceLastAccess = lastAccessAt
        ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastAccessAt)) / DAY_MS))
        : null;

      if (lifecycle.category === "assinante") {
        assinantes += 1;
        if (lifecycle.dueAlert != null) vencemSete += 1;
      } else if (lifecycle.category === "em_teste") {
        emTeste += 1;
      } else {
        atencao += 1;
      }
      // Valor contratado: base + R$ 10 por profissional adicional (1º é grátis).
      const monthlyTotalCents = subscriptionTotalCents(
        business.monthly_fee_cents ?? 0,
        professionalsCount.get(business.id) ?? 0,
      );
      if (
        lifecycle.category !== "atencao" &&
        daysSinceLastAccess != null &&
        daysSinceLastAccess >= 7
      ) {
        semAcessoSete += 1;
      }

      items.push({
        id: business.id,
        name: business.name,
        phone: business.phone,
        category: business.category,
        status: business.status,
        createdAt: business.created_at,
        ownerName: profiles.get(business.owner_id)?.full_name ?? null,
        ownerEmail: profiles.get(business.owner_id)?.email ?? null,
        category_: lifecycle.category,
        reason: lifecycle.reason,
        reasonLabel:
          lifecycle.reason != null ? ATTENTION_REASON_LABEL[lifecycle.reason] : null,
        isTrial,
        trialDays: business.trial_days,
        accessUntil: business.access_until,
        trialEnd: business.access_until,
        trialDaysLeft: isTrial ? Math.max(lifecycle.daysLeft, 0) : null,
        trialAlert: lifecycle.trialAlert,
        dueDate: business.access_until,
        nextDue: business.access_until,
        dueInDays: lifecycle.daysLeft,
        dueAlert: lifecycle.dueAlert,
        daysLate: lifecycle.daysLate,
        firstPaymentAt,
        lastPaymentAt,
        paymentsCount: paidRows.length,
        totalPaidCents,
        monthlyFeeCents: business.monthly_fee_cents ?? 0,
        monthlyTotalCents,
        planLabel: isTrial ? "Teste Grátis" : "Premium",
        paid: lifecycle.daysLeft >= 0,
        appointmentsCount: appointmentsByBusiness.get(business.id) ?? 0,
        setupPercent: setup.percent,
        lastAccessAt,
        daysSinceLastAccess,
        cancelRequestedAt: business.cancel_requested_at,
        cancelledAt: business.cancelled_at,
        salesOwner: business.sales_owner,
      });
    }

    return {
      generatedAt: now.toISOString(),
      items,
      kpis: { assinantes, emTeste, vencemSete, atencao, semAcessoSete },
    };
  });

/** Estende o período de teste de um estabelecimento (ação do master). */
export const extendBusinessTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        days: z.number().int().min(1).max(90),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("id, name, access_until")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Estabelecimento não encontrado.");

    const base =
      business.access_until && new Date(business.access_until).getTime() > Date.now()
        ? new Date(business.access_until)
        : new Date();
    const end = new Date(base.getTime() + data.days * DAY_MS).toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("businesses")
      .update({ access_until: end })
      .eq("id", business.id);
    if (updateError) throw new Error(updateError.message);

    try {
      await supabaseAdmin.from("master_business_events").insert({
        business_id: business.id,
        actor_id: context.userId,
        type: "assinatura",
        title: "Teste estendido",
        description: `+${data.days} dias — novo fim do teste: ${new Date(end).toLocaleDateString("pt-BR")}`,
      });
    } catch (eventError) {
      console.error("Falha ao registrar evento de auditoria:", eventError);
    }
    return { trialDays: data.days, trialEnd: end };
  });

export type ReceivableMethod = "cartao" | "pix_automatico" | "pix";

/**
 * Método de cobrança do estabelecimento, derivado dos flags existentes:
 * - Cartão: Ag Pay com split aprovado (cobrança recorrente pelo gateway);
 * - PIX Automático: flag de chave automática ativa;
 * - PIX: demais (pix manual).
 */
export function receivableMethod(business: {
  agpay_split_status?: string | null;
  agpay_auto_first_key?: boolean | null;
}): ReceivableMethod {
  if (business.agpay_split_status === "aprovada") return "cartao";
  if (business.agpay_auto_first_key === true) return "pix_automatico";
  return "pix";
}

/** Agenda de recebíveis: próximos vencimentos (projeção) e pagamentos confirmados. */
export const getReceivablesCalendar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const now = new Date();

    const [businessesRes, profilesRes, paymentsRes, professionalsRes] = await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select(
          "id, name, status, monthly_fee_cents, created_at, trial_days, access_until, cancel_requested_at, cancelled_at, agpay_split_status, agpay_auto_first_key",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin
        .from("subscription_payments")
        .select("id, business_id, reference_month, status, amount_cents, paid_at, created_at"),
      supabaseAdmin.from("professionals").select("id, business_id").limit(20000),
    ]);
    for (const [label, result] of [
      ["estabelecimentos", businessesRes],
      ["responsáveis", profilesRes],
      ["pagamentos", paymentsRes],
      ["profissionais", professionalsRes],
    ] as const) {
      if (result.error) throw new Error(`Falha ao carregar ${label}: ${result.error.message}`);
    }

    const professionalsByBusiness = new Map<string, number>();
    for (const professional of professionalsRes.data ?? []) {
      professionalsByBusiness.set(
        professional.business_id,
        (professionalsByBusiness.get(professional.business_id) ?? 0) + 1,
      );
    }

    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const businessNames = new Map((businessesRes.data ?? []).map((b) => [b.id, b.name]));

    const methodByBusiness = new Map<string, ReceivableMethod>();
    for (const business of businessesRes.data ?? []) {
      methodByBusiness.set(business.id, receivableMethod(business));
    }

    const paidMonthsByBusiness = new Map<string, boolean>();
    const windowStart = new Date(now.getTime() - 120 * DAY_MS).toISOString();
    const received = (paymentsRes.data ?? [])
      .filter((p) => p.status === "pago" && (p.paid_at ?? p.created_at) >= windowStart)
      .map((p) => ({
        id: p.id,
        businessName: businessNames.get(p.business_id) ?? "—",
        amountCents: p.amount_cents ?? 0,
        paidAt: p.paid_at ?? p.created_at,
        method: methodByBusiness.get(p.business_id) ?? ("pix" as ReceivableMethod),
      }));

    for (const payment of paymentsRes.data ?? []) {
      if (payment.status !== "pago") continue;
      paidMonthsByBusiness.set(payment.business_id, true);
    }

    const upcoming: Array<{
      id: string;
      name: string;
      nextDue: string;
      amountCents: number;
      method: ReceivableMethod;
    }> = [];
    let churnCount = 0;
    let churnMonthlyCents = 0;

    for (const business of businessesRes.data ?? []) {
      if (business.cancel_requested_at && !business.cancelled_at) {
        churnCount += 1;
        churnMonthlyCents += business.monthly_fee_cents ?? 0;
      }

      const lifecycle = classifyLifecycle({
        status: business.status,
        isTrial: business.trial_days != null && !paidMonthsByBusiness.has(business.id),
        accessUntil: business.access_until,
        cancelRequestedAt: business.cancel_requested_at,
        cancelledAt: business.cancelled_at,
        now,
      });

      // Cobrança esperada: o vencimento rolante de cada assinante vigente e ativo.
      if (lifecycle.category !== "assinante" || business.status === "suspenso") continue;
      // Valor cobrado: base + R$ 10 por profissional adicional (1º é grátis).
      const amountCents = subscriptionTotalCents(
        business.monthly_fee_cents ?? 0,
        professionalsByBusiness.get(business.id) ?? 0,
      );
      upcoming.push({
        id: business.id,
        name: business.name,
        nextDue: business.access_until ?? new Date(now.getTime() + 30 * 86_400_000).toISOString(),
        amountCents,
        method: receivableMethod(business),
      });
    }

    return {
      generatedAt: now.toISOString(),
      upcoming,
      received,
      churn: { count: churnCount, monthlyCents: churnMonthlyCents },
    };
  });

/** Ciclo de acesso de um estabelecimento: dias restantes, vencimento e estágio atual. */
export const getBusinessAccessCycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ businessId: z.string().uuid() }).parse(input),
  )
    .handler(async ({ context, data }) => {
      const supabaseAdmin = await assertSuperAdmin(context);
      const { data: business, error } = await supabaseAdmin
        .from("businesses")
        .select(
          "id, name, status, trial_days, monthly_fee_cents, cancel_requested_at, cancelled_at, access_until",
        )
        .eq("id", data.businessId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!business) throw new Error("Estabelecimento não encontrado.");

      const { data: payments } = await supabaseAdmin
        .from("subscription_payments")
        .select("id, paid_at, amount_cents, created_at")
        .eq("business_id", business.id)
        .eq("status", "pago")
        .order("paid_at", { ascending: true });

      const everPaid = (payments ?? []).length > 0;
      const isTrial = business.trial_days != null && !everPaid;
      const now = new Date();
      const cycle = computeAccessCycle({ accessUntil: business.access_until, now });
      const lifecycle = classifyLifecycle({
        status: business.status,
        isTrial,
        accessUntil: business.access_until,
        cancelRequestedAt: business.cancel_requested_at,
        cancelledAt: business.cancelled_at,
        now,
      });

      const lastPaymentAt = (payments ?? []).at(-1)?.paid_at ?? null;
      const lastPaymentCents = (payments ?? []).at(-1)?.amount_cents ?? 0;
      // Valor da assinatura: base + R$ 10 por profissional adicional (1º é grátis).
      const { count: professionalsCount } = await supabaseAdmin
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id);
      const amountCents = subscriptionTotalCents(
        business.monthly_fee_cents ?? 8990,
        professionalsCount ?? 0,
      );

    return {
      id: business.id,
      name: business.name,
      status: business.status,
      category: lifecycle.category,
      reason: lifecycle.reason,
      reasonLabel:
        lifecycle.reason != null ? ATTENTION_REASON_LABEL[lifecycle.reason] : null,
      everPaid,
      isTrial,
      stage: cycle.stage,
      daysLeft: cycle.daysLeft,
      daysLate: Math.max(-cycle.daysLeft, 0),
      accessUntil: cycle.accessUntil,
      dueInDays: cycle.daysLeft >= 0 ? cycle.daysLeft : null,
      trialDaysLeft: isTrial ? Math.max(cycle.daysLeft, 0) : null,
      amountCents,
      lastPaymentAt,
      lastPaymentCents,
    };
  });

/**
 * Edição dos dias de acesso pelo master, no formato adicionar/remover:
 * desloca o VENCIMENTO ROLANTE (access_until) em ±N dias — para mais ou menos.
 * Adicionar em conta vencida reativa a partir de hoje; remover até o vencimento
 * de hoje congela a conta no fluxo de avisos/bloqueio.
 * O motivo informado pelo master fica registrado na auditoria.
 */
export const setBusinessAccessDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        action: z.enum(["adicionar", "remover"]),
        days: z.number().int().min(1).max(36500),
        motivo: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("id, name, access_until")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Estabelecimento não encontrado.");

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const current = business.access_until
      ? new Date(business.access_until)
      : new Date(now.getTime() - 86_400_000); // sem vencimento: tratado como expirado
    const shiftMs = (data.action === "adicionar" ? 1 : -1) * data.days * 86_400_000;
    const newUntil = new Date(current.getTime() + shiftMs).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("businesses")
      .update({ access_until: newUntil })
      .eq("id", business.id);
    if (updateError) throw new Error(updateError.message);

    const title =
      data.action === "adicionar" ? "Dias de acesso adicionados" : "Dias de acesso removidos";
    const description = `${data.action === "adicionar" ? "+" : "-"}${data.days} dias — novo vencimento: ${new Date(newUntil).toLocaleDateString("pt-BR")}${data.motivo?.trim() ? ` · Motivo: ${data.motivo.trim()}` : ""}`;

    try {
      await supabaseAdmin.from("master_business_events").insert({
        business_id: business.id,
        actor_id: context.userId,
        type: "assinatura",
        title,
        description,
      });
    } catch (eventError) {
      console.error("Falha ao registrar evento de auditoria:", eventError);
    }
    return {
      ok: true as const,
      description,
      accessUntil: newUntil,
      daysLeft: Math.round((new Date(newUntil).getTime() - now.getTime()) / 86_400_000),
    };
  });

/** Entrada direta no Painel 2 do estabelecimento (impersonação, só para masters). */
export const impersonateBusinessOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ businessId: z.string().uuid(), origin: z.string().min(1) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    let origin: string;
    try { origin = new URL(data.origin).origin; } catch { throw new Error("ORIGIN_NOT_ALLOWED"); }
    if (!getAllowedAppOrigins().has(origin)) throw new Error("ORIGIN_NOT_ALLOWED");
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("id, name, owner_id, phone")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Estabelecimento não encontrado.");

    // A auditoria vem ANTES de qualquer sessão: se não for possível registrar quem entrou
    // na conta do dono, o acesso não é criado (nada de try/catch silencioso).
    const { error: auditError } = await supabaseAdmin.from("master_business_events").insert({
      business_id: business.id,
      actor_id: context.userId,
      type: "suporte",
      title: "Acesso direto ao Painel 2",
      description: "Um master entrou na conta do estabelecimento para editar em nome do dono.",
    });
    if (auditError) throw new Error("AUDIT_FAILED");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", business.owner_id)
      .maybeSingle();
    const ownerEmail =
      profile?.email ?? `${(business.phone ?? "").replace(/\D/g, "")}@agenda.local`;
    if (!ownerEmail || ownerEmail === "@agenda.local") {
      throw new Error("Este estabelecimento ainda não tem acesso do dono criado.");
    }

    const redirectTo = `${origin}/painel`;
    const gerarLink = () =>
      supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: ownerEmail,
        options: { redirectTo },
      });
    let { data: linkData, error: linkError } = await gerarLink();
    if (linkError) {
      // Dono sem usuário de autenticação (conta criada sem acesso): cria agora
      // para que Painel 3 e Painel do SDR se comportem exatamente iguais.
      const { error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        email_confirm: true,
        user_metadata: {
          full_name: business.name,
          phone: (business.phone ?? "").replace(/\D/g, ""),
        },
      });
      if (createUserError) throw new Error(linkError.message);
      ({ data: linkData, error: linkError } = await gerarLink());
      if (linkError) throw new Error(linkError.message);
    }
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) throw new Error("Não foi possível gerar o acesso direto.");
    // Sessão extraída no servidor: o cliente entra com setSession na MESMA
    // origem — sem redirect pelo Supabase (que caía no domínio de produção).
    const { accessToken, refreshToken } = await tokensDaSessaoViaLink(actionLink);

    const impersonationToken =
      createHash("sha256").update(crypto.randomUUID()).digest("hex") +
      createHash("sha256").update(crypto.randomUUID()).digest("hex");
    // Sessão de impersonação: permite o banner "Voltar ao Painel Master" no
    // Painel 2 (com PIN) e vincula o retorno ao master que iniciou o acesso.
    const { error: sessionError } = await supabaseAdmin.from("master_impersonation_sessions").insert({
      business_id: business.id,
      master_user_id: context.userId,
      token: impersonationToken,
      expires_at: new Date(Date.now() + 12 * 60 * 60_000).toISOString(),
    });
    if (sessionError) throw new Error("Não foi possível iniciar a sessão de acesso direto.");

    return { accessToken, refreshToken, ownerEmail, impersonationToken };
  });

/**
 * Executa o link de verificação do Supabase NO SERVIDOR e extrai os tokens da
 * sessão. O cliente nunca é redirecionado para fora do domínio atual — funciona
 * em localhost, LAN (192.168.x.x) e produção sem depender da allow-list de
 * redirects do Supabase (que mandava tudo para o Site URL da produção).
 */
async function tokensDaSessaoViaLink(
  actionLink: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const resposta = await fetch(actionLink, { redirect: "manual" });
  let bruto = resposta.headers.get("location") ?? "";
  if (!bruto) {
    const corpo = await resposta.text();
    bruto = corpo.match(/https?:\/\/[^"'\s]+#access_token=[^"'\s]+/)?.[0] ?? "";
  }
  const params = new URLSearchParams((bruto.split("#")[1] ?? "").replace(/&amp;/g, "&"));
  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";
  if (!accessToken || !refreshToken) {
    throw new Error("Não foi possível validar o acesso direto. Tente novamente.");
  }
  return { accessToken, refreshToken };
}

/**
 * Valida a sessão de impersonação no Painel 2. Exige que o chamador esteja
 * logado como o DONO do negócio vinculado ao token — donos comuns, sem token,
 * nunca veem o banner e nunca conseguem chamá-la com sucesso.
 */
export const validateImpersonationSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(32) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("master_impersonation_sessions")
      .select("id, business_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
      throw new Error("Sessão de acesso não encontrada.");
    }

    // O chamador precisa estar logado como o DONO do negócio impersonado.
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("owner_id")
      .eq("id", session.business_id)
      .maybeSingle();
    if (!business || business.owner_id !== context.userId) {
      throw new Error("Sessão de acesso não encontrada.");
    }

    return { valid: true as const };
  });

/**
 * Volta ao Painel 3: valida token + dono + PIN fixo da equipe (server-only),
 * encerra a sessão de impersonação (uso único) e devolve a sessão do master
 * que iniciou o acesso — via link mágico, sem depender de senha.
 */
export const returnToMasterSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().min(32),
        pin: z.string().min(4).max(12),
        origin: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    // SEM assertSuperAdmin de propósito: durante a impersonação quem está
    // logado é o DONO (sem role master). A segurança aqui é o token da sessão
    // + vínculo com o dono do negócio + PIN fixo da equipe (server-only).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let origin: string;
    try { origin = new URL(data.origin).origin; } catch { throw new Error("ORIGIN_NOT_ALLOWED"); }
    if (!getAllowedAppOrigins().has(origin)) throw new Error("ORIGIN_NOT_ALLOWED");

    const { data: session, error } = await supabaseAdmin
      .from("master_impersonation_sessions")
      .select("id, business_id, master_user_id, expires_at, attempts")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const expired = !session || new Date(session.expires_at).getTime() <= Date.now();
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("owner_id")
      .eq("id", session?.business_id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    const callerIsOwner = !!business && business.owner_id === context.userId;
    if (expired || !session || !callerIsOwner) {
      throw new Error("Sessão de acesso não encontrada.");
    }

    if (!masterReturnPinMatches(data.pin)) {
      const attempts = (session.attempts ?? 0) + 1;
      if (attempts >= 3) {
        // Três erros encerram a sessão de impersonação por segurança.
        await supabaseAdmin
          .from("master_impersonation_sessions")
          .delete()
          .eq("id", session.id);
        throw new Error("PIN incorreto. Sessão de acesso encerrada por segurança.");
      }
      await supabaseAdmin
        .from("master_impersonation_sessions")
        .update({ attempts })
        .eq("id", session.id);
      throw new Error("PIN incorreto.");
    }

    // PIN correto: encerra a sessão (uso único) e devolve a sessão do master.
    await supabaseAdmin
      .from("master_impersonation_sessions")
      .delete()
      .eq("id", session.id);

    const { data: masterProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", session.master_user_id)
      .maybeSingle();
    const masterEmail = masterProfile?.email;
    if (!masterEmail) throw new Error("Conta master sem e-mail registrado.");

    const redirectTo = `${origin}/painel/master`;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: masterEmail,
      options: { redirectTo },
    });
    if (linkError) throw new Error(linkError.message);
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) throw new Error("Não foi possível restaurar a sessão do master.");
    // Mesma técnica: tokens extraídos no servidor — o retorno acontece na
    // mesma origem, sem passar pelo domínio de produção.
    const { accessToken, refreshToken } = await tokensDaSessaoViaLink(actionLink);

    return { accessToken, refreshToken };
  });

/** Registra pedido de cancelamento, efetiva ou reverte (ação do master). */export const setBusinessCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        action: z.enum(["solicitar", "efetivar", "reverter"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const now = new Date().toISOString();
    const patch =
      data.action === "solicitar"
        ? { cancel_requested_at: now }
        : data.action === "efetivar"
          ? { cancelled_at: now }
          : { cancel_requested_at: null, cancelled_at: null };
    const { error } = await supabaseAdmin
      .from("businesses")
      .update(patch)
      .eq("id", data.businessId);
    if (error) throw new Error(error.message);

    const title =
      data.action === "solicitar"
        ? "Cancelamento solicitado"
        : data.action === "efetivar"
          ? "Cancelamento efetivado"
          : "Cancelamento revertido";
    try {
      await supabaseAdmin.from("master_business_events").insert({
        business_id: data.businessId,
        actor_id: context.userId,
        type: "assinatura",
        title,
        description:
          data.action === "reverter"
            ? "Assinatura reativada pelo master."
            : "Registrado automaticamente pelo ciclo de assinaturas.",
      });
    } catch (eventError) {
      console.error("Falha ao registrar evento de auditoria:", eventError);
    }
    return { ok: true as const };
  });

/** Contadores de badges da sidebar master (Pix em análise + assinantes do dia). */
export const getPlatformNavCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [pixRes, paymentsRes] = await Promise.all([
      supabaseAdmin
        .from("pix_key_approvals")
        .select("business_id")
        .eq("status", "pendente"),
      supabaseAdmin
        .from("subscription_payments")
        .select("business_id")
        .eq("status", "pago")
        .not("paid_at", "is", null)
        .gte("paid_at", dayStart.toISOString()),
    ]);
    if (pixRes.error) throw new Error(pixRes.error.message);
    if (paymentsRes.error) throw new Error(paymentsRes.error.message);
    const pixPendentes = new Set((pixRes.data ?? []).map((r) => r.business_id)).size;
    const novosAssinantes = new Set((paymentsRes.data ?? []).map((r) => r.business_id)).size;
    return { pixPendentes, novosAssinantes };
  });
