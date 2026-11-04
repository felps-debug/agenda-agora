import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";

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

    const temporaryPassword = randomBytes(18).toString("base64url");
    const { error: resetError } = await admin.auth.admin.updateUserById(business.owner_id, {
      password: `agendaagora:${temporaryPassword}`,
    });
    if (resetError) throw new Error("Não foi possível redefinir a senha do dono.");

    return { temporaryPassword };
  });
