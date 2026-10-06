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
  type Panel1VisualPreferences,
} from "@/lib/panel1-config";

const configSaveQueues = new WeakMap<SupabaseClient<Database>, Map<string, Promise<void>>>();

async function withBusinessSaveLock<T>(
  supabase: SupabaseClient<Database>,
  businessId: string,
  save: () => Promise<T>,
): Promise<T> {
  let businessQueues = configSaveQueues.get(supabase);
  if (!businessQueues) {
    businessQueues = new Map();
    configSaveQueues.set(supabase, businessQueues);
  }

  const previous = businessQueues.get(businessId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  businessQueues.set(businessId, current);

  await previous;
  try {
    return await save();
  } finally {
    release();
    if (businessQueues.get(businessId) === current) businessQueues.delete(businessId);
    if (businessQueues.size === 0) configSaveQueues.delete(supabase);
  }
}

export async function loadPanel1Config(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<Panel1Config> {
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .download(
      panel1SettingsPath(businessId),
      { cacheNonce: crypto.randomUUID() },
      { cache: "no-store" },
    );

  if (error) {
    // A missing settings object is the only reason to use defaults. In particular,
    // a missing bucket also returns HTTP 404 and must remain visible to the caller.
    if (
      error.statusCode === "NoSuchKey" ||
      ((error.statusCode === "not_found" || error.statusCode === "404") &&
        error.message === "Object not found")
    ) {
      return defaultPanel1Config();
    }
    throw error;
  }
  if (!data) throw new Error("Não foi possível ler as configurações do negócio.");

  try {
    return normalizePanel1Config(JSON.parse(await data.text()));
  } catch {
    throw new Error("As configurações salvas estão inválidas.");
  }
}

export async function savePanel1Config(
  supabase: SupabaseClient<Database>,
  businessId: string,
  patch: {
    appearance?: Partial<Panel1Appearance>;
    preferences?: Partial<Panel1Preferences>;
    visual?: Partial<Panel1VisualPreferences>;
  },
): Promise<Panel1Config> {
  return withBusinessSaveLock(supabase, businessId, async () => {
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
      visual: {
        ...current.visual,
        ...(patch.visual ?? {}),
      },
      updated_at: new Date().toISOString(),
    });

    const body = new Blob([JSON.stringify(next)], { type: "application/json" });
    const { error } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(panel1SettingsPath(businessId), body, {
        upsert: true,
        contentType: "application/json",
        cacheControl: "0",
      });

    if (error) throw error;
    return next;
  });
}
