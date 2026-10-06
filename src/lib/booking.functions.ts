import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPanel1Config } from "@/lib/panel1-config.storage";
import { DEFAULT_PANEL1_APPEARANCE, type Panel1Appearance } from "@/lib/panel1-config";
import { isBusinessImagePath } from "@/lib/business-image-path";
import { effectiveDepositCents, type ServiceDepositConfig } from "@/lib/deposit-amount";
import { enforceRateLimit, PUBLIC_RATE_LIMITS } from "@/lib/rate-limit.server";

const slugSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.string().uuid().nullable().optional(),
});

const publicCatalogSchema = z.object({ slug: z.string().min(1) });
const publicProfessionalsSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid(),
});

type Ctx = {
  businessId: string;
  service: {
    id: string;
    name: string;
    duration_minutes: number;
    requires_deposit: boolean;
    deposit_mode: ServiceDepositConfig["deposit_mode"];
    /** Sinal efetivo calculado no servidor (fixo ou percentual), em centavos. */
    depositCents: number;
  };
};

/**
 * T034: `deposit_mode` e `deposit_percent_bps` vêm da migration
 * `*_service_deposit_percent.sql` (T033), ainda não refletida em
 * `src/integrations/supabase/types.ts`. Os selects de `services` que leem essas
 * colunas passam por este cast estreito; removê-lo ao regenerar os tipos a partir
 * do schema migrado em banco isolado.
 */
type ServiceDepositRow = Pick<
  ServiceDepositConfig,
  "requires_deposit" | "deposit_mode" | "deposit_percent_bps" | "price_cents" | "deposit_cents"
>;

const SERVICE_DEPOSIT_COLUMNS =
  "price_cents, deposit_cents, requires_deposit, deposit_mode, deposit_percent_bps";

