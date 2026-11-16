import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isProfessionalAvatarPathForBusiness } from "@/lib/professional-avatar-path";

const permissionsSchema = z.record(z.string(), z.boolean());
const inputSchema = z.object({
  id: z.string().guid().optional(),
  businessId: z.string().guid(),
  name: z.string().min(2).max(80),
  role: z.string().max(80).optional(),
  phone: z.string().max(20).default(""),
  email: z.string().email().or(z.literal("")).default(""),
  password: z
    .string()
    .regex(/^\d{4}$/)
    .optional()
    .or(z.literal("")),
  createAccess: z.boolean().default(false),
  avatarPath: z.string().nullable().optional(),
  agendaName: z.string().trim().max(11).optional().default(""),
  publicName: z.string().trim().max(80).optional().default(""),
  workingDays: z.array(z.number().int().min(0).max(6)).max(7),
  permissions: permissionsSchema,
  serviceIds: z.array(z.string().guid()).max(1000),
});

const digits = (value: string) => value.replace(/\D/g, "");
const passwordValue = (value: string) => `agendaagora:${value}`;

export const saveProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ context, data }) => {
    if (data.createAccess && !data.password) {
      throw new Error("Informe uma senha de quatro dígitos para criar o acesso.");
    }
    const { data: business, error: businessError } = await context.supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (businessError) throw new Error("Não foi possível validar o negócio.");
    if (!business) throw new Error("Somente o dono pode gerenciar acessos da equipe.");
    if (
      data.avatarPath != null &&
      !isProfessionalAvatarPathForBusiness(data.avatarPath, data.businessId)
    ) {
      throw new Error("A foto do profissional deve pertencer a este negócio.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.serviceIds.length) {
      if (data.serviceIds.length !== new Set(data.serviceIds).size) {
        throw new Error("Não repita serviços na lista do profissional.");
      }
      const { data: validServices, error: servicesError } = await supabaseAdmin
        .from("services")
        .select("id")
        .eq("business_id", data.businessId)
        .in("id", data.serviceIds);
      if (servicesError) throw new Error(servicesError.message);
      if (
        new Set(validServices?.map((service) => service.id)).size !== new Set(data.serviceIds).size
      ) {
        throw new Error("Selecione apenas serviços deste negócio.");
      }
    }
    // Limite de 10 profissionais por estabelecimento (criação de novos).
    if (!data.id) {
      const { count, error: countError } = await supabaseAdmin
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("business_id", data.businessId);
      if (countError || typeof count !== "number" || !Number.isFinite(count)) {
        throw new Error("Não foi possível validar o limite de profissionais.");
      }
      if (count >= 10) {
        throw new Error("Limite de 10 profissionais atingido neste estabelecimento.");
      }
    }
    const loginEmail = data.email.trim().toLowerCase() || `${digits(data.phone)}@agenda.local`;
    let userId: string | null = null;
    let createdAccess = false;

    if (data.id) {
      const { data: current, error: currentError } = await supabaseAdmin
        .from("professionals")
        .select("user_id")
        .eq("id", data.id)
        .eq("business_id", data.businessId)
        .maybeSingle();
      if (currentError) throw new Error(currentError.message);
      if (!current) throw new Error("Profissional não encontrado neste negócio.");
      userId = current?.user_id ?? null;
      if (userId) {
        const update: { email?: string; password?: string; user_metadata: Record<string, string> } =
          {
            email: loginEmail,
            user_metadata: { full_name: data.name, phone: digits(data.phone) },
          };
        if (data.password) update.password = passwordValue(data.password);
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, update);
        if (error) throw new Error(error.message);
      }
    }

    if (!userId && data.createAccess) {
      if (!data.password)
        throw new Error("Informe uma senha de quatro dígitos para criar o acesso.");
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        password: passwordValue(data.password),
        email_confirm: true,
        user_metadata: { full_name: data.name, phone: digits(data.phone) },
      });
      if (error || !created.user)
        throw new Error(error?.message ?? "Não foi possível criar o acesso.");
      userId = created.user.id;
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "professional" }, { onConflict: "user_id,role" });
      if (roleError) {
        const { error: authCleanupError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authCleanupError)
          throw new Error(
            "Professional role assignment failed and the Auth account could not be removed.",
          );
        throw new Error(roleError.message);
      }
      createdAccess = true;
    }

    const payload = {
      business_id: data.businessId,
      user_id: userId,
      name: data.name,
      agenda_name: data.agendaName || null,
      public_name: data.publicName || null,
      role: data.role || null,
      phone: digits(data.phone) || null,
      email: data.email || null,
      avatar_path: data.avatarPath ?? null,
      working_days: data.workingDays,
      permissions: data.permissions,
    };
    const query = data.id
      ? supabaseAdmin
          .from("professionals")
          .update(payload)
          .eq("id", data.id)
          .eq("business_id", data.businessId)
          .select("id")
          .single()
      : supabaseAdmin.from("professionals").insert(payload).select("id").single();
    const { data: professional, error: saveError } = await query;
    if (saveError) {
      if (createdAccess && userId) {
        const { error: roleCleanupError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "professional");
        const { error: authCleanupError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (roleCleanupError || authCleanupError)
          throw new Error("Professional creation failed and account cleanup was incomplete.");
      }
      throw new Error(saveError.message);
    }

    // The generated types are from the pre-migration schema until the isolated DB
    // is available. Keep this narrow assertion next to the new SQL function.
    const replaceLinks = context.supabase.rpc.bind(context.supabase) as unknown as (
      name: "replace_professional_services",
      args: { _business_id: string; _professional_id: string; _service_ids: string[] },
    ) => PromiseLike<{ error: { message: string } | null }>;
    const { error: linkError } = await replaceLinks("replace_professional_services", {
      _business_id: data.businessId,
      _professional_id: professional.id,
      _service_ids: data.serviceIds,
    });
    if (linkError) {
      if (createdAccess && userId) {
        const { error: profileCleanupError } = await supabaseAdmin
          .from("professionals")
          .delete()
          .eq("id", professional.id)
          .eq("business_id", data.businessId);
        if (profileCleanupError)
          throw new Error(
            "Service links failed and the new professional profile could not be removed.",
          );

        const { error: roleCleanupError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "professional");
        const { error: authCleanupError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (roleCleanupError || authCleanupError)
          throw new Error("Service links failed and professional account cleanup was incomplete.");
      }
      throw new Error(linkError.message);
    }
    return { id: professional.id };
  });

export const deleteProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().guid(), businessId: z.string().guid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: business, error: businessError } = await context.supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (businessError) throw new Error("Não foi possível validar o negócio.");
    if (!business) throw new Error("Somente o dono pode remover acessos da equipe.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: professional, error: professionalError } = await supabaseAdmin
      .from("professionals")
      .select("user_id")
      .eq("id", data.id)
      .eq("business_id", data.businessId)
      .maybeSingle();
    if (professionalError) throw new Error("Não foi possível validar o acesso do profissional.");
    const { error } = await supabaseAdmin
      .from("professionals")
      .delete()
      .eq("id", data.id)
      .eq("business_id", data.businessId);
    if (error) throw new Error(error.message);
    if (professional?.user_id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        professional.user_id,
      );
      if (authDeleteError)
        throw new Error(
          "Professional record was removed, but its Auth account could not be deleted.",
        );
    }
    return { ok: true };
  });
