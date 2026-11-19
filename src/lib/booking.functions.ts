import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPanel1Config } from "@/lib/panel1-config.storage";
import { DEFAULT_PANEL1_APPEARANCE, type Panel1Appearance } from "@/lib/panel1-config";
import { isBusinessImagePath } from "@/lib/business-image-path";
import { isProfessionalAvatarPathForBusiness } from "@/lib/professional-avatar-path";
import { effectiveDepositCents, type ServiceDepositConfig } from "@/lib/deposit-amount";
import { enforceRateLimit, PUBLIC_RATE_LIMITS } from "@/lib/rate-limit.server";

function isValidCivilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const civilDateSchema = z.string().refine(isValidCivilDate, "Data civil inválida.");

const slugSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().guid(),
  date: civilDateSchema,
  professionalId: z.string().guid().nullable().optional(),
});

const publicCatalogSchema = z.object({ slug: z.string().min(1) });
const publicProfessionalsSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().guid(),
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
    /** Dias da semana em que o serviço pode ser agendado; null = sem restrição. */
    availableDays: number[] | null;
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
  if (!isValidCivilDate(date)) throw new Error("Data civil inválida.");
  const localAsUtc = new Date(`${date}T${time}:00Z`);
  if (!Number.isFinite(localAsUtc.getTime())) throw new Error("Data ou horário inválido.");

  const expectedLocal = `${date}T${time}:00`;
  const offsets = new Set(
    [-36, 0, 36].map((hours) =>
      timezoneOffsetMinutes(new Date(localAsUtc.getTime() + hours * 60 * 60_000), timezone),
    ),
  );
  const candidates = [...offsets]
    .map((offset) => localAsUtc.getTime() - offset * 60_000)
    .filter((candidate) => localDateTimeKey(new Date(candidate), timezone) === expectedLocal);

  if (candidates.length !== 1)
    throw new Error("Horário local inexistente ou ambíguo neste fuso horário.");
  return new Date(candidates[0]!).toISOString();
}

function localDateTimeKey(instant: Date, timezone: string) {
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
  return `${values["year"]}-${values["month"]}-${values["day"]}T${values["hour"]}:${values["minute"]}:${values["second"]}`;
}

export function filterPossibleLocalTimes(date: string, times: string[], timezone: string) {
  return times.filter((time) => {
    try {
      toIso(date, time, timezone);
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Horário local inexistente ou ambíguo")
      )
        return false;
      throw error;
    }
  });
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

export function isPublicBookingEnabled(business: {
  status: string | null;
  cancelled_at?: string | null;
}) {
  return business.status === "ativo" && !business.cancelled_at;
}

