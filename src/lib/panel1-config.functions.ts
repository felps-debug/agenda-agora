import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { Panel1Appearance, Panel1Preferences } from "@/lib/panel1-config";
import {
  loadPanel1Config,
  savePanel1Config as savePanel1ConfigFile,
} from "@/lib/panel1-config.storage";

const businessIdInput = z.object({ businessId: z.string().uuid() });

async function assertBusinessPermission(supabase: SupabaseClient<Database>, businessId: string) {
  const { data: allowed, error } = await supabase.rpc("has_business_permission", {
    _business_id: businessId,
    _permission: "manage_settings",
  });
  if (error) throw new Error(error.message);
  if (!allowed) throw new Error("Você não tem permissão para configurar este negócio.");
}

/** Lê a configuração de Preferências/Aparência do Painel 1; retorna defaults se nunca salva. */
export const getPanel1Config = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => businessIdInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertBusinessPermission(context.supabase, data.businessId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return loadPanel1Config(supabaseAdmin, data.businessId);
  });

const patchInput = z.object({
  businessId: z.string().uuid(),
  patch: z.object({
    appearance: z.record(z.string(), z.string()).optional(),
    preferences: z.record(z.string(), z.unknown()).optional(),
  }),
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
    });
  });
