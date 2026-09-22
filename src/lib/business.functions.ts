import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateBusinessProfileInput = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(2).max(120),
  slug: z.string().min(3).max(60),
  category: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

/** Só o dono (`owner_id = auth.uid()`) pode editar o negócio; extraída pra ser testável sem banco. */
export function assertBusinessOwner(business: { owner_id: string } | null): void {
  if (!business) throw new Error("Somente o dono pode editar os dados do negócio.");
}

/** Traduz erros do Postgres pra mensagens de usuário; extraída pra ser testável sem banco. */
export function mapBusinessUpdateError(error: { code?: string; message: string }): Error {
  if (error.code === "23505")
    return new Error("Esse link público já está sendo usado por outro estabelecimento.");
  return new Error(error.message);
}

/** Atualiza os dados públicos do negócio; restrito ao dono (owner_id = auth.uid()). */
export const updateBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateBusinessProfileInput.parse(data))
  .handler(async ({ context, data }) => {
    const { data: business } = await context.supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    assertBusinessOwner(business);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("businesses")
      .update({
        name: data.name,
        slug: data.slug,
        category: data.category,
        phone: data.phone ?? null,
        address: data.address ?? null,
      })
      .eq("id", data.businessId)
      .select()
      .single();
    if (error) throw mapBusinessUpdateError(error);
    return updated;
  });
