import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { getSetting, setSetting } from "@/lib/platform-settings.server";

export const DEFAULT_PLATFORM_FEES = {
  deposit_fixed_cents: 75,
  withdraw_fixed_cents: 300,
} as const;
const feesSchema = z.object({
  deposit_fixed_cents: z.number().int().min(0).max(100_000_000),
  withdraw_fixed_cents: z.number().int().min(0).max(100_000_000),
});

export const getAgpayFees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    return getSetting("agpay_fees", DEFAULT_PLATFORM_FEES);
  });

export const saveAgpayFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => feesSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    await setSetting("agpay_fees", data, context.userId);
    return { ok: true as const };
  });
