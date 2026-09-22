import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPanel1Config } from "@/lib/panel1-config.storage";

const slugSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.string().uuid().nullable().optional(),
});

type Ctx = {
  businessId: string;
  asaasSubaccountStatus: string;
  service: {
    id: string;
    name: string;
    duration_minutes: number;
    deposit_cents: number;
    requires_deposit: boolean;
  };
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Fuso horários oferecidos em Panel1Preferences.timezone (painel.configuracoes.tsx)
 * — todos brasileiros e sem horário de verão, por isso um offset fixo basta.
 */
function offsetForTimezone(timezone: string): string {
  switch (timezone) {
    case "America/Manaus":
    case "America/Cuiaba":
      return "-04:00";
    default:
      return "-03:00";
  }
}

export function toIso(date: string, time: string, timezone = "America/Sao_Paulo") {
  return new Date(`${date}T${time}:00${offsetForTimezone(timezone)}`).toISOString();
}

/**
 * nowMin generalizado pra respeitar Panel1Preferences.minimum_notice_hours: 1440
 * (todo o dia bloqueado) se `date` já está inteiramente dentro da antecedência
 * mínima, -1 se `date` está totalmente livre dela, ou o minuto-do-dia do corte
 * quando o corte cai dentro do próprio `date`.
 */
export function computeNowMin(date: string, timezone: string, minimumNoticeHours: number): number {
  const cutoff = new Date(Date.now() + minimumNoticeHours * 3_600_000);
  const cutoffDate = cutoff.toLocaleDateString("en-CA", { timeZone: timezone });
  if (date < cutoffDate) return 1440;
  if (date > cutoffDate) return -1;
  const cutoffTime = cutoff.toLocaleTimeString("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return minutesOf(cutoffTime);
}

/**
 * Extraída de getOpenDays pra ser testável sem banco — ver booking.functions.test.ts.
 * Respeita Panel1Preferences.list_dates_days (quantidade de dias abertos a listar)
 * e Panel1Preferences.timezone.
 */
export function computeOpenDays(params: {
  openWeekdays: Set<number>;
  timezone: string;
  target: number;
}): { date: string; weekday: number }[] {
  const offset = offsetForTimezone(params.timezone);
  // Pior caso: só 1 dos 7 dias da semana está aberto — precisa de até target*7 dias pra achar `target` ocorrências.
  const iterationLimit = Math.min(400, params.target * 7 + 7);
  const days: { date: string; weekday: number }[] = [];
  for (let i = 0; i < iterationLimit && days.length < params.target; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const date = d.toLocaleDateString("en-CA", { timeZone: params.timezone });
    const weekday = new Date(`${date}T12:00:00${offset}`).getDay();
    if (params.openWeekdays.has(weekday)) days.push({ date, weekday });
  }
  return days;
}

export function minutesOf(t: string) {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

export function hhmm(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function isValidCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (![11, 14].includes(digits.length) || /^(\d)\1+$/.test(digits)) return false;

  const validateDigit = (base: string, weights: number[]) => {
    const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  if (digits.length === 11) {
    const first = validateDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = validateDigit(`${digits.slice(0, 9)}${first}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digits.endsWith(`${first}${second}`);
  }

  const first = validateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = validateDigit(
    `${digits.slice(0, 12)}${first}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return digits.endsWith(`${first}${second}`);
}

/**
 * Extraída de getAvailability pra ser testável sem banco — ver booking.functions.test.ts.
 * nowMin: minuto atual do dia se `date` for hoje, ou -1 se for um dia futuro (sem corte).
 */
export function computeSlots(params: {
  hours: { starts_at: string; ends_at: string }[];
  busy: [number, number][];
  durationMinutes: number;
  nowMin: number;
}): string[] {
  const slots: string[] = [];
  for (const h of params.hours) {
    const from = minutesOf(h.starts_at.slice(0, 5));
    const to = minutesOf(h.ends_at.slice(0, 5));
    for (let t = from; t + params.durationMinutes <= to; t += 30) {
      const end = t + params.durationMinutes;
      if (t <= params.nowMin) continue;
      if (params.busy.some(([bs, be]) => t < be && end > bs)) continue;
      slots.push(hhmm(t));
    }
  }
  return slots;
}

/**
 * Um serviço só cobra sinal se exigir sinal (requires_deposit) E tiver um valor
 * configurado. Serviço com requires_deposit=false nunca cobra, independente do
 * valor deixado em deposit_cents (FR-012, data-model.md).
 */
export function shouldRequireDeposit(service: {
  requires_deposit: boolean;
  deposit_cents: number;
}): boolean {
  return service.requires_deposit && service.deposit_cents > 0;
}

async function loadContext(slug: string, serviceId: string): Promise<Ctx> {
  const db = await admin();
  const { data: business } = await db
    .from("businesses")
    .select("id, status, asaas_subaccount_status")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) throw new Error("Negócio não encontrado.");
  if (business.status === "suspenso")
    throw new Error("Os agendamentos deste estabelecimento estão temporariamente indisponíveis.");
  const { data: service } = await db
    .from("services")
    .select("id, name, duration_minutes, deposit_cents, requires_deposit")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .eq("active", true)
    .maybeSingle();
  if (!service) throw new Error("Serviço não encontrado.");
  return {
    businessId: business.id,
    asaasSubaccountStatus: business.asaas_subaccount_status,
    service,
  };
}

/** Preferências do Panel1Config; defaults quando o estabelecimento nunca salvou config própria. */
async function loadPreferences(businessId: string) {
  const db = await admin();
  const config = await loadPanel1Config(db, businessId);
  return config.preferences;
}

async function validateProfessional(
  businessId: string,
  serviceId: string,
  professionalId?: string | null,
) {
  const db = await admin();
  const { data: links } = await db
    .from("service_professionals")
    .select("professional_id")
    .eq("business_id", businessId)
    .eq("service_id", serviceId);
  if (!links?.length) return null;
  if (!professionalId || !links.some((link) => link.professional_id === professionalId))
    throw new Error("Selecione um profissional disponível.");
  const { data: professional } = await db
    .from("professionals")
    .select("id, name, active, working_days")
    .eq("id", professionalId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!professional?.active) throw new Error("Esse profissional não está disponível.");
  return professional;
}

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    const preferences = await loadPreferences(businessId);
    const weekday = new Date(
      `${data.date}T12:00:00${offsetForTimezone(preferences.timezone)}`,
    ).getDay();
    const professional = await validateProfessional(businessId, service.id, data.professionalId);
    if (professional && !professional.working_days.includes(weekday))
      return { slots: [] as string[], depositCents: service.deposit_cents };

    const { data: hours } = await db
      .from("business_hours")
      .select("starts_at, ends_at")
      .eq("business_id", businessId)
      .eq("weekday", weekday);
    if (!hours?.length) return { slots: [] as string[], depositCents: service.deposit_cents };

    const { data: blocks } = await db
      .from("time_blocks")
      .select("starts_at, ends_at, recurring, weekday, block_date, professional_id")
      .eq("business_id", businessId);

    const dayStart = toIso(data.date, "00:00", preferences.timezone);
    const dayEnd = toIso(data.date, "23:59", preferences.timezone);
    const { data: appts } = await db
      .from("appointments")
      .select("starts_at, ends_at, status, professional_id")
      .eq("business_id", businessId)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);

    const busy: [number, number][] = [];
    for (const b of blocks ?? []) {
      const matches = b.recurring ? b.weekday === weekday : b.block_date === data.date;
      const sameProf = !b.professional_id || b.professional_id === data.professionalId;
      if (matches && sameProf)
        busy.push([minutesOf(b.starts_at.slice(0, 5)), minutesOf(b.ends_at.slice(0, 5))]);
    }
    for (const a of appts ?? []) {
      if (a.status === "cancelado" || a.status === "aguardando_sinal") continue;
      if (data.professionalId && a.professional_id && a.professional_id !== data.professionalId)
        continue;
      const s = new Date(a.starts_at);
      const e = new Date(a.ends_at);
      const off = (d: Date) =>
        Number(
          d
            .toLocaleTimeString("pt-BR", {
              timeZone: preferences.timezone,
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .slice(0, 2),
        ) *
          60 +
        Number(
          d
            .toLocaleTimeString("pt-BR", {
              timeZone: preferences.timezone,
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .slice(3, 5),
        );
      busy.push([off(s), off(e)]);
    }

    const nowMin = computeNowMin(data.date, preferences.timezone, preferences.minimum_notice_hours);

    const slots = computeSlots({ hours, busy, durationMinutes: service.duration_minutes, nowMin });
    return { slots, depositCents: service.deposit_cents };
  });

export const getOpenDays = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: business } = await db
      .from("businesses")
      .select("id, status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!business || business.status === "suspenso")
      return { days: [] as { date: string; weekday: number }[] };
    const preferences = await loadPreferences(business.id);
    const { data: hours } = await db
      .from("business_hours")
      .select("weekday")
      .eq("business_id", business.id);
    const open = new Set((hours ?? []).map((h) => h.weekday));
    const days = computeOpenDays({
      openWeekdays: open,
      timezone: preferences.timezone,
      target: preferences.list_dates_days,
    });
    return { days };
  });

export const reserveBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    slugSchema
      .extend({
        time: z.string().regex(/^\d{2}:\d{2}$/),
        customerName: z.string().min(2).max(80),
        customerPhone: z.string().min(8).max(20),
        customerCpfCnpj: z
          .string()
          .transform((v) => v.replace(/\D/g, ""))
          .refine(isValidCpfCnpj, "CPF ou CNPJ inválido"),
        notes: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { businessId, service, asaasSubaccountStatus } = await loadContext(
      data.slug,
      data.serviceId,
    );
    await validateProfessional(businessId, service.id, data.professionalId);
    const chargesDeposit = shouldRequireDeposit(service);
    if (service.requires_deposit && !chargesDeposit)
      throw new Error("Este serviço ainda não tem valor de sinal configurado.");
    if (chargesDeposit && asaasSubaccountStatus !== "aprovada")
      throw new Error("Este estabelecimento ainda não está habilitado para receber o sinal.");

    const startsAt = toIso(data.date, data.time);
    const endsAt = new Date(
      new Date(startsAt).getTime() + service.duration_minutes * 60_000,
    ).toISOString();

    let clashQuery = db
      .from("appointments")
      .select("id")
      .eq("business_id", businessId)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt)
      .not("status", "in", '("cancelado","aguardando_sinal")');
    if (data.professionalId) clashQuery = clashQuery.eq("professional_id", data.professionalId);
    const { data: clash } = await clashQuery.limit(1);
    if (clash?.length) throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");

    const { data: appointment, error: apptError } = await db
      .from("appointments")
      .insert({
        business_id: businessId,
        service_id: service.id,
        professional_id: data.professionalId ?? null,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        starts_at: startsAt,
        ends_at: endsAt,
        status: chargesDeposit ? "aguardando_sinal" : "agendado",
        deposit_cents: chargesDeposit ? service.deposit_cents : 0,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (apptError?.code === "23P01")
      throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");
    if (apptError || !appointment) throw new Error(apptError?.message ?? "Falha ao reservar.");

    if (!chargesDeposit) {
      return {
        chargeId: null,
        appointmentId: appointment.id,
        amountCents: 0,
        serviceName: service.name,
        startsAt,
        expiresAt: null,
      };
    }

    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const { data: charge, error: chargeError } = await db
      .from("deposit_payments")
      .insert({
        business_id: businessId,
        appointment_id: appointment.id,
        amount_cents: service.deposit_cents,
        status: "pendente",
        payer_name: data.customerName,
        payer_phone: data.customerPhone,
        payer_cpf_cnpj: data.customerCpfCnpj,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (chargeError || !charge) throw new Error(chargeError?.message ?? "Falha ao criar cobrança.");

    return {
      chargeId: charge.id,
      appointmentId: appointment.id,
      amountCents: service.deposit_cents,
      serviceName: service.name,
      startsAt,
      expiresAt,
    };
  });

export const generateDepositPix = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: charge } = await db
      .from("deposit_payments")
      .select(
        "id, business_id, amount_cents, status, payer_name, payer_phone, payer_cpf_cnpj, qr_code, qr_code_base64, ticket_url, expires_at",
      )
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status !== "pendente") throw new Error("Essa cobrança não está mais ativa.");
    if (charge.qr_code)
      return {
        qrCode: charge.qr_code,
        qrCodeBase64: charge.qr_code_base64,
        ticketUrl: charge.ticket_url,
        expiresAt: charge.expires_at,
      };
    if (!charge.payer_cpf_cnpj) throw new Error("CPF/CNPJ do pagador não informado.");

    const { data: business } = await db
      .from("businesses")
      .select("asaas_wallet_id, asaas_subaccount_status, asaas_commission_percent")
      .eq("id", charge.business_id)
      .single();

    if (!business || business.asaas_subaccount_status !== "aprovada") {
      throw new Error("O estabelecimento ainda não está habilitado para receber pelo Asaas.");
    }

    const { getBusinessAsaasAccessToken } = await import("./asaas-events.server");
    const accessToken = await getBusinessAsaasAccessToken(charge.business_id);
    const { getOrCreateCustomer, createPixCharge } = await import("./asaas.server");
    const customerId = await getOrCreateCustomer({
      accessToken,
      name: charge.payer_name ?? "Cliente",
      cpfCnpj: charge.payer_cpf_cnpj,
      ...(charge.payer_phone ? { phone: charge.payer_phone } : {}),
      externalReference: charge.id,
    });

    // Minimização de dados: o documento deixa de ser necessário após o vínculo.
    await db
      .from("deposit_payments")
      .update({ asaas_customer_id: customerId, payer_cpf_cnpj: null })
      .eq("id", charge.id);

    const pix = await createPixCharge({
      accessToken,
      amountCents: charge.amount_cents,
      description: "Sinal do agendamento",
      customerId,
      externalReference: charge.id,
      commissionPercent: Number(business.asaas_commission_percent ?? 0),
    });
    await db
      .from("deposit_payments")
      .update({
        provider: "asaas",
        provider_payment_id: pix.providerPaymentId,
        provider_status: pix.status,
        asaas_customer_id: customerId,
        qr_code: pix.qrCode,
        qr_code_base64: pix.qrCodeBase64,
        ticket_url: pix.ticketUrl,
      })
      .eq("id", charge.id);
    return {
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      expiresAt: charge.expires_at,
    };
  });

export const cancelDepositBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { cancelPendingDeposit } = await import("./asaas-events.server");
    const result = await cancelPendingDeposit(data.chargeId);
    return { ok: true, status: result.status };
  });

export const getMyBookings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ chargeIds: z.array(z.string().uuid()).max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.chargeIds.length) return { bookings: [] };
    const db = await admin();
    const { data: charges } = await db
      .from("deposit_payments")
      .select("id, status, amount_cents, payer_name, expires_at, created_at, appointment_id")
      .in("id", data.chargeIds)
      .order("created_at", { ascending: false });
    const apptIds = (charges ?? []).map((c) => c.appointment_id).filter(Boolean) as string[];
    const { data: appts } = apptIds.length
      ? await db
          .from("appointments")
          .select("id, starts_at, status, service_id, professional_id")
          .in("id", apptIds)
      : { data: [] as never[] };
    const serviceIds = [...new Set((appts ?? []).map((a) => a.service_id).filter(Boolean))];
    const { data: servicesRows } = serviceIds.length
      ? await db
          .from("services")
          .select("id, name")
          .in("id", serviceIds as string[])
      : { data: [] as never[] };
    const profIds = [...new Set((appts ?? []).map((a) => a.professional_id).filter(Boolean))];
    const { data: profs } = profIds.length
      ? await db
          .from("professionals")
          .select("id, name")
          .in("id", profIds as string[])
      : { data: [] as never[] };

    const bookings = (charges ?? []).map((c) => {
      const a = (appts ?? []).find((x) => x.id === c.appointment_id);
      const s = (servicesRows ?? []).find((x) => x.id === a?.service_id);
      const p = (profs ?? []).find((x) => x.id === a?.professional_id);
      return {
        chargeId: c.id,
        chargeStatus: c.status,
        amountCents: c.amount_cents,
        customerName: c.payer_name,
        expiresAt: c.expires_at,
        createdAt: c.created_at,
        startsAt: a?.starts_at ?? null,
        appointmentStatus: a?.status ?? "cancelado",
        serviceName: s?.name ?? "Serviço",
        professionalName: p?.name ?? "Profissional Agenda",
      };
    });
    return { bookings };
  });

export const getDepositStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { synchronizeDepositPayment } = await import("./asaas-events.server");
    return synchronizeDepositPayment(data.chargeId);
  });
