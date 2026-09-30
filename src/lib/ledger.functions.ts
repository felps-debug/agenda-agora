import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Extrato e saldo do dono do negócio, lidos do ledger (spec 005, FR-005/FR-011). */
export const getLedgerStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { getLedgerStatementForOwner } = await import("./ledger.statement.server");
    return getLedgerStatementForOwner(context.supabase, context.userId, data.businessId, {
      from: data.from,
      to: data.to,
    });
  });
