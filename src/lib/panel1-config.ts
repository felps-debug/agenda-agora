export type Panel1Appearance = {
  page_text: string;
  service_background: string;
  service_text: string;
  service_border: string;
  service_hover_background: string;
  service_hover_text: string;
  service_hover_border: string;
  modal_background: string;
  modal_text: string;
  modal_hover_background: string;
  modal_hover_text: string;
  modal_active_background: string;
  modal_active_text: string;
  modal_border: string;
  agenda_background: string;
  agenda_text: string;
  agenda_border: string;
};

export type Panel1Preferences = {
  minimum_notice_hours: number;
  listing_time_minutes: number;
  notify_clients: boolean;
  reminder_hours_before: number;
  extra_reminder_minutes: number;
  extra_reminder_template: string;
  timezone: string;
  list_dates_days: number;
  cancellations_enabled: boolean;
  cancellation_notice_minutes: number;
  reschedule_enabled: boolean;
  reschedule_notice_minutes: number;
  greeting: string;
};

export type Panel1Config = {
  version: 1;
  appearance: Panel1Appearance;
  preferences: Panel1Preferences;
  updated_at: string | null;
};

export const DEFAULT_EXTRA_REMINDER_TEMPLATE =
  "{Saudacao} {Cliente}, só estou passando aqui para lembrar que você tem um horário agendado conosco hoje às {Horario} 😅 Espero por você, até breve! 👋";

export const DEFAULT_PANEL1_APPEARANCE: Panel1Appearance = {
  page_text: "#f3f4f6",
  service_background: "#0b0d0f",
  service_text: "#f3f4f6",
  service_border: "#2a2d32",
  service_hover_background: "#101828",
  service_hover_text: "#ffffff",
  service_hover_border: "#1677ff",
  modal_background: "#0b0d0f",
  modal_text: "#f3f4f6",
  modal_hover_background: "#e8e8e8",
  modal_hover_text: "#050607",
  modal_active_background: "#e8e8e8",
  modal_active_text: "#050607",
  modal_border: "#2a2d32",
  agenda_background: "#0b0d0f",
  agenda_text: "#f3f4f6",
  agenda_border: "#2a2d32",
};

export const DEFAULT_PANEL1_PREFERENCES: Panel1Preferences = {
  minimum_notice_hours: 2,
  listing_time_minutes: 30,
  notify_clients: true,
  reminder_hours_before: 10,
  extra_reminder_minutes: 0,
  extra_reminder_template: DEFAULT_EXTRA_REMINDER_TEMPLATE,
  timezone: "America/Sao_Paulo",
  list_dates_days: 15,
  cancellations_enabled: true,
  cancellation_notice_minutes: 0,
  reschedule_enabled: false,
  reschedule_notice_minutes: 0,
  greeting: "Agende seu horário",
};

export const PANEL1_SETTINGS_FILENAME = "panel1-settings.json";

export function panel1SettingsPath(businessId: string) {
  return `${businessId}/${PANEL1_SETTINGS_FILENAME}`;
}

const colorPattern = /^#[0-9a-fA-F]{6}$/;
const allowedListingMinutes = new Set([
  10, 15, 20, 30, 40, 45, 50, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390,
]);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback: string, max = 800) {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function boolValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function colorValue(value: unknown, fallback: string) {
  return typeof value === "string" && colorPattern.test(value) ? value : fallback;
}

export function defaultPanel1Config(): Panel1Config {
  return {
    version: 1,
    appearance: { ...DEFAULT_PANEL1_APPEARANCE },
    preferences: { ...DEFAULT_PANEL1_PREFERENCES },
    updated_at: null,
  };
}

export function normalizePanel1Config(value: unknown): Panel1Config {
  const root = object(value);
  const rawAppearance = object(root["appearance"]);
  const rawPreferences = object(root["preferences"]);
  const appearance = { ...DEFAULT_PANEL1_APPEARANCE };

  for (const key of Object.keys(appearance) as Array<keyof Panel1Appearance>) {
    appearance[key] = colorValue(rawAppearance[key], appearance[key]);
  }

  const rawListing = Math.round(
    numberValue(
      rawPreferences["listing_time_minutes"],
      DEFAULT_PANEL1_PREFERENCES.listing_time_minutes,
      10,
      390,
    ),
  );

  const preferences: Panel1Preferences = {
    minimum_notice_hours: numberValue(
      rawPreferences["minimum_notice_hours"],
      DEFAULT_PANEL1_PREFERENCES.minimum_notice_hours,
      0,
      720,
    ),
    listing_time_minutes: allowedListingMinutes.has(rawListing)
      ? rawListing
      : DEFAULT_PANEL1_PREFERENCES.listing_time_minutes,
    notify_clients: boolValue(
      rawPreferences["notify_clients"],
      DEFAULT_PANEL1_PREFERENCES.notify_clients,
    ),
    reminder_hours_before: Math.round(
      numberValue(
        rawPreferences["reminder_hours_before"],
        DEFAULT_PANEL1_PREFERENCES.reminder_hours_before,
        1,
        168,
      ),
    ),
    extra_reminder_minutes: Math.round(
      numberValue(
        rawPreferences["extra_reminder_minutes"],
        DEFAULT_PANEL1_PREFERENCES.extra_reminder_minutes,
        0,
        1440,
      ),
    ),
    extra_reminder_template: stringValue(
      rawPreferences["extra_reminder_template"],
      DEFAULT_PANEL1_PREFERENCES.extra_reminder_template,
      800,
    ),
    timezone: stringValue(rawPreferences["timezone"], DEFAULT_PANEL1_PREFERENCES.timezone, 80),
    list_dates_days: Math.floor(
      numberValue(
        rawPreferences["list_dates_days"],
        DEFAULT_PANEL1_PREFERENCES.list_dates_days,
        7,
        365,
      ),
    ),
    cancellations_enabled: boolValue(
      rawPreferences["cancellations_enabled"],
      DEFAULT_PANEL1_PREFERENCES.cancellations_enabled,
    ),
    cancellation_notice_minutes: Math.floor(
      numberValue(
        rawPreferences["cancellation_notice_minutes"],
        DEFAULT_PANEL1_PREFERENCES.cancellation_notice_minutes,
        0,
        1440,
      ),
    ),
    reschedule_enabled: boolValue(
      rawPreferences["reschedule_enabled"],
      DEFAULT_PANEL1_PREFERENCES.reschedule_enabled,
    ),
    reschedule_notice_minutes: Math.floor(
      numberValue(
        rawPreferences["reschedule_notice_minutes"],
        DEFAULT_PANEL1_PREFERENCES.reschedule_notice_minutes,
        0,
        1440,
      ),
    ),
    greeting: stringValue(rawPreferences["greeting"], DEFAULT_PANEL1_PREFERENCES.greeting, 80),
  };

  return {
    version: 1,
    appearance,
    preferences,
    updated_at: typeof root["updated_at"] === "string" ? root["updated_at"] : null,
  };
}
