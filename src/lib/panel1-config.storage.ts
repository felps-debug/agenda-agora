import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LOGO_BUCKET } from "@/lib/logo";
import {
  defaultPanel1Config,
  normalizePanel1Config,
  panel1SettingsPath,
  type Panel1Appearance,
  type Panel1Config,
  type Panel1Preferences,
} from "@/lib/panel1-config";

export async function loadPanel1Config(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<Panel1Config> {
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .download(panel1SettingsPath(businessId));

  if (error || !data) return defaultPanel1Config();

  try {
    return normalizePanel1Config(JSON.parse(await data.text()));
  } catch {
    return defaultPanel1Config();
  }
}

export async function savePanel1Config(
  supabase: SupabaseClient<Database>,
  businessId: string,
  patch: { appearance?: Partial<Panel1Appearance>; preferences?: Partial<Panel1Preferences> },
): Promise<Panel1Config> {
  const current = await loadPanel1Config(supabase, businessId);
  const next = normalizePanel1Config({
    ...current,
    appearance: {
      ...current.appearance,
      ...(patch.appearance ?? {}),
    },
    preferences: {
      ...current.preferences,
      ...(patch.preferences ?? {}),
    },
    updated_at: new Date().toISOString(),
  });

  const body = new Blob([JSON.stringify(next)], { type: "application/json" });
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(panel1SettingsPath(businessId), body, {
      upsert: true,
      contentType: "application/json",
      cacheControl: "60",
    });

  if (error) throw error;
  return next;
}