/** Dados públicos iniciais do agendamento, sem enviar o SDK do Supabase ao navegador. */
export const getPublicBookingCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicCatalogSchema.parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.catalog);
    kickDepositSweep();
    const supabase = await admin();
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(
        "id, name, category, phone, address, status, cancelled_at, brand_primary, brand_background, brand_background_image, logo_url",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) return { business: null, services: [] };
    if (!isPublicBookingEnabled(business)) return { business: null, services: [] };

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

    // Categorias ativas + vínculo serviço→categoria para agrupar no painel 1.
    // Leitura defensiva: se a migration ainda não foi aplicada, segue sem
    // agrupar em vez de derrubar a página.
    let categories: Array<{ id: string; name: string; position: number }> = [];
    let categoryLinks: Record<string, string> = {};
    try {
      const { data: catRows, error: catError } = await supabase
        .from("service_categories")
        .select("id, name, position")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("position")
        .order("created_at");
      if (catError) throw catError;
      categories = (catRows ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position ?? 0,
      }));
      const { data: linkRows, error: linkError } = await supabase
        .from("services")
        .select("id, category_id")
        .eq("business_id", business.id)
        .eq("active", true)
        .not("category_id", "is", null);
      if (linkError) throw linkError;
      for (const row of linkRows ?? []) {
        if (row.category_id) categoryLinks[row.id] = row.category_id;
      }
    } catch {
      categories = [];
      categoryLinks = {};
    }

    const [publicServices, config] = await Promise.all([
      Promise.all(
        priced.map(async ({ service, depositCents }) => {
          const { deposit_cents: _storedDeposit, ...publicService } = service;
          return {
            ...publicService,
            category_id: categoryLinks[service.id] ?? null,
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

    // O layout público é sempre o Elegance (só cor e fonte mudam). Se o negócio
    // ainda estava no modelo antigo, aproveita a mídia que ele já tinha enviado.
    const activeMedia =
      config.visual?.layout_media?.elegance ?? config.visual?.layout_media?.classic;
    const logoPath = activeMedia?.logoPath ?? business.logo_url;
    const backgroundPath = activeMedia?.backgroundPath ?? business.brand_background_image;
    const [logoUrl, backgroundImageUrl] = await Promise.all([
      signedPublicAssetUrl(logoPath, business.id, "logo"),
      signedPublicAssetUrl(backgroundPath, business.id, "background"),
    ]);

    const publicPreferences = {
      timezone: config.preferences.timezone,
      cancellations_enabled: config.preferences.cancellations_enabled,
      reschedule_enabled: config.preferences.reschedule_enabled,
    };
    const { logo_url: _logoPath, brand_background_image: _bgPath, ...publicBusiness } = business;
    const rules = await loadDepositRules(supabase, business.id);
    // Desabilitado: nenhum sinal aparece para ninguém, com ou sem login.
    const visibleServices =
      rules.mode === "desabilitado"
        ? publicServices.map((service) => ({
            ...service,
            effectiveDepositCents: 0,
            deposit_cents: 0,
          }))
        : publicServices;
    return {
      business: {
        ...publicBusiness,
        logo_url: logoUrl,
        brand_background_image: backgroundImageUrl,
      },
      services: visibleServices,
      pixMode: rules.mode,
      categories,
      appearance: config.appearance ?? DEFAULT_PANEL1_APPEARANCE,
      preferences: publicPreferences,
      visual: { layout_key: config.visual.layout_key },
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
      .select("id, business_id, businesses!inner(slug, status, cancelled_at)")
      .eq("id", data.serviceId)
      .eq("businesses.slug", data.slug)
      .eq("businesses.status", "ativo")
      .is("businesses.cancelled_at", null)
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
      .select("id,name,public_name,role,avatar_path")
      .in(
        "id",
        linked.map((item) => item.professional_id),
      )
      .eq("business_id", service.business_id)
      .eq("active", true)
      .order("name");
    if (professionalsError) throw new Error(professionalsError.message);

    // Foto de profissional é restrita a membros no bucket; a página pública
    // recebe a URL já assinada pelo servidor (service role), válida por 7 dias.
    // O nome devolvido é o "nome cliente verá" (public_name), com fallback.
    const withPhotos = await Promise.all(
      (professionals ?? []).map(async (professional) => {
        const displayName = professional.public_name || professional.name;
        const base = {
          id: professional.id,
          name: displayName,
          role: professional.role,
        };
        if (
          !professional.avatar_path ||
          !isProfessionalAvatarPathForBusiness(professional.avatar_path, service.business_id)
        ) {
          return { ...base, avatar_url: null };
        }
        const { data: signed, error: signError } = await supabase.storage
          .from("business-logos")
          .createSignedUrl(professional.avatar_path, 7 * 24 * 60 * 60);
        if (signError) return { ...base, avatar_url: null };
        return { ...base, avatar_url: signed.signedUrl };
      }),
    );
    return withPhotos;
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
    .select("id, status, cancelled_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) throw new Error("Negócio não encontrado.");
  if (!isPublicBookingEnabled(business))
    throw new Error("Os agendamentos deste estabelecimento estão temporariamente indisponíveis.");
  let { data: serviceRow } = await db
    .from("services")
    .select(`id, name, duration_minutes, available_days, ${SERVICE_DEPOSIT_COLUMNS}`)
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .eq("active", true)
    .maybeSingle();
  if (!serviceRow) {
    // Bancos sem a migration de available_days rejeitam o select inteiro
    // (coluna inexistente). Fallback sem a coluna: ausência = todos os dias.
    const { data: fallbackRow } = await db
      .from("services")
      .select(`id, name, duration_minutes, ${SERVICE_DEPOSIT_COLUMNS}`)
      .eq("id", serviceId)
      .eq("business_id", business.id)
      .eq("active", true)
      .maybeSingle();
    if (fallbackRow)
      serviceRow = { ...fallbackRow, available_days: null } as unknown as typeof serviceRow;
  }
  const service = serviceRow as unknown as
    | (ServiceDepositRow & {
        id: string;
        name: string;
        duration_minutes: number;
        available_days?: number[] | null;
      })
    | null;
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
      availableDays: service.available_days ?? null,
    },
  };
}

/** Preferências do Panel1Config; defaults quando o estabelecimento nunca salvou config própria. */
async function loadPreferences(businessId: string) {
  const db = await admin();
  const config = await loadPanel1Config(db, businessId);
  return config.preferences;
}

/**
 * Mantém a fila do Pix expirando sem depender do cron: qualquer página viva
 * (painel 1, painel 2 ou página pública) dá o empurrão — a varredura interna
 * tem trava de tempo própria e roda em segundo plano.
 */
function kickDepositSweep() {
  void import("./agpay-events.server")
    .then((m) => m.sweepExpiredDeposits())
    .catch(() => {
      // Sem segredo configurado (ex.: testes): segue sem a varredura.
    });
}

type DepositPixMode = "desabilitado" | "opcional" | "obrigatorio";

/**
 * Regras de pagamento da carteira Ag Pay definidas no painel 2.
 * Sem a migration (ou sem regra salva) o comportamento permanece o de sempre:
 * cobrar o sinal configurado — equivalente ao modo "obrigatorio".
 */
async function loadDepositRules(
  db: Awaited<ReturnType<typeof admin>>,
  businessId: string,
): Promise<{ mode: DepositPixMode; exceptionClients: string[] }> {
  const { data, error } = await db
    .from("businesses")
    .select("pix_mode, pix_exception_clients")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !data) return { mode: "obrigatorio", exceptionClients: [] };
  const mode = data.pix_mode;
  return {
    mode: mode === "desabilitado" || mode === "opcional" ? mode : "obrigatorio",
    exceptionClients: (data.pix_exception_clients ?? []) as string[],
  };
}

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Isenção do sinal (modo obrigatório) vale SOMENTE LOGADO.
 * O painel 2 seleciona o cliente pelos dados (nome e telefone); para reconhecer
 * a pessoa o cliente precisa estar com a conta aberta no número cadastrado —
 * sem login não há como identificar ninguém e o sinal é cobrado normalmente.
 */
async function findDepositExemption(
  db: Awaited<ReturnType<typeof admin>>,
  businessId: string,
  accountPhone: string,
  exceptionClients: string[],
): Promise<{ exempt: boolean; name: string | null }> {
  const PAGE = 1000;
  const rows: Array<{ name: string; phone: string | null }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("customers")
      .select("name, phone")
      .eq("business_id", businessId)
      .range(from, from + PAGE - 1);
    if (error) return { exempt: false, name: null };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const accountRow = rows.find((row) => onlyDigits(row.phone) === accountPhone);
  if (!accountRow) return { exempt: false, name: null };
  const accountName = normalizeName(accountRow.name ?? "");
  for (const entry of exceptionClients) {
    const separator = entry.indexOf("|");
    const entryName = normalizeName(separator >= 0 ? entry.slice(0, separator) : entry);
    const entryPhone = separator >= 0 ? onlyDigits(entry.slice(separator + 1)) : null;
    if (!entryName) continue;
    if (entryPhone && entryPhone !== accountPhone) continue;
    if (!entryPhone) {
      // Entrada antiga só com nome: o telefone vem do cadastro desse nome.
      const byName = rows.find((row) => normalizeName(row.name ?? "") === entryName);
      if (!byName || onlyDigits(byName.phone) !== accountPhone) continue;
    }
    if (accountName === entryName) return { exempt: true, name: accountRow.name };
  }
  return { exempt: false, name: accountRow.name };
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

const publicCodeInput = z.object({ publicCode: z.string().guid() });

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
        date: civilDateSchema,
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
  const { data: links, error: linksError } = await db
    .from("service_professionals")
    .select("professional_id")
    .eq("business_id", businessId)
    .eq("service_id", serviceId);
  if (linksError) throw new Error("Não foi possível validar o profissional.");
  if (!links?.length) {
    if (professionalId) throw new Error("Selecione um profissional disponível.");
    return null;
  }
  if (!professionalId || !links.some((link) => link.professional_id === professionalId))
    throw new Error("Selecione um profissional disponível.");
  const { data: professional, error: professionalError } = await db
    .from("professionals")
    .select("id, name, active, working_days")
    .eq("id", professionalId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (professionalError) throw new Error("Não foi possível validar o profissional.");
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
  /** Dias da semana em que o serviço pode ser agendado; null = sem restrição. */
  serviceAvailableDays?: number[] | null | undefined;
  /**
   * Pix obrigatório: horário aguardando sinal OCUPA o horário até pagar ou
   * expirar — ninguém mais pode marcar enquanto a cobrança está na fila.
   */
  blockPendingDeposit?: boolean;
}): Promise<string[]> {
  const db = await admin();
  const weekday = weekdayInTimezone(params.date, params.timezone);
  if (params.workingDays && !params.workingDays.includes(weekday)) return [];
  if (params.serviceAvailableDays && !params.serviceAvailableDays.includes(weekday)) return [];

  const { data: hours } = await db
    .from("business_hours")
    .select("starts_at, ends_at")
    .eq("business_id", params.businessId)
    .eq("weekday", weekday);
  if (!hours?.length) return [];

  const { data: blocks, error: blocksError } = await db
    .from("time_blocks")
    .select("starts_at, ends_at, recurring, weekday, block_date, professional_id")
    .eq("business_id", params.businessId);
  if (blocksError) throw new Error("Não foi possível consultar a disponibilidade.");

  const dayStart = toIso(params.date, "00:00", params.timezone);
  const dayEnd = toIso(params.date, "23:59", params.timezone);
  const { data: appts, error: appointmentsError } = await db
    .from("appointments")
    .select("starts_at, ends_at, status, professional_id")
    .eq("business_id", params.businessId)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);
  if (appointmentsError) throw new Error("Não foi possível consultar a disponibilidade.");

  const busy: [number, number][] = [];
  for (const b of blocks ?? []) {
    const matches = b.recurring ? b.weekday === weekday : b.block_date === params.date;
    const sameProf = !b.professional_id || b.professional_id === params.professionalId;
    if (matches && sameProf)
      busy.push([minutesOf(b.starts_at.slice(0, 5)), minutesOf(b.ends_at.slice(0, 5))]);
  }
  for (const a of appts ?? []) {
    const pendingDeposit =
      a.status === "aguardando_sinal" &&
      !params.blockPendingDeposit;
    if (a.status === "cancelado" || pendingDeposit) continue;
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

  const slots = computeSlots({
    hours,
    busy,
    durationMinutes: params.durationMinutes,
    nowMin,
    listingIntervalMinutes: params.listingIntervalMinutes,
  });
  return filterPossibleLocalTimes(params.date, slots, params.timezone);
}

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    slugSchema.extend({ customerToken: z.string().max(4096).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.availability);
    kickDepositSweep();
    const db = await admin();
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    const preferences = await loadPreferences(businessId);
    const professional = await validateProfessional(businessId, service.id, data.professionalId);
    const rules = await loadDepositRules(db, businessId);
    const slots = await computeAvailableSlots({
      businessId,
      durationMinutes: service.duration_minutes,
      date: data.date,
      timezone: preferences.timezone,
      minimumNoticeHours: preferences.minimum_notice_hours,
      listingIntervalMinutes: preferences.listing_time_minutes,
      professionalId: data.professionalId,
      workingDays: professional?.working_days ?? null,
      serviceAvailableDays: service.availableDays,
      // No obrigatório, horário aguardando sinal fica ocupado até pagar ou expirar.
      blockPendingDeposit: rules.mode === "obrigatorio",
    });
    // Modo desabilitado: a tela não pede documento nem mostra sinal para ninguém.
    // Cliente isento logado (painel 2): também não vê sinal nem documento.
    let depositCents = rules.mode === "desabilitado" ? 0 : service.depositCents;
    if (rules.mode === "obrigatorio" && data.customerToken && depositCents > 0) {
      const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
      if (secret) {
        const { verifyCustomerToken } = await import("./customer-token");
        const session = verifyCustomerToken(data.customerToken, secret);
        if (session && session.bid === businessId) {
          const exemption = await findDepositExemption(
            db,
            businessId,
            session.phone,
            rules.exceptionClients,
          );
          if (exemption.exempt) depositCents = 0;
        }
      }
    }
    return { slots, depositCents };
  });

export const getOpenDays = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.openDays);
    const db = await admin();
    const { data: business, error: businessError } = await db
      .from("businesses")
      .select("id, status, cancelled_at")
      .eq("slug", data.slug)
      .maybeSingle();
    if (businessError) throw new Error("Não foi possível consultar os dias de atendimento.");
    if (!business || !isPublicBookingEnabled(business))
      return { days: [] as { date: string; weekday: number }[] };
    const preferences = await loadPreferences(business.id);
    const { data: hours, error: hoursError } = await db
      .from("business_hours")
      .select("weekday")
      .eq("business_id", business.id);
    if (hoursError) throw new Error("Não foi possível consultar os dias de atendimento.");
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
        // Sessão da conta (opcional): habilita a isenção do sinal no modo obrigatório.
        customerToken: z.string().max(4096).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.reserve);
    const db = await admin();
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    const preferences = await loadPreferences(businessId);
    const professional = await validateProfessional(businessId, service.id, data.professionalId);
    const rules = await loadDepositRules(db, businessId);

    // Identifica a conta quando o cliente está logado: é o que permite a isenção
    // do sinal para clientes selecionados no painel 2 (nome + telefone da conta).
    let account: { phone: string; name: string | null } | null = null;
    if (data.customerToken) {
      const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
      if (secret) {
        const { verifyCustomerToken } = await import("./customer-token");
        const session = verifyCustomerToken(data.customerToken, secret);
        if (session && session.bid === businessId) {
          const record = await findCustomerRecord(db, businessId, session.phone);
          account = { phone: session.phone, name: record?.name ?? null };
        }
      }
    }

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
      serviceAvailableDays: service.availableDays,
      // No modo obrigatório, horário aguardando sinal fica ocupado até pagar
      // ou até os 5 minutos expirarem (o cron cancela e libera de novo).
      blockPendingDeposit: rules.mode === "obrigatorio",
    });
    if (!available.includes(data.time))
      throw new Error("Esse horário não está mais disponível. Escolha outro.");

    // Regras do sinal:
    // • desabilitado → nenhum sinal para ninguém, com ou sem login;
    // • obrigatório → cobra de todos, EXCETO o cliente selecionado no painel 2
    //   quando ele está LOGADO com a conta do telefone e nome cadastrados;
    // • opcional → cobra o sinal, mas o horário sobe CONFIRMADO na agenda mesmo
    //   sem pagar: o Pix aparece no final para pagar se quiser.
    const exempt =
      rules.mode === "obrigatorio" && account
        ? (await findDepositExemption(db, businessId, account.phone, rules.exceptionClients)).exempt
        : false;
    let depositCents = service.depositCents;
    if (rules.mode === "desabilitado") depositCents = 0;
    if (exempt) depositCents = 0;
    const pixOptional = rules.mode === "opcional";
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
      .gt("ends_at", startsAt);
    // No obrigatório, horário aguardando sinal OCUPA o slot; nos outros modos,
    // pendências de sinal não bloqueiam ninguém.
    clashQuery = clashQuery.not(
      "status",
      "in",
      rules.mode === "obrigatorio" ? '("cancelado")' : '("cancelado","aguardando_sinal")',
    );
    if (data.professionalId) clashQuery = clashQuery.eq("professional_id", data.professionalId);
    const { data: clash, error: clashError } = await clashQuery.limit(1);
    if (clashError) throw new Error("Não foi possível confirmar a disponibilidade.");
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
      // Opcional: o horário é CONFIRMADO na hora (sobe na agenda do dono) e o
      // sinal pode ser pago depois. Obrigatório: fica na fila até pagar.
      status: chargesDeposit && !pixOptional ? "aguardando_sinal" : "agendado",
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
      void import("./whatsapp-notify.server").then((m) =>
        m.sendBookingConfirmation(appointment.id),
      );
      return {
        chargeId: null,
        amountCents: 0,
        publicCode,
        serviceName: service.name,
        startsAt,
        expiresAt: null,
      };
    }

    // No opcional o Pix fica disponível até o horário do agendamento (pagar
    // quando quiser); no obrigatório, a janela curta de 5 minutos mantém a fila.
    const expiresAt = pixOptional
      ? startsAt
      : new Date(Date.now() + 5 * 60_000).toISOString();
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
    if (chargeError || !charge) {
      const { data: cancelled, error: cancellationError } = await db
        .from("appointments")
        .update({ status: "cancelado" })
        .eq("id", appointment.id)
        .eq("status", "aguardando_sinal")
        .select("id")
        .maybeSingle();
      if (cancellationError || !cancelled) {
        throw new Error(
          "A cobrança não foi criada e não foi possível cancelar a reserva pendente. Entre em contato com o estabelecimento.",
        );
      }
      throw new Error(chargeError?.message ?? "Falha ao criar cobrança.");
    }

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
    const status =
      error instanceof Error &&
      "status" in error &&
      typeof (error as Error & { status?: unknown }).status === "number"
        ? (error as Error & { status: number }).status
        : null;
    const pixAttemptOutcome = [400, 401, 403, 404, 422].includes(status as number)
      ? "rejeitado"
      : "falhou";
    console.error("Falha ao gerar Pix", {
      chargeId,
      stage,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    const safeError = new Error(
      "Não foi possível gerar o Pix agora. Tente novamente em instantes.",
    );
    Object.assign(safeError, { pixAttemptOutcome });
    throw safeError;
  }
}

