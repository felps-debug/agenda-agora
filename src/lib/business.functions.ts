import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateBusinessProfileInput = z
  .object({
    businessId: z.string().uuid(),
    name: z.string().min(2).max(120).optional(),
    slug: z.string().min(3).max(60).optional(),
    category: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    greeting: z.string().max(80).nullable().optional(),
    timezone: z.string().min(1).max(80).optional(),
    brand_background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.")
      .optional(),
  })
  .refine(
    (data) =>
      data.greeting !== undefined ||
      data.brand_background !== undefined ||
      (data.name !== undefined && data.slug !== undefined && data.category !== undefined),
    { message: "Informe os dados do negócio para atualizar o perfil." },
  );

export function buildBusinessProfileUpdate(data: {
  name?: string | undefined;
  slug?: string | undefined;
  category?: string | undefined;
  phone?: string | undefined;
  address?: string | undefined;
  greeting?: string | null | undefined;
  timezone?: string | undefined;
  brand_background?: string | undefined;
}) {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.slug !== undefined ? { slug: data.slug } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
    ...(data.address !== undefined ? { address: data.address || null } : {}),
    ...(data.greeting !== undefined ? { greeting: data.greeting } : {}),
    ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
    ...(data.brand_background !== undefined ? { brand_background: data.brand_background } : {}),
  };
}

export function resolveBusinessGreeting(
  businessGreeting: string | null | undefined,
  legacyGreeting: string,
) {
  return businessGreeting ?? legacyGreeting;
}

export function resolveBusinessTimezone(
  businessTimezone: string | null | undefined,
  legacyTimezone: string,
) {
  return businessTimezone ?? legacyTimezone;
}

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
    const { data: business, error: businessError } = await context.supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (businessError) throw new Error("Não foi possível validar o negócio.");
    assertBusinessOwner(business);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("businesses")
      .update(buildBusinessProfileUpdate(data))
      .eq("id", data.businessId)
      .select()
      .single();
    if (error) throw mapBusinessUpdateError(error);
    return updated;
  });
