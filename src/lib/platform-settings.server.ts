import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const db = supabaseAdmin;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar a configuração da plataforma.");
  return ((data?.value ?? undefined) as T | undefined) ?? fallback;
}

export async function setSetting<T>(key: string, value: T, userId: string | null) {
  const { error } = await db
    .from("platform_settings")
    .upsert(
      { key, value: value as Json, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error("Não foi possível salvar a configuração da plataforma.");
}