/** Sinal efetivo do serviço; configuração inválida vira erro público sem detalhes internos. */
function serviceDepositCents(service: ServiceDepositRow & { id: string }): number {
  try {
    return effectiveDepositCents(service);
  } catch (error) {
    console.error("Configuração de sinal inválida", {
      serviceId: service.id,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    throw new Error(
      "Este serviço não está disponível para reserva agora. Tente outro horário ou entre em contato.",
    );
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function timezoneOffsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localAsUtc = Date.UTC(
    Number(values["year"]),
    Number(values["month"]) - 1,
    Number(values["day"]),
    Number(values["hour"]),
    Number(values["minute"]),
    Number(values["second"]),
  );
  return (localAsUtc - instant.getTime()) / 60_000;
}

function weekdayInTimezone(date: string, timezone: string): number {
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

export function toIso(date: string, time: string, timezone = "America/Sao_Paulo") {
  const localAsUtc = new Date(`${date}T${time}:00Z`);
  const offset = timezoneOffsetMinutes(localAsUtc, timezone);
  return new Date(localAsUtc.getTime() - offset * 60_000).toISOString();
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
  // Pior caso: só 1 dos 7 dias da semana está aberto — precisa de até target*7 dias pra achar `target` ocorrências.
  const iterationLimit = Math.min(400, params.target * 7 + 7);
  const days: { date: string; weekday: number }[] = [];
  for (let i = 0; i < iterationLimit && days.length < params.target; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const date = d.toLocaleDateString("en-CA", { timeZone: params.timezone });
    const weekdayIndex = weekdayInTimezone(date, params.timezone);
    if (params.openWeekdays.has(weekdayIndex)) days.push({ date, weekday: weekdayIndex });
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

async function signedPublicAssetUrl(
  path: string | null,
  businessId: string,
  kind: "logo" | "service" | "background",
) {
  if (!path || !isBusinessImagePath(path, businessId, kind)) return null;
  const supabase = await admin();
  const { data, error } = await supabase.storage
    .from("business-logos")
    .createSignedUrl(path, 60 * 60 * 24);
  return error ? null : (data?.signedUrl ?? null);
}

/** Dados públicos iniciais do agendamento, sem enviar o SDK do Supabase ao navegador. */
export const getPublicBookingCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicCatalogSchema.parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.catalog);
    const supabase = await admin();
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(
        "id, name, category, phone, address, status, brand_primary, brand_background, brand_background_image, logo_url",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) return { business: null, services: [] };

    const { data: serviceRows, error: servicesError } = await supabase
      .from("services")
      .select(
        `id, name, duration_minutes, description, image_path, show_price, show_duration, ${SERVICE_DEPOSIT_COLUMNS}`,
      )
      .eq("business_id", business.id)
      .eq("active", true)
      .eq("show_service", true)
      .order("name");
    if (servicesError) throw new Error(servicesError.message);
    const services = (serviceRows ?? []) as unknown as Array<
      ServiceDepositRow & {
        id: string;
        name: string;
        duration_minutes: number;
        description: string | null;
        image_path: string | null;
        show_price: boolean;
        show_duration: boolean;
      }
    >;

    // Serviço com sinal mal configurado fica fora do catálogo em vez de derrubar a página.
    const priced = services.flatMap((service) => {
      try {
        return [{ service, depositCents: serviceDepositCents(service) }];
      } catch {
        return [];
      }
    });

    const [logoUrl, backgroundImageUrl, publicServices, config] = await Promise.all([
      signedPublicAssetUrl(business.logo_url, business.id, "logo"),
      signedPublicAssetUrl(business.brand_background_image, business.id, "background"),
      Promise.all(
        priced.map(async ({ service, depositCents }) => {
          const { deposit_cents: _storedDeposit, ...publicService } = service;
          return {
            ...publicService,
            effectiveDepositCents: depositCents,
            // Compatibilidade até T038: a tela pública ainda lê `deposit_cents`; aqui ele
            // já é o valor efetivo calculado no servidor, nunca a sombra gravada.
            deposit_cents: depositCents,
            image_url: await signedPublicAssetUrl(service.image_path, business.id, "service"),
          };
        }),
      ),
      loadPanel1Config(supabase, business.id),
    ]);

    const { logo_url: _logoPath, brand_background_image: _bgPath, ...publicBusiness } = business;
    return {
      business: {
        ...publicBusiness,
        logo_url: logoUrl,
        brand_background_image: backgroundImageUrl,
      },
      services: publicServices,
      appearance: config.appearance ?? DEFAULT_PANEL1_APPEARANCE,
      preferences: config.preferences,
      visual: config.visual,
    };
  });

/** Profissionais públicos vinculados ao serviço selecionado. */
export const getPublicBookingProfessionals = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicProfessionalsSchema.parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.professionals);
    const supabase = await admin();
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, business_id, businesses!inner(slug)")
      .eq("id", data.serviceId)
      .eq("businesses.slug", data.slug)
      .eq("active", true)
      .eq("show_service", true)
      .maybeSingle();
    if (serviceError) throw new Error(serviceError.message);
    if (!service) return [];

    const { data: linked, error: linkedError } = await supabase
      .from("service_professionals")
      .select("professional_id")
      .eq("service_id", service.id);
    if (linkedError) throw new Error(linkedError.message);
    if (!linked?.length) return [];

    const { data: professionals, error: professionalsError } = await supabase
      .from("professionals")
      .select("id,name,role")
      .in(
        "id",
        linked.map((item) => item.professional_id),
      )
      .eq("business_id", service.business_id)
      .eq("active", true)
      .order("name");
    if (professionalsError) throw new Error(professionalsError.message);
    return professionals ?? [];
  });

/**
 * Extraída de getAvailability pra ser testável sem banco — ver booking.functions.test.ts.
 * nowMin: minuto atual do dia se `date` for hoje, ou -1 se for um dia futuro (sem corte).
 */
