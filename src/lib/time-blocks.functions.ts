import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertValidTimeBlockRange } from "@/lib/time-blocks";

export const createTimeBlockInput = z.object({
  businessId: z.string().guid(),
  recurring: z.boolean(),
  weekday: z.number().int().min(0).max(6).nullable(),
  blockDate: z.string().date().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  reason: z.string().max(500).nullable(),
  professionalId: z.string().guid().nullable().optional(),
});

export const createTimeBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createTimeBlockInput.parse(data))
  .handler(async ({ context, data }) => {
    assertValidTimeBlockRange(data.startsAt, data.endsAt);
    if (data.recurring !== (data.weekday !== null) || data.recurring === (data.blockDate !== null))
      throw new Error("Informe o dia ou a data do bloqueio.");
    const { data: business, error: businessError } = await context.supabase
      .from("businesses")
      .select("id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (businessError || !business) throw new Error("Não foi possível validar o negócio.");
    const schedulePermission = await context.supabase.rpc("has_business_permission", {
      _business_id: data.businessId,
      _permission: "block_schedule",
    });
    if (schedulePermission.error) throw new Error(schedulePermission.error.message);
    let allowed = schedulePermission.data;
    if (!allowed) {
      const legacyPermission = await context.supabase.rpc("has_business_permission", {
        _business_id: data.businessId,
        _permission: "block_agenda",
      });
      if (legacyPermission.error) throw new Error(legacyPermission.error.message);
      allowed = legacyPermission.data;
    }
    if (!allowed) throw new Error("Permissao insuficiente para criar bloqueios nesta agenda.");
    if (data.professionalId) {
      const { data: professional } = await context.supabase
        .from("professionals")
        .select("id")
        .eq("id", data.professionalId)
        .eq("business_id", data.businessId)
        .maybeSingle();
      if (!professional) throw new Error("Profissional inválido para este negócio.");
    }
    const { error } = await context.supabase.from("time_blocks").insert({
      business_id: data.businessId,
      professional_id: data.professionalId ?? null,
      recurring: data.recurring,
      weekday: data.weekday,
      block_date: data.blockDate,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      reason: data.reason || null,
    });
    if (error) throw new Error("Não foi possível cadastrar o bloqueio.");
    return { ok: true };
  });
