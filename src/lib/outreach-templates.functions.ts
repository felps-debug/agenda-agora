import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { applyOutreachPlaceholders } from "@/lib/outreach-templates.placeholders";

/** Lista todos os templates de divulgação (inclusive inativos), só para o super_admin. */
export const listOutreachTemplatesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data, error } = await supabaseAdmin
      .from("outreach_templates")
      .select("id, title, usage_type, body, active, created_by, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const saveOutreachTemplateInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(80),
  usageType: z.enum(["story", "whatsapp", "outro"]),
  body: z.string().min(1).max(2000),
  active: z.boolean(),
});

/** Cria ou atualiza um template de divulgação; restrito ao super_admin. */
export const saveOutreachTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveOutreachTemplateInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const payload = {
      title: data.title,
      usage_type: data.usageType,
      body: data.body,
      active: data.active,
    };
    const query = data.id
      ? supabaseAdmin.from("outreach_templates").update(payload).eq("id", data.id).select().single()
      : supabaseAdmin
          .from("outreach_templates")
          .insert({ ...payload, created_by: context.userId })
          .select()
          .single();
    const { data: template, error } = await query;
    if (error) throw new Error(error.message);
    return template;
  });

/** Ativa/desativa um template de divulgação; restrito ao super_admin. */
export const setOutreachTemplateActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin
      .from("outreach_templates")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id, active: data.active };
  });

/** Lista os templates ativos já personalizados com os dados do negócio; exige vínculo (dono/profissional). */
export const listOutreachTemplatesForBusiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ businessId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: allowed, error: memberError } = await context.supabase.rpc("is_business_member", {
      _business_id: data.businessId,
    });
    if (memberError) throw new Error(memberError.message);
    if (!allowed) throw new Error("Você não tem acesso a este negócio.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("name, category, phone, address, slug")
      .eq("id", data.businessId)
      .single();
    if (businessError) throw new Error(businessError.message);

    const { data: templates, error: templatesError } = await supabaseAdmin
      .from("outreach_templates")
      .select("id, title, usage_type, body, active, created_at, updated_at")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (templatesError) throw new Error(templatesError.message);

    return (templates ?? []).map((template) => ({
      ...template,
      personalizedBody: applyOutreachPlaceholders(template.body, business),
    }));
  });