export function computeSlots(params: {
  hours: { starts_at: string; ends_at: string }[];
  busy: [number, number][];
  durationMinutes: number;
  nowMin: number;
  listingIntervalMinutes?: number;
}): string[] {
  const slots: string[] = [];
  const interval = params.listingIntervalMinutes ?? 30;
  for (const h of params.hours) {
    const from = minutesOf(h.starts_at.slice(0, 5));
    const to = minutesOf(h.ends_at.slice(0, 5));
    for (let t = from; t + params.durationMinutes <= to; t += interval) {
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
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) throw new Error("Negócio não encontrado.");
  if (business.status === "suspenso")
    throw new Error("Os agendamentos deste estabelecimento estão temporariamente indisponíveis.");
  const { data: serviceRow } = await db
    .from("services")
    .select(`id, name, duration_minutes, ${SERVICE_DEPOSIT_COLUMNS}`)
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .eq("active", true)
    .maybeSingle();
  const service = serviceRow as unknown as
    (ServiceDepositRow & { id: string; name: string; duration_minutes: number }) | null;
  if (!service) throw new Error("Serviço não encontrado.");
  return {
    businessId: business.id,
    service: {
      id: service.id,
      name: service.name,
      duration_minutes: service.duration_minutes,
      requires_deposit: service.requires_deposit,
      deposit_mode: service.deposit_mode,
      depositCents: serviceDepositCents(service),
    },
  };
}

/** Preferências do Panel1Config; defaults quando o estabelecimento nunca salvou config própria. */
async function loadPreferences(businessId: string) {
  const db = await admin();
  const config = await loadPanel1Config(db, businessId);
  return config.preferences;
}

type PublicAppointment = {
  id: string;
  public_code: string;
  business_id: string;
  service_id: string | null;
  professional_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
};

async function findAppointmentsByPublicCodes(
  db: Awaited<ReturnType<typeof admin>>,
  publicCodes: string[],
): Promise<PublicAppointment[]> {
  // Tipo temporário: appointments.public_code aguarda regeneração após a migration T104.
  const table = db.from("appointments") as unknown as {
    select(columns: string): {
      in(
        column: string,
        values: string[],
      ): PromiseLike<{ data: PublicAppointment[] | null; error: { message: string } | null }>;
    };
  };
  const { data, error } = await table
    .select(
      "id, public_code, business_id, service_id, professional_id, customer_name, customer_phone, starts_at, ends_at, status",
    )
    .in("public_code", publicCodes);
  if (error) throw new Error("Não foi possível consultar o agendamento.");
  return data ?? [];
}

async function findAppointmentByPublicCode(
  db: Awaited<ReturnType<typeof admin>>,
  publicCode: string,
) {
  return (await findAppointmentsByPublicCodes(db, [publicCode]))[0] ?? null;
}

function hasNoticeElapsed(startsAt: string, noticeMinutes: number, now = Date.now()) {
  return Date.parse(startsAt) - now >= noticeMinutes * 60_000;
}

const publicCodeInput = z.object({ publicCode: z.string().uuid() });

export const cancelAppointmentPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicCodeInput.parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.cancel);
    const db = await admin();
    const appointment = await findAppointmentByPublicCode(db, data.publicCode);
    if (!appointment) throw new Error("Agendamento não encontrado.");
    if (appointment.status === "cancelado") return { ok: true, status: "cancelado" as const };

    const preferences = await loadPreferences(appointment.business_id);
    if (!preferences.cancellations_enabled)
      throw new Error("O cancelamento não está disponível para este agendamento.");
    if (!hasNoticeElapsed(appointment.starts_at, preferences.cancellation_notice_minutes))
      throw new Error("O prazo para cancelar este agendamento terminou.");
    if (appointment.status !== "agendado")
      throw new Error("Este agendamento não pode ser cancelado agora.");

    const { data: updated, error } = await db
      .from("appointments")
      .update({ status: "cancelado" })
      .eq("id", appointment.id)
      .eq("status", "agendado")
      .select("id")
      .maybeSingle();
    if (error) throw new Error("Não foi possível cancelar o agendamento.");
    if (!updated) {
      const current = await findAppointmentByPublicCode(db, data.publicCode);
      if (current?.status === "cancelado") return { ok: true, status: "cancelado" as const };
      throw new Error("O agendamento mudou. Atualize o histórico e tente novamente.");
    }
    return { ok: true, status: "cancelado" as const };
  });

