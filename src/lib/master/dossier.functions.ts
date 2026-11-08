import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import {
  evaluateAccountHealth,
  summarizeClients,
  summarizeDeposits,
  summarizeSetup,
  summarizeSubscription,
  summarizeUsage,
  type HealthEvaluation,
  type MasterAppointmentRow,
  type MasterCustomerRow,
  type MasterDepositRow,
  type MasterPaymentRow,
  type MasterProfessionalRow,
  type MasterServiceRow,
} from "@/lib/master/business-intelligence";
import { trialInfo } from "@/lib/trial-store";

const PERIOD_OPTIONS = [7, 30, 90] as const;

const dossierInput = z.object({
  businessId: z.string().uuid(),
  periodDays: z
    .number()
    .int()
    .refine((value) => PERIOD_OPTIONS.includes(value as 7), {
      message: "Período inválido.",
    }),
});

const noteInput = z.object({
  businessId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  nextStep: z.string().max(500).optional(),
});

const commercialInput = z.object({
  businessId: z.string().uuid(),
  leadSource: z.string().max(120).optional(),
  salesOwner: z.string().max(120).optional(),
  commercialNotes: z.string().max(4000).optional(),
});

/** Login phone changes must update Auth and the owner's profile as well as the business. */
export const updateBusinessContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        field: z.enum(["phone", "name", "responsavel"]),
        value: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertSuperAdmin(context);
    const { data: business, error } = await admin
      .from("businesses")
      .select("id, owner_id, phone, name")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error || !business) throw new Error("Estabelecimento não encontrado.");
    const value = data.field === "phone" ? data.value.replace(/\D/g, "") : data.value;
    if (data.field === "phone" && !/^\d{10,11}$/.test(value))
      throw new Error("Informe telefone com DDD, de 10 ou 11 dígitos.");
    const { data: event, error: auditError } = await admin
      .from("master_business_events")
      .insert({
        business_id: business.id,
        actor_id: context.userId,
        type: "edicao_ficha",
        title: "Edição da ficha solicitada",
        description: `Campo: ${data.field}. Alteração pendente.`,
      })
      .select("id")
      .single();
    if (auditError || !event) throw new Error("Não foi possível registrar a auditoria da edição.");

    let operationError: string | null = null;
    if (data.field === "phone") {
      if (!business.owner_id) throw new Error("Dono não encontrado.");
      const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(
        business.owner_id,
      );
      if (ownerError || !owner.user?.email)
        throw new Error("Não foi possível consultar o login do dono.");
      const oldEmail = owner.user.email;
      const email = `${value}@agenda.local`;
      const { error: authError } = await admin.auth.admin.updateUserById(business.owner_id, {
        email,
        email_confirm: true,
      });
      if (authError) throw new Error("Telefone já utilizado ou login não pôde ser atualizado.");
      const { error: profileError } = await admin
        .from("profiles")
        .update({ email })
        .eq("id", business.owner_id)
        .select("id")
        .single();
      const { error: businessError } = profileError
        ? { error: profileError }
        : await admin
            .from("businesses")
            .update({ phone: value })
            .eq("id", business.id)
            .select("id")
            .single();
      if (profileError || businessError) {
        const { error: rollbackAuth } = await admin.auth.admin.updateUserById(business.owner_id, {
          email: oldEmail,
          email_confirm: true,
        });
        const { error: rollbackProfile } = await admin
          .from("profiles")
          .update({ email: oldEmail })
          .eq("id", business.owner_id);
        operationError =
          rollbackAuth || rollbackProfile
            ? "Edição incompleta: confira o login e o perfil do dono antes de tentar novamente."
            : "Não foi possível salvar o telefone. O login anterior foi preservado.";
      }
    } else if (data.field === "responsavel") {
      if (!business.owner_id) throw new Error("Dono não encontrado.");
      const { error: updateError } = await admin
        .from("profiles")
        .update({ full_name: value })
        .eq("id", business.owner_id)
        .select("id")
        .single();
      if (updateError) operationError = "Não foi possível salvar o responsável.";
    } else {
      const { error: updateError } = await admin
        .from("businesses")
        .update({ name: value })
        .eq("id", business.id)
        .select("id")
        .single();
      if (updateError) operationError = "Não foi possível salvar o nome.";
    }
    const { error: resultError } = await admin
      .from("master_business_events")
      .update({
        title: operationError ? "Edição da ficha não concluída" : "Ficha editada pelo Master",
        description: `Campo: ${data.field}. ${operationError ?? "Alteração concluída."}`,
      })
      .eq("id", event.id);
    if (operationError) throw new Error(operationError);
    if (resultError)
      throw new Error("Dados salvos; não foi possível confirmar o resultado na auditoria.");
    return { ok: true as const };
  });