const DEPOSIT_PIX_COLUMNS =
  "id, business_id, amount_cents, status, payer_name, payer_phone, payer_cpf_cnpj, payer_email, provider_payment_id, qr_code, qr_code_base64, ticket_url, expires_at" as const;

const isChargeExpired = (expiresAt: string | null) => {
  const expiresAtMs = Date.parse(expiresAt ?? "");
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
};

export const generateDepositPix = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().guid() }).parse(d))
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
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().guid() }).parse(d))
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
        chargeIds: z.array(z.string().guid()).max(50).default([]),
        publicCodes: z.array(z.string().guid()).max(50).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.myBookings);
    // A página do cliente fica polando aqui a cada 15s: é o pulso que mantém a
    // fila do Pix expirando na hora certa (pagou → confirma; passou → cancela).
    kickDepositSweep();
    if (!data.chargeIds.length && !data.publicCodes.length) return { bookings: [] };
    const db = await admin();
    const { data: chargeRows, error: chargeRowsError } = data.chargeIds.length
      ? await db
          .from("deposit_payments")
          .select("id, status, amount_cents, payer_name, expires_at, created_at, appointment_id")
          .in("id", data.chargeIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (chargeRowsError) throw new Error("Não foi possível consultar os agendamentos.");
    const chargedAppointmentIds = (chargeRows ?? [])
      .map((charge) => charge.appointment_id)
      .filter(Boolean) as string[];
    const { data: chargedAppointments, error: chargedAppointmentsError } =
      chargedAppointmentIds.length
        ? await db
            .from("appointments")
            .select("id, starts_at, status, service_id, professional_id")
            .in("id", chargedAppointmentIds)
        : { data: [] as never[], error: null };
    if (chargedAppointmentsError) throw new Error("Não foi possível consultar os agendamentos.");
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
      : { data: [] as never[], error: null };
    if (additionalCharges.error) throw new Error("Não foi possível consultar os agendamentos.");
    const charges = [
      ...(chargeRows ?? []),
      ...(additionalCharges.data ?? []).filter(
        (additional) => !(chargeRows ?? []).some((charge) => charge.id === additional.id),
      ),
    ];
    const serviceIds = [...new Set(appointments.map((a) => a.service_id).filter(Boolean))];
    const { data: servicesRows, error: servicesError } = serviceIds.length
      ? await db
          .from("services")
          .select("id, name")
          .in("id", serviceIds as string[])
      : { data: [] as never[], error: null };
    if (servicesError) throw new Error("Não foi possível consultar os agendamentos.");
    const profIds = [...new Set(appointments.map((a) => a.professional_id).filter(Boolean))];
    const { data: profs, error: professionalsError } = profIds.length
      ? await db
          .from("professionals")
          .select("id, name")
          .in("id", profIds as string[])
      : { data: [] as never[], error: null };
    if (professionalsError) throw new Error("Não foi possível consultar os agendamentos.");

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

const onlyDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

const customerPinSchema = z.string().regex(/^\d{4}$/, "A senha precisa ter 4 números.");

const customerLoginInput = z.object({
  slug: z.string().min(1),
  phone: z.string().min(8).max(30),
  pin: customerPinSchema,
});

const customerRegisterInput = z.object({
  slug: z.string().min(1),
  phone: z.string().min(8).max(30),
  name: z.string().trim().min(3, "Informe seu nome completo.").max(80),
  pin: customerPinSchema,
});

const customerEmail = (digits: string) => `${digits}@cliente.agenda.local`;
const customerPassword = (pin: string) => `agendaagora:${pin}`;

async function businessBySlug(slug: string) {
  const db = await admin();
  const { data: business, error } = await db
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !business) throw new Error("Negócio não encontrado.");
  return { db, businessId: business.id };
}