export const rescheduleAppointmentPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    publicCodeInput
      .extend({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.reschedule);
    const db = await admin();
    const appointment = await findAppointmentByPublicCode(db, data.publicCode);
    if (!appointment) throw new Error("Agendamento não encontrado.");
    const preferences = await loadPreferences(appointment.business_id);
    if (!preferences.reschedule_enabled)
      throw new Error("A remarcação não está disponível para este agendamento.");
    if (appointment.status !== "agendado" || !appointment.service_id)
      throw new Error("Este agendamento não pode ser remarcado agora.");

    const startsAt = toIso(data.date, data.time, preferences.timezone);
    if (startsAt === appointment.starts_at) return { ok: true, startsAt };
    if (!hasNoticeElapsed(appointment.starts_at, preferences.reschedule_notice_minutes))
      throw new Error("O prazo para remarcar este agendamento terminou.");

    const { data: business, error: businessError } = await db
      .from("businesses")
      .select("slug")
      .eq("id", appointment.business_id)
      .maybeSingle();
    if (businessError || !business) throw new Error("Não foi possível consultar o negócio.");
    const availability = await getAvailability({
      data: {
        slug: business.slug,
        serviceId: appointment.service_id,
        date: data.date,
        professionalId: appointment.professional_id,
      },
    });
    if (!availability.slots.includes(data.time))
      throw new Error("Esse horário não está mais disponível. Escolha outro.");

    const { data: service, error: serviceError } = await db
      .from("services")
      .select("duration_minutes")
      .eq("id", appointment.service_id)
      .eq("business_id", appointment.business_id)
      .maybeSingle();
    if (serviceError || !service) throw new Error("Não foi possível consultar o serviço.");
    const endsAt = new Date(Date.parse(startsAt) + service.duration_minutes * 60_000).toISOString();
    const { data: updated, error } = await db
      .from("appointments")
      .update({ starts_at: startsAt, ends_at: endsAt })
      .eq("id", appointment.id)
      .eq("status", "agendado")
      .select("id")
      .maybeSingle();
    if (error || !updated)
      throw new Error("Não foi possível remarcar. Atualize o histórico e tente novamente.");
    return { ok: true, startsAt };
  });

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

/**
 * Núcleo de disponibilidade de uma data: expediente do negócio, dias de trabalho
 * do profissional, bloqueios, agendamentos existentes e antecedência mínima.
 *
 * Antes isto só existia dentro de `getAvailability`, ou seja, as regras valiam
 * apenas na UI — `reserveBooking` aceitava reserva fora do expediente, em dia
 * bloqueado e em data passada, porque chamava o endpoint público direto. As duas
 * functions usam esta função para que a regra viva no servidor.
 */
async function computeAvailableSlots(params: {
  businessId: string;
  durationMinutes: number;
  date: string;
  timezone: string;
  minimumNoticeHours: number;
  listingIntervalMinutes: number;
  professionalId?: string | null | undefined;
  /** `working_days` do profissional; null quando o serviço não tem profissionais vinculados. */
  workingDays?: number[] | null | undefined;
}): Promise<string[]> {
  const db = await admin();
  const weekday = weekdayInTimezone(params.date, params.timezone);
  if (params.workingDays && !params.workingDays.includes(weekday)) return [];

  const { data: hours } = await db
    .from("business_hours")
    .select("starts_at, ends_at")
    .eq("business_id", params.businessId)
    .eq("weekday", weekday);
  if (!hours?.length) return [];

  const { data: blocks } = await db
    .from("time_blocks")
    .select("starts_at, ends_at, recurring, weekday, block_date, professional_id")
    .eq("business_id", params.businessId);

  const dayStart = toIso(params.date, "00:00", params.timezone);
  const dayEnd = toIso(params.date, "23:59", params.timezone);
  const { data: appts } = await db
    .from("appointments")
    .select("starts_at, ends_at, status, professional_id")
    .eq("business_id", params.businessId)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  const busy: [number, number][] = [];
  for (const b of blocks ?? []) {
    const matches = b.recurring ? b.weekday === weekday : b.block_date === params.date;
    const sameProf = !b.professional_id || b.professional_id === params.professionalId;
    if (matches && sameProf)
      busy.push([minutesOf(b.starts_at.slice(0, 5)), minutesOf(b.ends_at.slice(0, 5))]);
  }
  for (const a of appts ?? []) {
    if (a.status === "cancelado" || a.status === "aguardando_sinal") continue;
    if (params.professionalId && a.professional_id && a.professional_id !== params.professionalId)
      continue;
    const off = (d: Date) =>
      Number(
        d
          .toLocaleTimeString("pt-BR", {
            timeZone: params.timezone,
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
            timeZone: params.timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .slice(3, 5),
      );
    busy.push([off(new Date(a.starts_at)), off(new Date(a.ends_at))]);
  }

  const nowMin = computeNowMin(params.date, params.timezone, params.minimumNoticeHours);

  return computeSlots({
    hours,
    busy,
    durationMinutes: params.durationMinutes,
    nowMin,
    listingIntervalMinutes: params.listingIntervalMinutes,
  });
}

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.availability);
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    const preferences = await loadPreferences(businessId);
    const professional = await validateProfessional(businessId, service.id, data.professionalId);
    const slots = await computeAvailableSlots({
      businessId,
      durationMinutes: service.duration_minutes,
      date: data.date,
      timezone: preferences.timezone,
      minimumNoticeHours: preferences.minimum_notice_hours,
      listingIntervalMinutes: preferences.listing_time_minutes,
      professionalId: data.professionalId,
      workingDays: professional?.working_days ?? null,
    });
    return { slots, depositCents: service.depositCents };
  });