type TimelineEvent = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  at: string;
  source: string;
};

/**
 * Erro de esquema do Postgres: tabela (42P01) ou coluna (42703) inexistente.
 * Usado para avisar que a migration da ficha ainda não foi aplicada.
 */
function isMissingSchemaError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist|not found in the schema cache/i.test(error.message ?? "")
  );
}

/** Mensagem amigável quando a migration da ficha ainda não foi aplicada. */
function migrationPendingMessage(error: { code?: string; message?: string }) {
  if (isMissingSchemaError(error)) {
    return "A base ainda não recebeu a migration da ficha de inteligência (20261023120000). Aplique a migration no Supabase para habilitar esta área.";
  }
  return error.message ?? "Não foi possível concluir a operação.";
}

function daysBetween(from: string, to: Date) {
  const diff = to.getTime() - Date.parse(from);
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.floor(diff / 86_400_000));
}

/**
 * Grava um evento de auditoria da ficha do estabelecimento.
 * Falhas de auditoria não derrubam a ação principal — o log é acessório.
 */
async function recordEvent(
  supabaseAdmin: Awaited<ReturnType<typeof assertSuperAdmin>>,
  input: {
    businessId: string;
    actorId: string;
    type: string;
    title: string;
    description?: string | null;
  },
) {
  try {
    await supabaseAdmin.from("master_business_events").insert({
      business_id: input.businessId,
      actor_id: input.actorId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
    });
  } catch (error) {
    console.error("Falha ao registrar evento de auditoria:", error);
  }
}

/**
 * Ficha completa do estabelecimento para o Painel 3 Master.
 *
 * Todos os números vêm de dados reais do banco; nada é simulado. As regras de
 * cálculo ficam em `src/lib/master/business-intelligence.ts` (puro e testado).
 */
