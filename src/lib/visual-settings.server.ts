import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { normalizePanel1Config, type Panel1Config } from "@/lib/panel1-config";
import { loadPanel1Config } from "@/lib/panel1-config.storage";

export type VisualSettingsSnapshot = {
  config: Panel1Config;
  revision: number;
  source: "v2" | "legacy";
};

export class VisualSettingsConflictError extends Error {
  code = "REVISION_CONFLICT" as const;
  constructor() {
    super("As configurações foram alteradas em outra sessão. Recarregue a página e tente de novo.");
    this.name = "VisualSettingsConflictError";
  }
}

function fromRow(
  row: Database["public"]["Tables"]["business_visual_settings"]["Row"],
): Panel1Config {
  return normalizePanel1Config({
    ...(typeof row.content === "object" && row.content ? row.content : {}),
    appearance: row.appearance,
    visual: { layout_key: row.layout_key, niche_id: row.niche_id },
  });
}

/** Reads v2 when published, otherwise falls back without creating a v2 row. */
export async function loadVisualSettings(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<VisualSettingsSnapshot> {
  const { data, error } = await supabase
    .from("business_visual_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (data) return { config: fromRow(data), revision: data.revision, source: "v2" };
  return { config: await loadPanel1Config(supabase, businessId), revision: 0, source: "legacy" };
}

/** Publishes a complete, validated draft with optimistic concurrency. */
export async function publishVisualSettings(
  supabase: SupabaseClient<Database>,
  input: { businessId: string; userId: string; expectedRevision: number; config: Panel1Config },
): Promise<VisualSettingsSnapshot> {
  const config = normalizePanel1Config(input.config);
  const row = {
    business_id: input.businessId,
    schema_version: 2,
    revision: input.expectedRevision + 1,
    layout_key: config.visual.layout_key,
    niche_id: config.visual.niche_id,
    palette_id: null,
    appearance: config.appearance as unknown as Json,
    content: { preferences: config.preferences, updated_at: new Date().toISOString() } as Json,
    updated_by: input.userId,
  };

  if (input.expectedRevision === 0) {
    const { data, error } = await supabase
      .from("business_visual_settings")
      .insert(row as never)
      .select("*")
      .maybeSingle();
    if (error || !data) throw new VisualSettingsConflictError();
    return { config: fromRow(data), revision: data.revision, source: "v2" };
  }

  const { business_id: _businessId, ...patch } = row;
  const { data, error } = await supabase
    .from("business_visual_settings")
    .update(patch)
    .eq("business_id", input.businessId)
    .eq("revision", input.expectedRevision)
    .select("*")
    .maybeSingle();
  if (error || !data) throw new VisualSettingsConflictError();
  return {
    config: fromRow(data as Database["public"]["Tables"]["business_visual_settings"]["Row"]),
    revision: (data as Database["public"]["Tables"]["business_visual_settings"]["Row"]).revision,
    source: "v2",
  };
}