export const getOpenDays = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.openDays);
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
        customerEmail: z.string().trim().email("E-mail inválido").optional(),
        // Opcional: só é exigido quando o sinal efetivo calculado no servidor é positivo.
        customerCpfCnpj: z
          .string()
          .optional()
          .transform((v) => v?.replace(/\D/g, "") || undefined)
          .refine((v) => v === undefined || isValidCpfCnpj(v), "CPF ou CNPJ inválido"),
        notes: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.reserve);
    const db = await admin();
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    const preferences = await loadPreferences(businessId);
    const professional = await validateProfessional(businessId, service.id, data.professionalId);

    // Expediente, bloqueio e antecedência precisam valer no servidor. Esconder o
    // horário na UI não impede ninguém de chamar este endpoint público direto —
    // foi exatamente assim que a auditoria criou reserva às 03:00, em dia
    // bloqueado e em data passada.
    const available = await computeAvailableSlots({
      businessId,
      durationMinutes: service.duration_minutes,
      date: data.date,
      timezone: preferences.timezone,
      minimumNoticeHours: preferences.minimum_notice_hours,
      // Valida a regra, não a grade de exibição: qualquer minuto dentro do
      // expediente e fora dos bloqueios é aceito, mesmo que a tela só ofereça
      // slots de 30 ou 60 em 30/60.
      listingIntervalMinutes: 1,
      professionalId: data.professionalId,
      workingDays: professional?.working_days ?? null,
    });
    if (!available.includes(data.time))
      throw new Error("Esse horário não está mais disponível. Escolha outro.");
    // Snapshot único do sinal: o mesmo valor vai para appointments.deposit_cents,
    // deposit_payments.amount_cents e para a resposta. Sinal efetivo zero (0% ou
    // preço zero no modo percentual) confirma o horário sem cobrança.
    const depositCents = service.depositCents;
    const chargesDeposit = depositCents > 0;
    // O documento do pagador só é solicitado quando há cobrança de sinal.
    const payerDocument = chargesDeposit ? data.customerCpfCnpj : undefined;
    if (chargesDeposit && !payerDocument)
      throw new Error("Informe um CPF ou CNPJ válido para gerar o Pix.");
    const payerEmail = chargesDeposit ? data.customerEmail : undefined;
    if (chargesDeposit && !payerEmail)
      throw new Error("Informe um e-mail válido para gerar o Pix.");

    const startsAt = toIso(data.date, data.time, preferences.timezone);
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

    const publicCode = globalThis.crypto.randomUUID();
    // Tipo temporário: public_code só existe após a migration T104 e os tipos serão regenerados.
    const appointmentRow = {
      business_id: businessId,
      service_id: service.id,
      professional_id: data.professionalId ?? null,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      public_code: publicCode,
      starts_at: startsAt,
      ends_at: endsAt,
      status: chargesDeposit ? "aguardando_sinal" : "agendado",
      deposit_cents: chargesDeposit ? depositCents : 0,
      notes: data.notes ?? null,
    };
    const { data: appointment, error: apptError } = await db
      .from("appointments")
      .insert(appointmentRow as never)
      .select("id")
      .single();
    if (apptError?.code === "23P01")
      throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");
    if (apptError || !appointment) throw new Error(apptError?.message ?? "Falha ao reservar.");

    if (!chargesDeposit) {
      // Sem sinal não há pagamento para confirmar: avisa o cliente já na reserva. Não bloqueia a
      // resposta (a Evolution pode demorar) e nunca derruba a reserva (a função não lança).
      void import("./whatsapp-notify.server").then((m) => m.sendBookingConfirmation(appointment.id));
      return {
        chargeId: null,
        amountCents: 0,
        publicCode,
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
        amount_cents: depositCents,
        status: "pendente",
        payer_name: data.customerName,
        payer_phone: data.customerPhone,
        payer_cpf_cnpj: payerDocument ?? null,
        payer_email: payerEmail ?? null,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (chargeError || !charge) throw new Error(chargeError?.message ?? "Falha ao criar cobrança.");

    return {
      chargeId: charge.id,
      amountCents: depositCents,
      publicCode,
      serviceName: service.name,
      startsAt,
      expiresAt,
    };
  });

