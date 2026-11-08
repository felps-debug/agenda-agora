import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { isStrongOwnerPassword, OWNER_PASSWORD_MESSAGE } from "@/lib/password-strength";

export const setOwnerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        password: z.string().refine(isStrongOwnerPassword, OWNER_PASSWORD_MESSAGE),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertSuperAdmin(context);
    const { data: business, error } = await admin
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error || !business?.owner_id) throw new Error("Dono do estabelecimento não encontrado.");
    // Fail closed: establish who requested the change before touching Auth.
    const { data: event, error: auditError } = await admin
      .from("master_business_events")
      .insert({
        business_id: business.id,
        actor_id: context.userId,
        type: "troca_senha_dono",
        title: "Troca de senha solicitada pelo Master",
        description: "Solicitação registrada; aguardando confirmação da alteração.",
      })
      .select("id")
      .single();
    if (auditError || !event)
      throw new Error("Não foi possível registrar a auditoria da alteração.");
    const { error: updateError } = await admin.auth.admin.updateUserById(business.owner_id, {
      password: data.password,
    });
    const { error: resultError } = await admin
      .from("master_business_events")
      .update({
        title: updateError ? "Troca de senha não concluída" : "Senha do dono alterada pelo Master",
        description: updateError
          ? "O serviço de autenticação recusou a alteração."
          : "Senha definida pela equipe. O valor não é armazenado na auditoria.",
      })
      .eq("id", event.id);
    if (updateError) throw new Error("Não foi possível alterar a senha do dono.");
    if (resultError)
      throw new Error("Senha alterada; não foi possível confirmar o resultado na auditoria.");
    return { ok: true as const };
  });

export const resetOwnerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const admin = await assertSuperAdmin(context);
    const { data: business, error } = await admin
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error || !business) throw new Error("Estabelecimento não encontrado.");

    const { error: auditError } = await admin.from("master_business_events").insert({
      business_id: business.id,
      actor_id: context.userId,
      type: "suporte",
      title: "Reset de senha solicitado pelo Master",
      description: "O Master solicitou uma senha temporária para o dono do estabelecimento.",
    });
    if (auditError) throw new Error("Não foi possível registrar a auditoria do reset.");

    const temporaryPassword = `Aa1${randomBytes(18).toString("base64url")}`;
    const { error: resetError } = await admin.auth.admin.updateUserById(business.owner_id, {
      password: `agendaagora:${temporaryPassword}`,
    });
    if (resetError) throw new Error("Não foi possível redefinir a senha do dono.");

    return { temporaryPassword };
  });
