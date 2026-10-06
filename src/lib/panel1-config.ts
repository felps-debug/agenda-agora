export const PANEL1_FONTS = [
  "inter",
  "playfair-display",
  "montserrat",
  "poppins",
  "lato",
  "roboto",
  "oswald",
  "merriweather",
] as const;
export type Panel1Font = (typeof PANEL1_FONTS)[number];

export const PANEL1_LOGO_FITS = ["quadrado", "horizontal", "vertical"] as const;
export type Panel1LogoFit = (typeof PANEL1_LOGO_FITS)[number];

export type Panel1Appearance = {
  font_family: Panel1Font;
  logo_fit: Panel1LogoFit;
  page_text: string;
  header_background: string;
  header_text: string;
  header_title: string;
  service_name_text: string;
  service_price_text: string;
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

export type Panel1VisualPreferences = {
  layout_key: "classic" | "liquid_glass";
  niche_id: "barbearia" | "salao" | "consultorio" | "estetica" | "pet" | "outro";
};

export type Panel1Config = {
  version: 1;
  appearance: Panel1Appearance;
  preferences: Panel1Preferences;
  visual: Panel1VisualPreferences;
  updated_at: string | null;
};

export const DEFAULT_EXTRA_REMINDER_TEMPLATE =
  "{Saudacao} {Cliente}, só estou passando aqui para lembrar que você tem um horário agendado conosco hoje às {Horario} 😅 Espero por você, até breve! 👋";

export const DEFAULT_PANEL1_APPEARANCE: Panel1Appearance = {
  font_family: "inter",
  logo_fit: "quadrado",
  page_text: "#f3f4f6",
  header_background: "#050607",
  header_text: "#f3f4f6",
  header_title: "#f3f4f6",
  service_name_text: "#f3f4f6",
  service_price_text: "#f3f4f6",
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

export const PANEL1_APPEARANCE_PRESETS = {
  noturno: {
    font_family: "inter",
    page_text: "#f5f7fa",
    header_background: "#050607",
    header_text: "#f3f4f6",
    header_title: "#f3f4f6",
    service_background: "#0b0d0f",
    service_text: "#f3f4f6",
    service_border: "#2a2d32",
    service_name_text: "#f3f4f6",
    service_price_text: "#f3f4f6",
    service_hover_background: "#172033",
    service_hover_text: "#ffffff",
    service_hover_border: "#5b8def",
    modal_background: "#0b0d0f",
    modal_text: "#f3f4f6",
    modal_hover_background: "#172033",
    modal_hover_text: "#ffffff",
    modal_active_background: "#dbe8ff",
    modal_active_text: "#101828",
    modal_border: "#2a2d32",
    agenda_background: "#0b0d0f",
    agenda_text: "#f3f4f6",
    agenda_border: "#2a2d32",
  },
  classico: {
    font_family: "playfair-display",
    page_text: "#2c211b",
    header_background: "#3a261d",
    header_text: "#fff4e8",
    header_title: "#fff4e8",
    service_background: "#fffaf4",
    service_text: "#2c211b",
    service_border: "#c9ab84",
    service_name_text: "#2c211b",
    service_price_text: "#765333",
    service_hover_background: "#f3e4d2",
    service_hover_text: "#2c211b",
    service_hover_border: "#765333",
    modal_background: "#fffaf4",
    modal_text: "#2c211b",
    modal_hover_background: "#f3e4d2",
    modal_hover_text: "#2c211b",
    modal_active_background: "#765333",
    modal_active_text: "#ffffff",
    modal_border: "#c9ab84",
    agenda_background: "#fffaf4",
    agenda_text: "#2c211b",
    agenda_border: "#c9ab84",
  },
  claro: {
    font_family: "inter",
    page_text: "#1d2939",
    header_background: "#f4f6f8",
    header_text: "#1d2939",
    header_title: "#101828",
    service_background: "#ffffff",
    service_text: "#344054",
    service_border: "#d0d5dd",
    service_name_text: "#101828",
    service_price_text: "#475467",
    service_hover_background: "#eef4ff",
    service_hover_text: "#102a56",
    service_hover_border: "#3468b2",
    modal_background: "#ffffff",
    modal_text: "#1d2939",
    modal_hover_background: "#eef4ff",
    modal_hover_text: "#102a56",
    modal_active_background: "#244d87",
    modal_active_text: "#ffffff",
    modal_border: "#d0d5dd",
    agenda_background: "#ffffff",
    agenda_text: "#1d2939",
    agenda_border: "#d0d5dd",
  },
  verde: {
    font_family: "lato",
    page_text: "#173b32",
    header_background: "#123b35",
    header_text: "#e8fff8",
    header_title: "#ffffff",
    service_background: "#f1faf6",
    service_text: "#173b32",
    service_border: "#9ac7b7",
    service_name_text: "#173b32",
    service_price_text: "#28614f",
    service_hover_background: "#dcefe7",
    service_hover_text: "#123b35",
    service_hover_border: "#397a66",
    modal_background: "#f1faf6",
    modal_text: "#173b32",
    modal_hover_background: "#dcefe7",
    modal_hover_text: "#123b35",
    modal_active_background: "#28614f",
    modal_active_text: "#ffffff",
    modal_border: "#9ac7b7",
    agenda_background: "#f1faf6",
    agenda_text: "#173b32",
    agenda_border: "#9ac7b7",
  },
  rose: {
    font_family: "poppins",
    page_text: "#4b2330",
    header_background: "#682f43",
    header_text: "#fff5f7",
    header_title: "#ffffff",
    service_background: "#fff7f8",
    service_text: "#4b2330",
    service_border: "#d9a7b5",
    service_name_text: "#4b2330",
    service_price_text: "#7d354d",
    service_hover_background: "#f7e1e7",
    service_hover_text: "#4b2330",
    service_hover_border: "#a4556d",
    modal_background: "#fff7f8",
    modal_text: "#4b2330",
    modal_hover_background: "#f7e1e7",
    modal_hover_text: "#4b2330",
    modal_active_background: "#7d354d",
    modal_active_text: "#ffffff",
    modal_border: "#d9a7b5",
    agenda_background: "#fff7f8",
    agenda_text: "#4b2330",
    agenda_border: "#d9a7b5",
  },
  oceano: {
    font_family: "montserrat",
    page_text: "#15334a",
    header_background: "#164e63",
    header_text: "#ecfeff",
    header_title: "#ffffff",
    service_background: "#f0f9fa",
    service_text: "#15334a",
    service_border: "#8bc4cc",
    service_name_text: "#15334a",
    service_price_text: "#175d6a",
    service_hover_background: "#d7eff2",
    service_hover_text: "#15334a",
    service_hover_border: "#24798a",
    modal_background: "#f0f9fa",
    modal_text: "#15334a",
    modal_hover_background: "#d7eff2",
    modal_hover_text: "#15334a",
    modal_active_background: "#175d6a",
    modal_active_text: "#ffffff",
    modal_border: "#8bc4cc",
    agenda_background: "#f0f9fa",
    agenda_text: "#15334a",
    agenda_border: "#8bc4cc",
  },
} as const;

export const PANEL1_PRESET_DETAILS = {
  noturno: {
    name: "Noir",
    description: "Escuro e sofisticado",
    pageBackground: "#050607",
  },
  classico: {
    name: "Clássico",
    description: "Madeira, couro e tons quentes",
    pageBackground: "#efe2d1",
  },
  claro: {
    name: "Studio",
    description: "Claro, limpo e profissional",
    pageBackground: "#eef1f5",
  },
  verde: {
    name: "Botânico",
    description: "Natural e acolhedor",
    pageBackground: "#e4f1eb",
  },
  rose: {
    name: "Rosé",
    description: "Delicado sem perder contraste",
    pageBackground: "#f7e9ed",
  },
  oceano: {
    name: "Oceano",
    description: "Fresco e tranquilo",
    pageBackground: "#e2f1f3",
  },
} as const satisfies Record<
  keyof typeof PANEL1_APPEARANCE_PRESETS,
  {
    name: string;
    description: string;
    pageBackground: string;
  }
>;

export type Panel1AppearancePreset = keyof typeof PANEL1_APPEARANCE_PRESETS;

export function applyPanel1AppearancePreset(
  current: Panel1Appearance,
  preset: Panel1AppearancePreset,
): Panel1Appearance {
  return { ...current, ...PANEL1_APPEARANCE_PRESETS[preset] };
}

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

export const DEFAULT_PANEL1_VISUAL_PREFERENCES: Panel1VisualPreferences = {
  layout_key: "classic",
  niche_id: "outro",
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
    visual: { ...DEFAULT_PANEL1_VISUAL_PREFERENCES },
    updated_at: null,
  };
}

export function normalizePanel1Config(value: unknown): Panel1Config {
  const root = object(value);
  const rawAppearance = object(root["appearance"]);
  const rawPreferences = object(root["preferences"]);
  const rawVisual = object(root["visual"]);
  const appearance = { ...DEFAULT_PANEL1_APPEARANCE };

  for (const key of Object.keys(appearance) as Array<keyof Panel1Appearance>) {
    if (key === "font_family" || key === "logo_fit") continue;
    appearance[key] = colorValue(rawAppearance[key], appearance[key]);
  }
  appearance.font_family = (PANEL1_FONTS as readonly string[]).includes(
    rawAppearance["font_family"] as string,
  )
    ? (rawAppearance["font_family"] as Panel1Font)
    : DEFAULT_PANEL1_APPEARANCE.font_family;
  appearance.logo_fit = (PANEL1_LOGO_FITS as readonly string[]).includes(
    rawAppearance["logo_fit"] as string,
  )
    ? (rawAppearance["logo_fit"] as Panel1LogoFit)
    : DEFAULT_PANEL1_APPEARANCE.logo_fit;

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

  const visual: Panel1VisualPreferences = {
    layout_key:
      rawVisual["layout_key"] === "liquid_glass"
        ? "liquid_glass"
        : DEFAULT_PANEL1_VISUAL_PREFERENCES.layout_key,
    niche_id: ["barbearia", "salao", "consultorio", "estetica", "pet", "outro"].includes(
      rawVisual["niche_id"] as string,
    )
      ? (rawVisual["niche_id"] as Panel1VisualPreferences["niche_id"])
      : DEFAULT_PANEL1_VISUAL_PREFERENCES.niche_id,
  };

  return {
    version: 1,
    appearance,
    preferences,
    visual,
    updated_at: typeof root["updated_at"] === "string" ? root["updated_at"] : null,
  };
}