type DepositPixResult = {
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
};
type DepositPixClaim = {
  acquired: boolean;
  reason: string;
  claim_token: string | null;
  attempt_state: string | null;
};
const inFlightPix = new Map<string, Promise<DepositPixResult>>();

async function pixExternalStep<T>(
  chargeId: string,
  stage: "payment",
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    console.error("Falha ao gerar Pix", {
      chargeId,
      stage,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    throw new Error("Não foi possível gerar o Pix agora. Tente novamente em instantes.");
  }
}

const DEPOSIT_PIX_COLUMNS =
  "id, business_id, amount_cents, status, payer_name, payer_phone, payer_cpf_cnpj, payer_email, provider_payment_id, qr_code, qr_code_base64, ticket_url, expires_at" as const;

const isChargeExpired = (expiresAt: string | null) => {
  const expiresAtMs = Date.parse(expiresAt ?? "");
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
};

export const generateDepositPix = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.depositPix);
    const running = inFlightPix.get(data.chargeId);
    if (running) return running;
    const attempt = (async (): Promise<DepositPixResult> => {
      const db = await admin();
      const { data: charge, error: chargeError } = await db
        .from("deposit_payments")
        .select(DEPOSIT_PIX_COLUMNS)
        .eq("id", data.chargeId)
        .maybeSingle();
      if (chargeError) throw new Error("Não foi possível consultar a cobrança. Tente novamente.");
      if (!charge) throw new Error("Cobrança não encontrada.");
      if (charge.status !== "pendente") throw new Error("Essa cobrança não está mais ativa.");
      if (isChargeExpired(charge.expires_at)) {
        throw new Error("O prazo desta reserva terminou. Faça um novo agendamento.");
      }
      if (!Number.isInteger(charge.amount_cents) || charge.amount_cents <= 0) {
        throw new Error("Esta reserva não possui sinal a cobrar.");
      }
      if (charge.qr_code?.trim())
        return {
          qrCode: charge.qr_code,
          qrCodeBase64: charge.qr_code_base64,
          ticketUrl: charge.ticket_url,
          expiresAt: charge.expires_at,
        };
      // The RPCs are defined by the pending migration; generated types still
      // reflect the linked database until an isolated migration run is available.
      const pixRpc = db.rpc.bind(db) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { data: claimRows, error: claimError } = await pixRpc("claim_deposit_pix", {
        _charge_id: charge.id,
      });
      if (claimError) throw new Error("Não foi possível iniciar o Pix. Tente novamente.");
      const claim = (claimRows as DepositPixClaim[] | null)?.[0];
      if (!claim?.acquired || !claim.claim_token) {
        throw new Error("O Pix está sendo gerado. Tente novamente em instantes.");
      }
      const claimToken = claim.claim_token;
      let saved = false;
      // Cobrança localizada e gravada com o token: o release marca "criado" e nenhuma
      // tentativa futura fará POST, mesmo que o QR tenha falhado agora.
      let paymentRecorded = Boolean(charge.provider_payment_id);
      let outcome: DepositPixResult | undefined;
      let failure: unknown;
      // O release nunca mascara o erro original. Se o QR já foi gravado com o token,
      // ele é válido mesmo que o claim tenha sido perdido depois.
      const finish = async (): Promise<DepositPixResult> => {
        const released = await Promise.resolve(
          pixRpc("release_deposit_pix", {
            _charge_id: charge.id,
            _claim_token: claimToken,
            _outcome: paymentRecorded
              ? "criado"
              : (failure as { pixAttemptOutcome?: string } | null)?.pixAttemptOutcome ===
                  "rejeitado"
                ? "rejeitado"
                : "falhou",
          }),
        ).catch((error: unknown) => ({ data: null, error: { message: String(error) } }));
        if (released.error || released.data !== true) {
          console.error("Claim Pix não liberado", { chargeId: charge.id, saved });
        }
        if (saved && outcome) return outcome;
        throw failure ?? new Error("Não foi possível gerar o Pix. Tente novamente.");
      };
      try {
        // Relê depois do claim: outra instância pode ter salvo QR ou id, ou a
        // cobrança pode ter sido cancelada/expirada no intervalo.
        const { data: current, error: currentError } = await db
          .from("deposit_payments")
          .select(DEPOSIT_PIX_COLUMNS)
          .eq("id", charge.id)
          .maybeSingle();
        if (currentError)
          throw new Error("Não foi possível consultar a cobrança. Tente novamente.");
        if (!current || current.status !== "pendente") {
          throw new Error("Essa cobrança não está mais ativa.");
        }
        if (isChargeExpired(current.expires_at)) {
          throw new Error("O prazo desta reserva terminou. Faça um novo agendamento.");
        }
        paymentRecorded = Boolean(current.provider_payment_id);
        if (current.qr_code?.trim()) {
          saved = true;
          outcome = {
            qrCode: current.qr_code,
            qrCodeBase64: current.qr_code_base64,
            ticketUrl: current.ticket_url,
            expiresAt: current.expires_at,
          };
          return finish();
        }
        const { createPixCharge } = await import("./agpay.server");
        const payerDocument = current.payer_cpf_cnpj;
        if (!payerDocument) throw new Error("CPF/CNPJ do pagador não informado.");
        const payerEmail = current.payer_email?.trim();
        if (!payerEmail) throw new Error("E-mail do pagador não informado.");
        if (current.provider_payment_id) {
          throw new Error(
            "A cobrança Pix já foi registrada e aguarda conciliação. Tente novamente em instantes.",
          );
        }

        // O AgPay não oferece busca por referência externa. O banco é a única
        // proteção contra POST duplicado e precisa autorizar imediatamente antes.
        const { data: marked, error: markError } = await pixRpc("mark_deposit_pix_post_started", {
          _charge_id: current.id,
          _claim_token: claimToken,
        });
        if (markError || marked !== true) {
          throw new Error("A cobrança anterior ainda está sendo conciliada.");
        }

        const pix = await pixExternalStep(current.id, "payment", () =>
          createPixCharge({
            amountCents: current.amount_cents,
            payerName: current.payer_name ?? "Cliente",
            payerEmail,
            payerCpf: payerDocument,
          }),
        );

        // Persiste o identificador assim que o POST retorna. Se qualquer passo
        // posterior falhar, retries nunca emitem uma segunda cobrança.
        const { data: updatedPayment, error: paymentError } = await db
          .from("deposit_payments")
          .update({
            provider: "agpay",
            provider_payment_id: pix.providerPaymentId,
            provider_status: pix.status,
          })
          .eq("id", current.id)
          .eq("status", "pendente")
          .filter("pix_claim_token", "eq", claimToken)
          .is("provider_payment_id", null)
          .select("id")
          .maybeSingle();
        if (paymentError || !updatedPayment) {
          throw new Error("Não foi possível registrar a cobrança Pix.");
        }
        paymentRecorded = true;

        if (!pix.qrCode?.trim()) {
          throw new Error("O Pix ainda não está disponível. Tente novamente.");
        }
        // A cobrança pode ter sido criada no AgPay depois que a reserva venceu: o id
        // fica gravado para auditoria, mas o QR não é exposto.
        if (isChargeExpired(current.expires_at)) {
          throw new Error("O prazo desta reserva terminou. Faça um novo agendamento.");
        }
        const { data: updatedPix, error: pixUpdateError } = await db
          .from("deposit_payments")
          .update({
            provider: "agpay",
            provider_payment_id: pix.providerPaymentId,
            provider_status: pix.status,
            payer_cpf_cnpj: null,
            qr_code: pix.qrCode,
            qr_code_base64: pix.qrCodeBase64,
            ticket_url: pix.ticketUrl,
          })
          .eq("id", current.id)
          .eq("status", "pendente")
          .gt("expires_at", new Date().toISOString())
          .filter("pix_claim_token", "eq", claimToken)
          .select("id")
          .maybeSingle();
        if (pixUpdateError || !updatedPix) {
          throw new Error("Não foi possível salvar o Pix. Tente novamente.");
        }
        saved = true;
        paymentRecorded = true;
        outcome = {
          qrCode: pix.qrCode,
          qrCodeBase64: pix.qrCodeBase64,
          ticketUrl: pix.ticketUrl,
          expiresAt: current.expires_at,
        };
      } catch (error) {
        failure = error;
      }
      return finish();
    })();
    inFlightPix.set(data.chargeId, attempt);
    try {
      return await attempt;
    } finally {
      if (inFlightPix.get(data.chargeId) === attempt) inFlightPix.delete(data.chargeId);
    }
  });