/** Confere a senha do cliente no Supabase Auth (conta sintética por telefone). */
async function customerPasswordMatches(email: string, password: string): Promise<boolean> {
  const url = process.env["SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return false;
  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ email, password }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Cadastro do cliente no registro do negócio (tabela `customers`).
 * É a identidade da conta por telefone: guarda o nome do dono e define quem
 * pode entrar. Lido com service-role, comparando apenas os dígitos do telefone.
 */
async function findCustomerRecord(
  db: Awaited<ReturnType<typeof admin>>,
  businessId: string,
  phoneDigits: string,
): Promise<{ name: string } | null> {
  const PAGE = 1000;
  const rows: Array<{ name: string; phone: string | null }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("customers")
      .select("name, phone")
      .eq("business_id", businessId)
      .range(from, from + PAGE - 1);
    if (error) return null;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const match = rows.find((row) => onlyDigits(row.phone) === phoneDigits);
  return match ? { name: match.name } : null;
}

/** Conta por telefone tem senha própria, definida no cadastro. Sem senha padrão. */
function customerAccountError(error: { message: string } | null): Error {
  if (error && /registered|already|exists/i.test(error.message))
    return new Error("Este telefone já tem cadastro. Use Entrar.");
  return new Error("Não foi possível criar o cadastro. Tente novamente.");
}

/**
 * Códigos públicos e cobranças ligados ao telefone, para montar o histórico.
 *
 * O PostgREST limita cada resposta a 1000 linhas; o histórico precisa de todos
 * os registros, então a leitura pagina até a última página.
 */
async function findCustomerBookingCodes(
  db: Awaited<ReturnType<typeof admin>>,
  businessId: string,
  phoneDigits: string,
) {
  const PAGE = 1000;
  type PhoneAppointment = {
    id: string;
    public_code: string | null;
    customer_phone: string | null;
    status: string;
  };
  const appointmentsTable = db.from("appointments") as unknown as {
    select(columns: string): {
      eq(column: string, value: string): {
        range(
          from: number,
          to: number,
        ): PromiseLike<{
          data: PhoneAppointment[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const appointments: PhoneAppointment[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await appointmentsTable
      .select("id, public_code, customer_phone, status")
      .eq("business_id", businessId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Não foi possível consultar seus agendamentos.");
    appointments.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const matched = appointments.filter(
    (appointment) =>
      appointment.status !== "bloqueado" &&
      onlyDigits(appointment.customer_phone) === phoneDigits,
  );
  const appointmentIds = new Set(matched.map((appointment) => appointment.id));
  const publicCodes = [
    ...new Set(
      matched
        .map((appointment) => appointment.public_code)
        .filter((code): code is string => typeof code === "string" && code.length > 0),
    ),
  ];

  const charges: Array<{
    id: string;
    appointment_id: string | null;
    payer_phone: string | null;
  }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("deposit_payments")
      .select("id, appointment_id, payer_phone")
      .eq("business_id", businessId)
      .range(from, from + PAGE - 1);
    if (error) break;
    charges.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const chargeIds = [
    ...new Set(
      charges
        .filter(
          (charge) =>
            onlyDigits(charge.payer_phone) === phoneDigits ||
            (!!charge.appointment_id && appointmentIds.has(charge.appointment_id)),
        )
        .map((charge) => charge.id),
    ),
  ];

  // Quantidade de agendamentos da conta (sem duplicar cobrança + agendamento).
  const accountAppointmentIds = new Set(appointmentIds);
  for (const charge of charges) {
    if (onlyDigits(charge.payer_phone) === phoneDigits && charge.appointment_id)
      accountAppointmentIds.add(charge.appointment_id);
  }

  return { publicCodes, chargeIds, bookingCount: accountAppointmentIds.size };
}

/** Sessão da conta: token assinado + dados da conta + histórico do telefone. */
async function customerSessionPayload(
  db: Awaited<ReturnType<typeof admin>>,
  businessId: string,
  digits: string,
  name: string,
) {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!secret) throw new Error("Conta indisponível no momento.");
  const { signCustomerToken } = await import("./customer-token");
  const token = signCustomerToken(businessId, digits, secret);
  const codes = await findCustomerBookingCodes(db, businessId, digits);
  return { token, phone: digits, name, ...codes };
}

/** Cria o cadastro: nome + telefone + senha de 4 números escolhida pelo dono. */
export const customerRegister = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => customerRegisterInput.parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.customerRegister);
    const digits = onlyDigits(data.phone);
    if (digits.length < 10 || digits.length > 13)
      throw new Error("Informe um telefone válido com DDD.");

    const { db, businessId } = await businessBySlug(data.slug);
    const existing = await findCustomerRecord(db, businessId, digits);
    if (existing && (await customerPasswordMatches(customerEmail(digits), customerPassword(data.pin))))
      throw new Error("Este telefone já tem cadastro. Use Entrar.");

    // A conta de acesso é criada SÓ aqui: cada telefone tem a própria senha.
    const created = await db.auth.admin.createUser({
      email: customerEmail(digits),
      password: customerPassword(data.pin),
      email_confirm: true,
      user_metadata: { full_name: data.name, phone: digits, account_kind: "customer" },
    });
    if (created.error) throw customerAccountError(created.error);

    if (!existing) {
      await db.from("customers").insert({ business_id: businessId, name: data.name, phone: digits });
    }
    const name = existing?.name ?? data.name;
    return customerSessionPayload(db, businessId, digits, name);
  });

/** Entra numa conta EXISTENTE: nunca cria conta nem aceita senha genérica. */
export const customerLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => customerLoginInput.parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.customerLogin);
    const digits = onlyDigits(data.phone);
    if (digits.length < 10 || digits.length > 13)
      throw new Error("Informe um telefone válido com DDD.");

    const { db, businessId } = await businessBySlug(data.slug);
    const record = await findCustomerRecord(db, businessId, digits);
    if (!record) throw new Error("Telefone não cadastrado. Toque em Criar cadastro.");
    if (!(await customerPasswordMatches(customerEmail(digits), customerPassword(data.pin))))
      throw new Error("Telefone ou senha incorretos.");
    return customerSessionPayload(db, businessId, digits, record.name);
  });

/** Restaura a sessão salva no aparelho e recarrega o histórico do telefone. */
export const customerSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        token: z.string().min(10).max(4096),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.customerSession);
    const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!secret) throw new Error("Conta indisponível no momento.");
    const { verifyCustomerToken } = await import("./customer-token");
    const session = verifyCustomerToken(data.token, secret);
    if (!session) throw new Error("Sessão expirada. Entre novamente.");

    const { db, businessId } = await businessBySlug(data.slug);
    if (businessId !== session.bid) throw new Error("Sessão inválida. Entre novamente.");
    const record = await findCustomerRecord(db, businessId, session.phone);
    const codes = await findCustomerBookingCodes(db, businessId, session.phone);
    return { phone: session.phone, name: record?.name ?? "Cliente", ...codes };
  });

export const getDepositStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().guid() }).parse(d))
  .handler(async ({ data }) => {
    enforceRateLimit(PUBLIC_RATE_LIMITS.depositStatus);
    const { synchronizeDepositPayment } = await import("./agpay-events.server");
    return synchronizeDepositPayment(data.chargeId);
  });
