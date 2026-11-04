import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import {
  evaluateAccountHealth,
  summarizeSetup,
  type HealthStatus,
} from "@/lib/master/business-intelligence";
import { trialInfo } from "@/lib/trial-store";
import {
  classifyLifecycle,
  type AttentionReason,
  type LifecycleCategory,
} from "@/lib/subscription-lifecycle";
import { subscriptionTotalCents } from "@/lib/billing-cycle";

/**
 * Visão geral da plataforma (Painel 3 Master).
 *
 * Reúne os indicadores de SaaS da imagem de referência:
 * - cartões de Establishing (ativos, MRR, recebido no mês, agendamentos, contas em risco);
 * - faixa de saúde dos assinantes (quantos saudáveis, em atenção e em risco);
 * - alertas agregados que exigem ação do administrador;
 * - tabela de estabelecimentos com plano, última atividade, agendamentos, pagamento e saúde.
 *
 * Todos os números vêm do banco. O mês corrente e o anterior seguem o fuso
 * (referência) do servidor para não distorcer a comparação.
 */

const DAY_MS = 86_400_000;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey(date: Date) {
  const base = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return monthKey(base);
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type PlatformBusinessRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  phone: string | null;
  status: string;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  planLabel: string;
  monthlyFeeCents: number;
  lastAccessAt: string | null;
  daysSinceLastAccess: number | null;
  appointments30: number;
  appointmentsPrevious30: number;
  appointmentsVariation: number | null;
  paymentStatus: "pago" | "pendente" | "inexistente";
  nextChargeAt: string | null;
  health: HealthStatus;
  healthScore: number | null;
  setupPercent: number;
  alerts: number;
  lifecycleCategory: LifecycleCategory;
  lifecycleReason: AttentionReason | null;
  dueInDays: number | null;
  daysLate: number;
};

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const now = new Date();
    const currentMonth = monthKey(now);
    const previousMonth = previousMonthKey(now);
    const periodStart = new Date(now.getTime() - 60 * DAY_MS).toISOString();

    const [
      businessesRes,
      profilesRes,
      appointmentsRes,
      paymentsRes,
      servicesRes,
      prosRes,
      hoursRes,
      customersRes,
      depositsRes,
      eventsRes,
      notesRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select(
          "id, name, slug, category, phone, status, created_at, owner_id, monthly_fee_cents, trial_days, trial_created_at, access_until, cancel_requested_at, cancelled_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin
        .from("appointments")
        .select("id, business_id, status, starts_at, created_at")
        .gte("starts_at", periodStart)
        .limit(20000),
      supabaseAdmin
        .from("subscription_payments")
        .select("business_id, reference_month, status, amount_cents, paid_at, created_at")
        .limit(5000),
      supabaseAdmin.from("services").select("id, business_id").limit(20000),
      supabaseAdmin.from("professionals").select("id, business_id").limit(20000),
      supabaseAdmin.from("business_hours").select("id, business_id").limit(20000),
      supabaseAdmin.from("customers").select("id, business_id, created_at").limit(20000),
      supabaseAdmin
        .from("deposit_payments")
        .select("business_id, status, amount_cents, platform_commission_cents, paid_at, created_at")
        .limit(5000),
      supabaseAdmin
        .from("master_business_events")
        .select("id, business_id, type, title, description, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("master_business_notes")
        .select("id, business_id, body, next_step, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    for (const [label, result] of [
      ["estabelecimentos", businessesRes],
      ["proprietários", profilesRes],
      ["agendamentos", appointmentsRes],
      ["cobranças", paymentsRes],
      ["serviços", servicesRes],
      ["profissionais", prosRes],
      ["horários", hoursRes],
      ["clientes", customersRes],
      ["sinais pix", depositsRes],
      ["eventos", eventsRes],
      ["observações", notesRes],
    ] as const) {
      if (result.error) throw new Error(`Falha ao carregar ${label}: ${result.error.message}`);
    }

    const businesses = businessesRes.data ?? [];
    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

    // Último acesso real: `auth.users.last_sign_in_at` via admin (uma chamada por dono).
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

    const countBy = <T extends { business_id: string }>(rows: T[]) => {
      const map = new Map<string, number>();
      for (const row of rows) map.set(row.business_id, (map.get(row.business_id) ?? 0) + 1);
      return map;
    };
    const servicesCount = countBy(servicesRes.data ?? []);
    const professionalsCount = countBy(prosRes.data ?? []);
    const hoursCount = countBy(hoursRes.data ?? []);
    const customersCount = countBy(customersRes.data ?? []);

    const paymentsByBusiness = new Map<string, typeof paymentsRes.data>();
    for (const payment of paymentsRes.data ?? []) {
      const list = paymentsByBusiness.get(payment.business_id) ?? [];
      list.push(payment);
      paymentsByBusiness.set(payment.business_id, list);
    }

    const rows: PlatformBusinessRow[] = [];
    let activeBusinesses = 0;
    let suspendedBusinesses = 0;
    let mrrCents = 0;
    let paidThisMonthCents = 0;
    let paidThisMonthCount = 0;
    let pendingCount = 0;
    let appointmentsThisMonth = 0;
    let appointmentsPreviousMonth = 0;
    // Ciclo de vida das assinaturas (indicadores do Painel Master).
    let emTeste = 0;
    let vencemSete = 0;
    let atencao = 0;
    let semAcessoSete = 0;
    let assinantesCount = 0;
    let testeExpiradoCount = 0;
    const paidByBusiness = new Map<string, number>();
    const healthCounts: Record<HealthStatus, number> = {
      saudavel: 0,
      atencao: 0,
      risco: 0,
      sem_dados: 0,
    };

    for (const business of businesses) {
      const suspended = business.status === "suspenso";
      if (suspended) suspendedBusinesses += 1;
      else activeBusinesses += 1;

      const payments = paymentsByBusiness.get(business.id) ?? [];
      const monthPayments = payments.filter((p) => p.reference_month.slice(0, 7) === currentMonth);
      const paidThisMonth = monthPayments.filter((p) => p.status === "pago");
      const pendingThisMonth = monthPayments.filter((p) => p.status !== "pago");
      if (!suspended) {
        paidThisMonthCents += paidThisMonth.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
        paidThisMonthCount += paidThisMonth.length;
        pendingCount += pendingThisMonth.length;
      }
      if (paidThisMonth.length > 0) {
        paidByBusiness.set(business.id, paidThisMonth.length);
      }

      const businessAppointments = (appointmentsRes.data ?? []).filter(
        (a) => a.business_id === business.id,
      );
      const inWindow = (startsAt: string) => {
        const value = startsAt.slice(0, 7);
        return value === currentMonth || value === previousMonth;
      };
      const current = businessAppointments.filter(
        (a) => inWindow(a.starts_at) && a.starts_at.slice(0, 7) === currentMonth,
      );
      const previous = businessAppointments.filter(
        (a) => inWindow(a.starts_at) && a.starts_at.slice(0, 7) === previousMonth,
      );
      appointmentsThisMonth += current.length;
      appointmentsPreviousMonth += previous.length;

      const windowStart30 = now.getTime() - 30 * DAY_MS;
      const windowStart60 = now.getTime() - 60 * DAY_MS;
      const appointments30 = businessAppointments.filter(
        (a) => Date.parse(a.starts_at) >= windowStart30 && a.status !== "cancelado",
      ).length;
      const appointmentsPrevious30 = businessAppointments.filter((a) => {
        const value = Date.parse(a.starts_at);
        return value >= windowStart60 && value < windowStart30 && a.status !== "cancelado";
      }).length;

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
        hasReceivedAppointments: businessAppointments.length > 0,
      });

      const lastAccessAt = lastAccessByOwner.get(business.owner_id) ?? null;
      const daysSinceLastAccess = lastAccessAt
        ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastAccessAt)) / DAY_MS))
        : null;

      // Ciclo de vida: derivado do vencimento rolante real.
      const isTrialBusiness = business.trial_days != null && !paidByBusiness.has(business.id);
      const lifecycle = classifyLifecycle({
        status: business.status,
        isTrial: isTrialBusiness,
        accessUntil: business.access_until,
        cancelRequestedAt: business.cancel_requested_at,
        cancelledAt: business.cancelled_at,
        now,
      });
      if (lifecycle.category === "em_teste") emTeste += 1;
      if (lifecycle.category === "assinante") {
        assinantesCount += 1;
        // MRR: apenas assinaturas pagas e vigentes (testes e não confirmados ficam fora).
        // Valor inclui R$ 10 por profissional adicional (o 1º é grátis).
        mrrCents += subscriptionTotalCents(
          business.monthly_fee_cents ?? 0,
          professionalsCount.get(business.id) ?? 0,
        );
        if (lifecycle.dueAlert != null) vencemSete += 1;
      }
      if (lifecycle.category === "atencao") atencao += 1;
      if (lifecycle.reason === "teste_expirado") testeExpiradoCount += 1;
      if (
        lifecycle.category !== "atencao" &&
        daysSinceLastAccess != null &&
        daysSinceLastAccess >= 7
      ) {
        semAcessoSete += 1;
      }
      const lastAppointment = businessAppointments
        .map((a) => a.starts_at)
        .sort()
        .at(-1);
      const daysSinceLastAppointment = lastAppointment
        ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastAppointment)) / DAY_MS))
        : null;

      const paymentStatus: "pago" | "pendente" | "inexistente" = monthPayments.length
        ? paidThisMonth.length
          ? "pago"
          : "pendente"
        : "inexistente";

      const health = evaluateAccountHealth({
        hasUsageData:
          businessAppointments.length > 0 ||
          (customersCount.get(business.id) ?? 0) > 0 ||
          payments.length > 0,
        daysSinceLastAccess,
        daysSinceLastAppointment,
        periodAppointments: appointments30,
        previousPeriodAppointments: appointmentsPrevious30,
        daysSinceSignup: Math.max(
          0,
          Math.floor((now.getTime() - Date.parse(business.created_at)) / DAY_MS),
        ),
        setupPercent: setup.percent,
        paymentStatus,
        trialDaysRemaining: trial ? trial.remaining : null,
      });
      healthCounts[health.status] += 1;

      const lastPaid = payments
        .filter((p) => p.status === "pago")
        .sort((a, b) => b.reference_month.localeCompare(a.reference_month))[0];
      const nextChargeAt = lastPaid
        ? (() => {
            const base = new Date(`${lastPaid.reference_month.slice(0, 7)}-01T12:00:00Z`);
            base.setUTCMonth(base.getUTCMonth() + 1);
            return base.toISOString();
          })()
        : null;

      rows.push({
        id: business.id,
        name: business.name,
        slug: business.slug,
        category: business.category,
        phone: business.phone,
        status: business.status,
        createdAt: business.created_at,
        ownerName: profiles.get(business.owner_id)?.full_name ?? null,
        ownerEmail: profiles.get(business.owner_id)?.email ?? null,
        planLabel: trial ? "Teste Grátis" : "Premium",
        monthlyFeeCents: business.monthly_fee_cents ?? 0,
        lastAccessAt,
        daysSinceLastAccess,
        appointments30,
        appointmentsPrevious30,
        appointmentsVariation: percentChange(appointments30, appointmentsPrevious30),
        paymentStatus,
        nextChargeAt,
        health: health.status,
        healthScore: health.score,
        setupPercent: setup.percent,
        alerts: health.reasons.length,
        lifecycleCategory: lifecycle.category,
        lifecycleReason: lifecycle.reason,
        dueInDays: lifecycle.daysLeft,
        daysLate: lifecycle.daysLate,
      });
    }

    const riskAccounts = healthCounts.risco;
    const countReason = (reason: AttentionReason) =>
      rows.filter((row) => row.lifecycleReason === reason).length;
    const alerts = [
      {
        id: "vencidas",
        severity: "critico" as const,
        title: `${countReason("assinatura_vencida")} assinatura(s) vencida(s)`,
        description: "Fora da tolerância de 3 dias — cobrança e recuperação comercial.",
        count: countReason("assinatura_vencida"),
        href: "/painel/precisa-de-atencao",
      },
      {
        id: "pendente",
        severity: "critico" as const,
        title: `${countReason("pagamento_pendente")} pagamento(s) pendente(s)`,
        description: "Dentro da tolerância de 3 dias — aguardando confirmação.",
        count: countReason("pagamento_pendente"),
        href: "/painel/precisa-de-atencao",
      },
      {
        id: "testes",
        severity: "atencao" as const,
        title: `${testeExpiradoCount} teste(s) expirado(s)`,
        description: "Encerraram o período gratuito sem contratar.",
        count: testeExpiradoCount,
        href: "/painel/precisa-de-atencao",
      },
      {
        id: "vencimentos",
        severity: "atencao" as const,
        title: `${vencemSete} fatura(s) vencem em 7 dias`,
        description: "Renovações próximas — acompanhamento preventivo.",
        count: vencemSete,
        href: "/painel/assinantes",
      },
      {
        id: "suspensos",
        severity: "critico" as const,
        title: `${countReason("acesso_suspenso")} acesso(s) suspenso(s)`,
        description: "Contas com o acesso formalmente suspenso.",
        count: countReason("acesso_suspenso"),
        href: "/painel/precisa-de-atencao",
      },
      {
        id: "sem-acesso",
        severity: "atencao" as const,
        title: `${semAcessoSete} conta(s) sem acesso há 7+ dias`,
        description: "Podem estar com dificuldades ou em risco de cancelamento.",
        count: semAcessoSete,
      },
      {
        id: "configuracao",
        severity: "atencao" as const,
        title: `${rows.filter((r) => r.setupPercent < 100).length} configurações incompletas`,
        description: "Falta de dados, horários ou serviços cadastrados.",
        count: rows.filter((r) => r.setupPercent < 100).length,
      },
    ].filter((alert) => alert.count > 0);

    // Seções de SaaS da barra inferior do Painel 3.
    const appointments = appointmentsRes.data ?? [];
    const monthAppointments = appointments.filter((a) => a.starts_at.slice(0, 7) === currentMonth);
    const appointmentsByStatus = new Map<string, number>();
    for (const appointment of monthAppointments) {
      const status = appointment.status || "desconhecido";
      appointmentsByStatus.set(status, (appointmentsByStatus.get(status) ?? 0) + 1);
    }
    const appointmentsByBusiness = new Map<string, number>();
    for (const appointment of monthAppointments) {
      appointmentsByBusiness.set(
        appointment.business_id,
        (appointmentsByBusiness.get(appointment.business_id) ?? 0) + 1,
      );
    }
    const topByAppointments = [...appointmentsByBusiness.entries()]
      .map(([businessId, count]) => ({
        businessId,
        name: rows.find((row) => row.id === businessId)?.name ?? "Estabelecimento",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const deposits = depositsRes.data ?? [];
    const depositsPaid = deposits.filter((d) => d.status === "pago" || d.status === "aprovado");
    const platformCommissionCents = depositsPaid.reduce(
      (sum, deposit) => sum + (deposit.platform_commission_cents ?? 0),
      0,
    );

    const businessNameById = new Map(businesses.map((b) => [b.id, b.name]));

    // Atividades recentes — eventos reais registrados pelo sistema.
    const recentEvents = (eventsRes.data ?? []).map((event) => ({
      id: event.id,
      businessName: businessNameById.get(event.business_id) ?? "Estabelecimento",
      type: event.type,
      title: event.title,
      description: event.description,
      createdAt: event.created_at,
    }));

    return {
      generatedAt: now.toISOString(),
      currentMonth,
      previousMonth,
      kpis: {
        activeBusinesses,
        totalBusinesses: businesses.length,
        suspendedBusinesses,
        mrrCents,
        paidThisMonthCents,
        paidThisMonthCount,
        pendingCount,
        appointmentsThisMonth,
        appointmentsVariation: percentChange(appointmentsThisMonth, appointmentsPreviousMonth),
        riskAccounts,
        healthCounts,
        lifecycle: {
          emTeste,
          assinantes: assinantesCount,
          vencemSete,
          atencao,
          semAcessoSete,
          testeExpiradoCount,
        },
      },
      rows,
      alerts,
      recentEvents,
      sections: {
        agendamentos: {
          total: monthAppointments.length,
          byStatus: [...appointmentsByStatus.entries()]
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count),
          byBusiness: topByAppointments,
        },
        desempenho: {
          mrrCents,
          receivedCents: paidThisMonthCents,
          pendingCents: pendingCount * (mrrCents / Math.max(1, activeBusinesses)),
          depositsPaid: depositsPaid.length,
          depositsTotal: deposits.length,
          platformCommissionCents,
          avgAppointmentsPerBusiness:
            activeBusinesses > 0
              ? Math.round((appointmentsThisMonth / activeBusinesses) * 10) / 10
              : 0,
        },
        assinatura: {
          mrrCents,
          paidThisMonthCents,
          pendingCount,
          paidThisMonthCount,
          history: (paymentsRes.data ?? [])
            .filter((payment) => payment.reference_month.slice(0, 7) === currentMonth)
            .map((payment) => ({
              businessId: payment.business_id,
              businessName: businessNameById.get(payment.business_id) ?? "Estabelecimento",
              referenceMonth: payment.reference_month.slice(0, 7),
              status: payment.status,
              amountCents: payment.amount_cents,
              paidAt: payment.paid_at,
            }))
            .sort((a, b) => b.amountCents - a.amountCents),
        },
        atividade: (eventsRes.data ?? []).map((event) => ({
          id: event.id,
          businessId: event.business_id,
          businessName: businessNameById.get(event.business_id) ?? "Estabelecimento",
          type: event.type,
          title: event.title,
          description: event.description,
          createdAt: event.created_at,
        })),
        suporte: (notesRes.data ?? []).map((note) => ({
          id: note.id,
          businessId: note.business_id,
          businessName: businessNameById.get(note.business_id) ?? "Estabelecimento",
          body: note.body,
          nextStep: note.next_step,
          createdAt: note.created_at,
        })),
      },
    };
  });
