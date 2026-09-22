import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const withdrawalPixKeyTypes = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const;

export const saveWithdrawalPixKeyInput = z.object({
  businessId: z.string().uuid(),
  pixKey: z.string().min(1).max(140),
  pixKeyType: z.enum(withdrawalPixKeyTypes),
});

/**
 * Cadastra a chave PIX de saque do negócio; restrito ao dono (owner_id = auth.uid()).
 * Vive fora de asaas.server.ts porque arquivos `*.server.*` são bloqueados no bundle
 * do client pelo TanStack Start — a lógica em si (saveWithdrawalPixKeyForOwner)
 * continua em asaas.server.ts e é importada aqui só dentro do handler.
 */
export const saveWithdrawalPixKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveWithdrawalPixKeyInput.parse(data))
  .handler(async ({ context, data }) => {
    const { saveWithdrawalPixKeyForOwner } = await import("./asaas.server");
    return saveWithdrawalPixKeyForOwner(context.supabase, context.userId, data);
  });
