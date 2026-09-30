import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, TablesInsert } from "@/integrations/supabase/types";
import { isBusinessImagePath } from "@/lib/business-image-path";
import { assertStoredBusinessImage } from "@/lib/logo";
import {
  assertRequiredDepositAmount,
  effectiveDepositCents,
  type DepositMode,
} from "@/lib/deposit-amount";

const MAX_CENTS = 100_000_000;
// O provedor Pix exige cobrança mínima de R$ 5,00.
const MIN_PIX_DEPOSIT_CENTS = 500;

export const saveServiceInput = z.object({
  id: z.string().uuid().optional(),
  businessId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  priceCents: z.number().int().min(0).max(MAX_CENTS),
  requiresDeposit: z.boolean(),
  depositMode: z.enum(["fixed", "percent"]),
  depositCents: z.number().int().min(0).max(MAX_CENTS),
  depositPercentBps: z.number().int().min(0).max(10_000),
  description: z.string().max(2000).nullable(),
  isCombo: z.boolean().default(false),
  showPrice: z.boolean().default(true),
  showDuration: z.boolean().default(true),
  showService: z.boolean().default(true),
  imagePath: z.string().max(512).nullable().default(null),
});

export type SaveServiceInput = z.infer<typeof saveServiceInput>;

// T034: as colunas vêm da migration service_deposit_percent, ainda ausentes do
// types.ts gerado. Remover este tipo e a anotação em saveServiceForOwner quando os tipos
// forem regenerados a partir do schema migrado.
type ServiceDepositColumns = { deposit_mode: DepositMode; deposit_percent_bps: number };
type ServiceRow = Omit<TablesInsert<"services">, "id"> & ServiceDepositColumns;

/**
 * Monta a linha de `services` validada. No modo percentual, `deposit_cents` guarda o
 * valor calculado no momento do salvamento: se o código anterior (que só lê
 * `deposit_cents`) voltar ao ar, ele cobra o mesmo sinal em vez de um fixo antigo.
 */
export function buildServiceRow(input: SaveServiceInput): ServiceRow {
  if (input.imagePath && !isBusinessImagePath(input.imagePath, input.businessId, "service")) {
    throw new Error("A imagem do serviço não pertence a este negócio.");
  }
  const shadowDepositCents =
    input.depositMode === "percent"
      ? effectiveDepositCents({
          requires_deposit: true,
          deposit_mode: "percent",
          deposit_percent_bps: input.depositPercentBps,
          price_cents: input.priceCents,
          deposit_cents: 0,
        })
      : input.depositCents;

  assertRequiredDepositAmount(input.requiresDeposit, shadowDepositCents);

  // Um sinal abaixo do mínimo Pix sempre falharia.
  if (
    input.requiresDeposit &&
    shadowDepositCents > 0 &&
    shadowDepositCents < MIN_PIX_DEPOSIT_CENTS
  ) {
    throw new Error("O sinal deve ser R$ 0,00 (sem sinal) ou pelo menos R$ 5,00.");
  }

  return {
    business_id: input.businessId,
    name: input.name,
    duration_minutes: input.durationMinutes,
    price_cents: input.priceCents,
    requires_deposit: input.requiresDeposit,
    deposit_mode: input.depositMode,
    deposit_percent_bps: input.depositPercentBps,
    deposit_cents: shadowDepositCents,
    description: input.description?.trim() || null,
    is_combo: input.isCombo,
    show_price: input.showPrice,
    show_duration: input.showDuration,
    show_service: input.showService,
    image_path: input.imagePath,
  };
}

/** Grava o serviço com a sessão do usuário (RLS `services_owner`) após confirmar o dono. */
export async function saveServiceForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: SaveServiceInput,
): Promise<{ id: string }> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", input.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (businessError) throw new Error("Não foi possível validar o negócio.");
  if (!business) throw new Error("Somente o dono pode gerenciar os serviços do negócio.");

  // Sem `as unknown`: a linha só é alargada para o tipo gerado; as duas colunas extras
  // seguem no payload até T034 incluí-las em TablesInsert<"services">.
  if (input.imagePath) {
    await assertStoredBusinessImage(supabase, input.imagePath, input.businessId, "service");
  }

  const row: TablesInsert<"services"> = buildServiceRow(input);
  const result = input.id
    ? await supabase
        .from("services")
        .update(row)
        .eq("id", input.id)
        .eq("business_id", input.businessId)
        .select("id")
        .maybeSingle()
    : await supabase.from("services").insert(row).select("id").single();
  if (result.error) throw new Error("Não foi possível salvar o serviço.");
  if (!result.data) throw new Error("Serviço não encontrado neste negócio.");
  return { id: result.data.id };
}

export const saveService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveServiceInput.parse(data))
  .handler(async ({ context, data }) =>
    saveServiceForOwner(context.supabase, context.userId, data),
  );
