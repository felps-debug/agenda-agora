import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { applyOutreachPlaceholders } from "@/lib/outreach-templates.placeholders";
import { parseOutreachDesign, type OutreachDesign } from "@/lib/outreach-design";
import { outreachMessageSchema } from "@/lib/outreach-message-settings";
import {
  businessOwnerCanEdit,
  resolveEffectiveOutreachDesign,
} from "@/lib/outreach-design-resolution";

type OutreachTables = {
  outreach_templates: {
    id: string;
    title: string;
    usage_type: string;
    body: string;
    active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    design: OutreachDesign;
    is_default: boolean;
  };
  business_outreach_overrides: {
    id: string;
    business_id: string;
    template_id: string;
    design: OutreachDesign;
  };
  businesses: {
    id: string;
    selected_outreach_template_ids: string[] | null;
    confirmation_template: string | null;
    payment_confirmation_template: string | null;
    reminder_template: string | null;
    reminder_hours_before: number | null;
  };
};

type DynamicQuery<Row> = PromiseLike<{
  data: Row[] | null;
  error: { message: string } | null;
}> & {
  select(columns?: string): DynamicQuery<Row>;
  update(values: Partial<Row>): DynamicQuery<Row>;
  insert(values: Partial<Row>): DynamicQuery<Row>;
  upsert(values: Partial<Row>, options?: { onConflict?: string }): DynamicQuery<Row>;
  delete(): DynamicQuery<Row>;
  eq(column: string, value: unknown): DynamicQuery<Row>;
  order(column: string, options?: { ascending?: boolean }): DynamicQuery<Row>;
  single(): Promise<{ data: Row | null; error: { message: string } | null }>;
  maybeSingle(): Promise<{ data: Row | null; error: { message: string } | null }>;
};

type DynamicSupabase = {
  from<Table extends keyof OutreachTables>(table: Table): DynamicQuery<OutreachTables[Table]>;
};

function dynamicTable<Table extends keyof OutreachTables>(
  client: SupabaseClient<Database>,
  table: Table,
): DynamicQuery<OutreachTables[Table]> {
  return (client as unknown as DynamicSupabase).from(table);
}

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

const visualTemplateInput = z.object({ templateId: z.string().uuid(), design: z.unknown() });
const businessTemplateInput = z.object({
  businessId: z.string().uuid(),
  templateId: z.string().uuid(),
});

async function assertBusinessOwner(context: { userId: string }, businessId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !businessOwnerCanEdit(data.owner_id, context.userId))
    throw new Error("Você não tem permissão para editar os templates deste negócio.");
  return supabaseAdmin;
}

/** Salva o design padrão da plataforma; apenas o super_admin pode alterar. */
export const saveOutreachTemplateDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => visualTemplateInput.parse(data))
  .handler(async ({ context, data }) => {
    const design = parseOutreachDesign(data.design);
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: template, error } = await dynamicTable(supabaseAdmin, "outreach_templates")
      .update({ design, active: true, is_default: true })
      .eq("id", data.templateId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!template) throw new Error("Template não encontrado.");
    return template;
  });

/** Salva uma cópia personalizada vinculada exclusivamente ao proprietário logado. */
export const saveBusinessOutreachOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    visualTemplateInput.extend({ businessId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const design = parseOutreachDesign(data.design);
    const supabaseAdmin = await assertBusinessOwner(context, data.businessId);
    const { data: row, error } = await dynamicTable(supabaseAdmin, "business_outreach_overrides")
      .upsert(
        { business_id: data.businessId, template_id: data.templateId, design },
        { onConflict: "business_id,template_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const resetBusinessOutreachOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => businessTemplateInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertBusinessOwner(context, data.businessId);
    const { error } = await dynamicTable(supabaseAdmin, "business_outreach_overrides")
      .delete()
      .eq("business_id", data.businessId)
      .eq("template_id", data.templateId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listVisualOutreachTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ businessId: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let overrides: Array<{ template_id: string; design: unknown }> = [];
    if (data.businessId) {
      const admin = await assertBusinessOwner(context, data.businessId);
      const { data: rows, error } = await dynamicTable(admin, "business_outreach_overrides")
        .select("template_id, design")
        .eq("business_id", data.businessId);
      if (error) throw new Error(error.message);
      overrides = (rows ?? []).map((row) => ({
        ...row,
        design: parseOutreachDesign(row.design),
      }));
    } else await assertSuperAdmin(context);
    const { data: templates, error } = await dynamicTable(supabaseAdmin, "outreach_templates")
      .select("id, title, design, is_default, active")
      .eq("active", true)
      .order("is_default", { ascending: false })
      .order("title");
    if (error) throw new Error(error.message);
    const byId = new Map(overrides.map((row) => [row.template_id, row.design]));
    return (templates ?? []).map(
      (template: { id: string; title: string; design: unknown; is_default: boolean }) => ({
        id: template.id,
        title: template.title,
        isDefault: template.is_default,
        design: resolveEffectiveOutreachDesign(
          parseOutreachDesign(template.design),
          byId.get(template.id),
        ) as OutreachDesign,
        isCustomized: byId.has(template.id),
      }),
    );
  });

export const getOutreachBusinessSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ businessId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const admin = await assertBusinessOwner(context, data.businessId);
    const { data: row, error } = await dynamicTable(admin, "businesses")
      .select(
        "selected_outreach_template_ids, confirmation_template, payment_confirmation_template, reminder_template, reminder_hours_before",
      )
      .eq("id", data.businessId)
      .single();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Não foi possível carregar as configurações do negócio.");
    return {
      selectedTemplateIds: row.selected_outreach_template_ids ?? [],
      confirmationTemplate:
        row.confirmation_template ??
        "Olá, {nome}! Seu horário de {servico} está confirmado para {data} às {hora} em {negocio}.",
      paymentConfirmationTemplate:
        row.payment_confirmation_template ??
        "Olá, {nome}! Seu sinal foi recebido e seu horário de {servico} está confirmado para {data} às {hora} em {negocio}.",
      reminderTemplate:
        row.reminder_template ??
        "Olá, {nome}! Lembrete: seu horário de {servico} em {negocio} é {data} às {hora}.",
      reminderHoursBefore: row.reminder_hours_before ?? 24,
    };
  });

const outreachSettingsInput = z.object({
  businessId: z.string().uuid(),
  selectedTemplateIds: z.array(z.string().uuid()).max(100),
  confirmationTemplate: outreachMessageSchema,
  paymentConfirmationTemplate: outreachMessageSchema,
  reminderTemplate: outreachMessageSchema,
  reminderHoursBefore: z.number().int().min(1).max(168),
});

export const saveOutreachBusinessSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => outreachSettingsInput.parse(data))
  .handler(async ({ context, data }) => {
    const admin = await assertBusinessOwner(context, data.businessId);
    const { error } = await dynamicTable(admin, "businesses")
      .update({
        selected_outreach_template_ids: data.selectedTemplateIds,
        confirmation_template: data.confirmationTemplate,
        payment_confirmation_template: data.paymentConfirmationTemplate,
        reminder_template: data.reminderTemplate,
        reminder_hours_before: data.reminderHoursBefore,
      })
      .eq("id", data.businessId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
