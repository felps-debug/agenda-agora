import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_PANEL1_APPEARANCE,
  PANEL1_FONTS,
  PANEL1_LOGO_FITS,
  type Panel1Appearance,
  type Panel1Preferences,
  type Panel1VisualPreferences,
} from "@/lib/panel1-config";
import {
  loadPanel1Config,
  savePanel1Config as savePanel1ConfigFile,
} from "@/lib/panel1-config.storage";

const businessIdInput = z.object({ businessId: z.string().uuid() });

const visualSettingsInput = z.object({ businessId: z.string().uuid() });
const publishVisualSettingsInput = z.object({
  businessId: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  config: z.unknown(),
});

async function assertBusinessPermission(supabase: SupabaseClient<Database>, businessId: string) {
  const { data: allowed, error } = await supabase.rpc("has_business_permission", {
    _business_id: businessId,
    _permission: "manage_settings",
  });
  if (error) throw new Error(error.message);
  if (!allowed) throw new Error("Você não tem permissão para configurar este negócio.");
}

async function assertAppearancePermission(supabase: SupabaseClient<Database>, businessId: string) {
  const { data: allowed, error } = await supabase.rpc("has_business_permission", {
    _business_id: businessId,
    _permission: "manage_appearance",
  });
  if (error) throw new Error(error.message);
  if (!allowed) {
    const forbidden = new Error("Você não tem permissão para editar a aparência deste negócio.");
    forbidden.name = "FORBIDDEN";
    throw forbidden;
  }
}

/** V2 read never creates a row; legacy JSON remains a read-only fallback. */
export const getVisualSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => visualSettingsInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAppearancePermission(context.supabase, data.businessId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadVisualSettings } = await import("@/lib/visual-settings.server");
    return loadVisualSettings(supabaseAdmin, data.businessId);
  });

export const publishVisualSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => publishVisualSettingsInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAppearancePermission(context.supabase, data.businessId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePanel1Config } = await import("@/lib/panel1-config");
    const { publishVisualSettings: publish } = await import("@/lib/visual-settings.server");
    try {
      return await publish(supabaseAdmin, {
        businessId: data.businessId,
        userId: context.userId,
        expectedRevision: data.expectedRevision,
        config: normalizePanel1Config(data.config),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "VisualSettingsConflictError") {
        const conflict = new Error(error.message);
        conflict.name = "REVISION_CONFLICT";
        throw conflict;
      }
      throw error;
    }
  });

/** Lê a configuração de Preferências/Aparência do Painel 1; retorna defaults se nunca salva. */
export const getPanel1Config = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => businessIdInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertBusinessPermission(context.supabase, data.businessId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return loadPanel1Config(supabaseAdmin, data.businessId);
  });

const appearanceColorKeys = Object.keys(DEFAULT_PANEL1_APPEARANCE).filter(
  (key) => key !== "font_family" && key !== "logo_fit",
) as Array<Exclude<keyof Panel1Appearance, "font_family" | "logo_fit">>;
const colorField = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const appearancePatch = z
  .object({
    font_family: z.enum(PANEL1_FONTS),
    logo_fit: z.enum(PANEL1_LOGO_FITS),
    ...Object.fromEntries(appearanceColorKeys.map((key) => [key, colorField])),
  })
  .partial()
  .strict();
export const preferencesPatch = z
  .object({
    minimum_notice_hours: z.number().finite().min(0).max(720),
    listing_time_minutes: z.number().int().min(10).max(390),
    notify_clients: z.boolean().default(true),
    reminder_hours_before: z.number().int().min(1).max(168),
    extra_reminder_minutes: z.number().int().min(0).max(1440),
    extra_reminder_template: z.string().max(800),
    timezone: z.string().min(1).max(80),
    list_dates_days: z.number().int().min(7).max(365),
    cancellations_enabled: z.boolean().default(true),
    cancellation_notice_minutes: z.number().int().min(0).max(1440),
    reschedule_enabled: z.boolean().default(false),
    reschedule_notice_minutes: z.number().int().min(0).max(1440),
    greeting: z.string().max(80),
  })
  .partial()
  .strict();
export const visualPreferencesPatch = z
  .object({
    layout_key: z.enum(["classic", "liquid_glass"]),
    niche_id: z.enum(["barbearia", "salao", "consultorio", "estetica", "pet", "outro"]),
  })
  .partial()
  .strict();

const patchInput = z.object({
  businessId: z.string().uuid(),
  patch: z
    .object({
      appearance: appearancePatch.optional(),
      preferences: preferencesPatch.optional(),
      visual: visualPreferencesPatch.optional(),
    })
    .strict(),
});

/** Atualiza (merge parcial) a configuração de Preferências/Aparência do Painel 1. */
export const savePanel1Config = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => patchInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertBusinessPermission(context.supabase, data.businessId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return savePanel1ConfigFile(supabaseAdmin, data.businessId, {
      ...(data.patch.appearance
        ? { appearance: data.patch.appearance as Partial<Panel1Appearance> }
        : {}),
      ...(data.patch.preferences
        ? { preferences: data.patch.preferences as Partial<Panel1Preferences> }
        : {}),
      ...(data.patch.visual
        ? { visual: data.patch.visual as Partial<Panel1VisualPreferences> }
        : {}),
    });
  });