export const cancelDepositBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.cancelDeposit);
    const { cancelPendingDeposit } = await import("./agpay-events.server");
    const result = await cancelPendingDeposit(data.chargeId);
    if (result.status === "pendente") {
      throw new Error(
        "O Pix desta reserva está sendo gerado. Tente cancelar novamente em instantes.",
      );
    }
    return { ok: true, status: result.status };
  });

export const getMyBookings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        chargeIds: z.array(z.string().uuid()).max(50).default([]),
        publicCodes: z.array(z.string().uuid()).max(50).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.myBookings);
    if (!data.chargeIds.length && !data.publicCodes.length) return { bookings: [] };
    const db = await admin();
    const { data: chargeRows } = data.chargeIds.length
      ? await db
          .from("deposit_payments")
          .select("id, status, amount_cents, payer_name, expires_at, created_at, appointment_id")
          .in("id", data.chargeIds)
          .order("created_at", { ascending: false })
      : { data: [] };
    const chargedAppointmentIds = (chargeRows ?? [])
      .map((charge) => charge.appointment_id)
      .filter(Boolean) as string[];
    const { data: chargedAppointments } = chargedAppointmentIds.length
      ? await db
          .from("appointments")
          .select("id, starts_at, status, service_id, professional_id")
          .in("id", chargedAppointmentIds)
      : { data: [] as never[] };
    const codedAppointments = data.publicCodes.length
      ? await findAppointmentsByPublicCodes(db, data.publicCodes)
      : [];
    const appointments = [
      ...(chargedAppointments ?? []),
      ...codedAppointments.filter((coded) => !chargedAppointmentIds.includes(coded.id)),
    ];
    const appointmentIds = [...new Set(appointments.map((appointment) => appointment.id))];
    const additionalCharges = appointmentIds.length
      ? await db
          .from("deposit_payments")
          .select("id, status, amount_cents, payer_name, expires_at, created_at, appointment_id")
          .in("appointment_id", appointmentIds)
      : { data: [] as never[] };
    const charges = [
      ...(chargeRows ?? []),
      ...(additionalCharges.data ?? []).filter(
        (additional) => !(chargeRows ?? []).some((charge) => charge.id === additional.id),
      ),
    ];
    const serviceIds = [...new Set(appointments.map((a) => a.service_id).filter(Boolean))];
    const { data: servicesRows } = serviceIds.length
      ? await db
          .from("services")
          .select("id, name")
          .in("id", serviceIds as string[])
      : { data: [] as never[] };
    const profIds = [...new Set(appointments.map((a) => a.professional_id).filter(Boolean))];
    const { data: profs } = profIds.length
      ? await db
          .from("professionals")
          .select("id, name")
          .in("id", profIds as string[])
      : { data: [] as never[] };

    const bookings = appointments.map((a) => {
      const c = charges.find((charge) => charge.appointment_id === a.id);
      const s = (servicesRows ?? []).find((x) => x.id === a.service_id);
      const p = (profs ?? []).find((x) => x.id === a.professional_id);
      const codeRow = codedAppointments.find((coded) => coded.id === a.id);
      return {
        chargeId: c?.id ?? null,
        chargeStatus: c?.status ?? "sem_sinal",
        amountCents: c?.amount_cents ?? 0,
        publicCode: codeRow?.public_code ?? null,
        customerName: c?.payer_name ?? codeRow?.customer_name ?? null,
        expiresAt: c?.expires_at ?? null,
        createdAt: c?.created_at ?? a.starts_at,
        startsAt: a.starts_at,
        appointmentStatus: a.status,
        serviceId: a.service_id,
        professionalId: a.professional_id,
        serviceName: s?.name ?? "Serviço",
        professionalName: p?.name ?? "Profissional Agenda",
      };
    });
    return { bookings };
  });

export const getDepositStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.depositStatus);
    const { synchronizeDepositPayment } = await import("./agpay-events.server");
    return synchronizeDepositPayment(data.chargeId);
  });