export const getBusinessDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => dossierInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const now = new Date();
    const periodDays = data.periodDays;

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .eq("id", data.businessId)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) throw new Error("Estabelecimento não encontrado.");

    // As tabelas `master_business_notes`/`master_business_events` entram com a
    // migration 20261023120000. Enquanto ela não for aplicada no ambiente, a
    // ficha continua abrindo (observações e auditoria ficam vazias) em vez de
    // quebrar a tela inteira.
    const [notesRes, eventsRes] = await Promise.all([
      supabaseAdmin
        .from("master_business_notes")
        .select("id, body, next_step, author_id, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(50)
        .then(
          (result) => result,
          () => ({ data: [], error: null }) as { data: unknown[]; error: null },
        ),
      supabaseAdmin
        .from("master_business_events")
        .select("id, type, title, description, actor_id, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(100)
        .then(
          (result) => result,
          () => ({ data: [], error: null }) as { data: unknown[]; error: null },
        ),
    ]);

    const [
      ownerRes,
      appointmentsRes,
      customersRes,
      servicesRes,
      professionalsRes,
      hoursRes,
      paymentsRes,
      depositsRes,
      walletRes,
      pixRes,
      ledgerRes,
      whatsappRes,
      reminderRes,
      visualRes,
    ] = await Promise.all([
      business.owner_id
        ? supabaseAdmin
            .from("profiles")
            .select("id, full_name, email, created_at")
            .eq("id", business.owner_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("appointments")
        .select(
          "id, status, starts_at, created_at, service_id, professional_id, customer_id, customer_name, customer_phone",
        )
        .eq("business_id", business.id)
        .order("starts_at", { ascending: false })
        .limit(20000),
      supabaseAdmin
        .from("customers")
        .select("id, name, phone, created_at")
        .eq("business_id", business.id)
        .limit(20000),
      supabaseAdmin
        .from("services")
        .select("id, name, price_cents, active, created_at")
        .eq("business_id", business.id),
      supabaseAdmin
        .from("professionals")
        .select("id, name, active, user_id, created_at")
        .eq("business_id", business.id),
      supabaseAdmin
        .from("business_hours")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id),
      supabaseAdmin
        .from("subscription_payments")
        .select("reference_month, status, amount_cents, paid_at, created_at")
        .eq("business_id", business.id)
        .order("reference_month", { ascending: false }),
      supabaseAdmin
        .from("deposit_payments")
        .select(
          "id, status, amount_cents, net_amount_cents, gateway_fee_cents, platform_commission_cents, created_at, paid_at",
        )
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabaseAdmin
        .from("wallets")
        .select("available_cents, pending_cents, locked_cents")
        .eq("business_id", business.id)
        .maybeSingle(),
      supabaseAdmin
        .from("pix_key_approvals")
        .select("id, key_type, key, status, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("ledger_entries")
        .select("id, type, amount_cents, description, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("business_whatsapp_credentials")
        .select("business_id")
        .eq("business_id", business.id)
        .limit(1),
      supabaseAdmin
        .from("reminder_logs")
        .select("created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("business_visual_settings")
        .select("business_id, updated_at")
        .eq("business_id", business.id)
        .maybeSingle(),
    ]);

    for (const [label, result] of [
      ["proprietário", ownerRes],
      ["agendamentos", appointmentsRes],
      ["clientes", customersRes],
      ["serviços", servicesRes],
      ["profissionais", professionalsRes],
      ["horários", hoursRes],
      ["cobranças", paymentsRes],
      ["sinais pix", depositsRes],
      ["carteira", walletRes],
      ["chave pix", pixRes],
      ["extrato", ledgerRes],
      ["whatsapp", whatsappRes],
      ["lembretes", reminderRes],
      ["observações", notesRes],
      ["eventos", eventsRes],
      ["aparência", visualRes],
    ] as const) {
      if (result.error) throw new Error(`Falha ao carregar ${label}: ${result.error.message}`);
    }

    // Último acesso real do dono: o auth.users só é acessível com service role.
    let lastAccessAt: string | null = null;
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(business.owner_id);
      lastAccessAt = authUser?.user?.last_sign_in_at ?? null;
    } catch {
      lastAccessAt = null;
    }

    const appointments = (appointmentsRes.data ?? []) as MasterAppointmentRow[];
    const customers = (customersRes.data ?? []) as MasterCustomerRow[];
    const services = (servicesRes.data ?? []) as MasterServiceRow[];
    const professionals = (professionalsRes.data ?? []) as MasterProfessionalRow[];
    const payments = (paymentsRes.data ?? []) as MasterPaymentRow[];
    const deposits = (depositsRes.data ?? []) as MasterDepositRow[];

    const usage = summarizeUsage(appointments, services, professionals, { now, periodDays });
    const clients = summarizeClients(customers, appointments, { now, periodDays });
    const trial = trialInfo(business);
    const subscription = summarizeSubscription({
      monthlyFeeCents: business.monthly_fee_cents ?? 0,
      payments,
      startedAt: business.created_at,
      now,
      isTrial: !!trial,
    });
    const depositsSummary = summarizeDeposits(deposits);
    const setup = summarizeSetup({
      hasBasicData: !!business.name && !!business.category && !!business.phone,
      servicesCount: services.length,
      professionalsCount: professionals.length,
      hasBusinessHours: (hoursRes.count ?? 0) > 0,
      hasPublicLink: !!business.slug,
      usesReminders: !!business.reminder_enabled,
      usesWhatsapp: (whatsappRes.data ?? []).length > 0,
      usesPix: depositsSummary.total > 0,
      hasReceivedAppointments: usage.total > 0 || usage.completedAllTime > 0,
    });

    const daysSinceLastAccess = lastAccessAt ? daysBetween(lastAccessAt, now) : null;
    const daysSinceLastAppointment = usage.lastAppointmentAt
      ? daysBetween(usage.lastAppointmentAt, now)
      : null;
    const daysSinceSignup = daysBetween(business.created_at, now) ?? 0;

    const health: HealthEvaluation = evaluateAccountHealth({
      hasUsageData: appointments.length > 0 || customers.length > 0 || payments.length > 0,
      daysSinceLastAccess,
      daysSinceLastAppointment,
      periodAppointments: usage.usageCount,
      previousPeriodAppointments: usage.previousTotal,
      daysSinceSignup,
      setupPercent: setup.percent,
      paymentStatus: subscription.currentStatus,
      trialDaysRemaining: trial ? trial.remaining : null,
    });

    // Linha do tempo: eventos reais agregados das fontes existentes.
    const timeline: TimelineEvent[] = [];
    timeline.push({
      id: `signup-${business.id}`,
      type: "cadastro",
      title: "Estabelecimento cadastrado",
      description: business.name,
      at: business.created_at,
      source: "businesses",
    });
    if (business.trial_created_at) {
      timeline.push({
        id: `trial-${business.id}`,
        type: "cadastro",
        title: "Início do período de teste",
        description: business.trial_days ? `${business.trial_days} dias de teste` : null,
        at: business.trial_created_at,
        source: "businesses",
      });
    }
    const firstAppointment = appointments.length
      ? [...appointments].sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
      : null;
    if (firstAppointment) {
      timeline.push({
        id: `first-appt-${firstAppointment.id}`,
        type: "cadastro",
        title: "Primeiro agendamento recebido",
        description: firstAppointment.customer_name,
        at: firstAppointment.created_at,
        source: "appointments",
      });
    }
    for (const payment of payments.slice(0, 12)) {
      timeline.push({
        id: `sub-${payment.reference_month}-${payment.status}`,
        type: payment.status === "pago" ? "pagamento" : "assinatura",
        title:
          payment.status === "pago"
            ? `Pagamento confirmado — ${payment.reference_month.slice(0, 7)}`
            : `Cobrança em aberto — ${payment.reference_month.slice(0, 7)}`,
        description: null,
        at: payment.paid_at ?? payment.created_at,
        source: "subscription_payments",
      });
    }
    for (const deposit of deposits.filter((row) => row.paid_at).slice(0, 10)) {
      timeline.push({
        id: `deposit-${deposit.id}`,
        type: "pagamento",
        title: "Sinal Pix recebido",
        description: null,
        at: deposit.paid_at ?? deposit.created_at,
        source: "deposit_payments",
      });
    }
    const notesRows = (notesRes.data ?? []) as Array<{
      id: string;
      body: string;
      next_step: string | null;
      author_id: string | null;
      created_at: string;
    }>;
    const eventRows = (eventsRes.data ?? []) as Array<{
      id: string;
      type: string;
      title: string;
      description: string | null;
      actor_id: string | null;
      created_at: string;
    }>;
    for (const note of notesRows) {
      timeline.push({
        id: `note-${note.id}`,
        type: "observacao",
        title: "Observação interna",
        description: note.body,
        at: note.created_at,
        source: "master_business_notes",
      });
    }
    for (const event of eventRows) {
      timeline.push({
        id: `event-${event.id}`,
        type: event.type,
        title: event.title,
        description: event.description,
        at: event.created_at,
        source: "master_business_events",
      });
    }
    timeline.sort((a, b) => b.at.localeCompare(a.at));

    const gmvCents = appointments
      .filter((appointment) => appointment.status !== "cancelado")
      .reduce((sum, appointment) => {
        const service = services.find((item) => item.id === appointment.service_id);
        return sum + (service?.price_cents ?? 0);
      }, 0);

    const gmvMonthCents = appointments
      .filter(
        (appointment) =>
          appointment.status !== "cancelado" &&
          appointment.starts_at.slice(0, 7) === now.toISOString().slice(0, 7),
      )
      .reduce((sum, appointment) => {
        const service = services.find((item) => item.id === appointment.service_id);
        return sum + (service?.price_cents ?? 0);
      }, 0);

    return {
      generatedAt: now.toISOString(),
      periodDays,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        category: business.category,
        phone: business.phone,
        address: business.address,
        status: business.status,
        createdAt: business.created_at,
        updatedAt: business.updated_at,
        monthlyFeeCents: business.monthly_fee_cents ?? 0,
        leadSource: business.lead_source ?? null,
        salesOwner: business.sales_owner ?? null,
        commercialNotes: business.commercial_notes ?? null,
        trial: business.trial_days
          ? {
              days: business.trial_days,
              remaining: trial?.remaining ?? 0,
              startedAt: business.trial_created_at,
            }
          : null,
      },
      owner: ownerRes.data
        ? {
            id: ownerRes.data.id,
            fullName: ownerRes.data.full_name,
            email: ownerRes.data.email,
            createdAt: ownerRes.data.created_at,
            lastAccessAt,
            daysSinceLastAccess,
          }
        : null,
      usage,
      clients,
      subscription,
      deposits: depositsSummary,
      setup,
      health,
      wallet: {
        availableCents: walletRes.data?.available_cents ?? 0,
        pendingCents: walletRes.data?.pending_cents ?? 0,
        lockedCents: walletRes.data?.locked_cents ?? 0,
      },
      pixApproval: pixRes.data?.[0] ?? null,
      agpayAccessBlocked: business.agpay_access_blocked === true,
      agpayWithdrawalBlocked: business.agpay_withdrawal_blocked === true,
      ledger: (ledgerRes.data ?? []).map((entry) => ({
        id: entry.id,
        type: entry.type,
        amountCents: entry.amount_cents,
        description: entry.description ?? "",
        date: entry.created_at,
      })),
      whatsappConnected: (whatsappRes.data ?? []).length > 0,
      lastReminderAt: reminderRes.data?.[0]?.created_at ?? null,
      appearanceUpdatedAt: visualRes.data?.updated_at ?? null,
      gmvCents,
      counts: {
        services: services.length,
        professionals: professionals.length,
        customers: customers.length,
        appointments: appointments.length,
      },
      gmvMonthCents,
      notes: notesRows.map((note) => ({
        id: note.id,
        body: note.body,
        nextStep: note.next_step,
        authorId: note.author_id,
        createdAt: note.created_at,
      })),
      timeline: timeline.slice(0, 80),
    };
  });

/** Observação interna do relacionamento (exclusiva do Painel 3). */
export const addBusinessNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => noteInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin.from("master_business_notes").insert({
      business_id: data.businessId,
      author_id: context.userId,
      body: data.body.trim(),
      next_step: data.nextStep?.trim() || null,
    });
    if (error) throw new Error(migrationPendingMessage(error));
    await recordEvent(supabaseAdmin, {
      businessId: data.businessId,
      actorId: context.userId,
      type: "observacao",
      title: "Observação interna registrada",
      description: data.body.trim().slice(0, 400),
    });
    return { ok: true };
  });

/** Dados comerciais (origem do lead, responsável e observações). */
export const updateBusinessCommercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => commercialInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const patch: {
      lead_source?: string | null;
      sales_owner?: string | null;
      commercial_notes?: string | null;
    } = {};
    if (data.leadSource !== undefined) patch.lead_source = data.leadSource.trim() || null;
    if (data.salesOwner !== undefined) patch.sales_owner = data.salesOwner.trim() || null;
    if (data.commercialNotes !== undefined) {
      patch.commercial_notes = data.commercialNotes.trim() || null;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("businesses")
      .update(patch as never)
      .eq("id", data.businessId);
    if (error) throw new Error(migrationPendingMessage(error));
    await recordEvent(supabaseAdmin, {
      businessId: data.businessId,
      actorId: context.userId,
      type: "comercial",
      title: "Dados comerciais atualizados",
      description: Object.keys(patch).join(", "),
    });
    return { ok: true };
  });

/**
 * Leitura mínima do Painel 2 para o modo suporte do administrador.
 * Não altera a sessão nem a conta do dono: é uma visão somente leitura,
 * auditada no histórico da ficha.
 */
export const getBusinessSupportSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ businessId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug, status, category")
      .eq("id", data.businessId)
      .maybeSingle();
    if (!business) throw new Error("Estabelecimento não encontrado.");
    const now = new Date();
    const { data: upcoming } = await supabaseAdmin
      .from("appointments")
      .select("id, starts_at, status, customer_name, customer_phone")
      .eq("business_id", business.id)
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(10);
    const { count: customerCount } = await supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);
    await recordEvent(supabaseAdmin, {
      businessId: business.id,
      actorId: context.userId,
      type: "suporte",
      title: "Modo suporte consultado",
      description: "Visualização somente leitura do painel do estabelecimento.",
    });
    return {
      business,
      upcomingAppointments: (upcoming ?? []).map((appointment) => ({
        id: appointment.id,
        startsAt: appointment.starts_at,
        status: appointment.status,
        customerName: appointment.customer_name,
      })),
      customerCount: customerCount ?? 0,
    };
  });
