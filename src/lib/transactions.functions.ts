import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";

const filterSchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
  depositStatus: z.string().optional(),
  withdrawalStatus: z.string().optional(),
});

export type TransactionRow = {
  id: string;
  uuid: string;
  kind: "deposit" | "withdrawal";
  clientName: string;
  email: string;
  type: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  status: string;
  date: string;
  businessId: string | null;
  businessName: string | null;
};

export type TransactionsData = {
  deposits: TransactionRow[];
  withdrawals: TransactionRow[];
  metrics: {
    totalDeposits: number;
    totalWithdrawals: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    totalProcessedCents: number;
  };
};

export const getTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filterSchema.parse(data ?? {}))
  .handler(async ({ context }): Promise<TransactionsData> => {
    const supabaseAdmin = await assertSuperAdmin(context);

    const { data: deposits } = await supabaseAdmin
      .from("deposit_payments")
      .select("id, business_id, amount_cents, gateway_fee_cents, platform_commission_cents, net_amount_cents, status, created_at, payer_email, payer_name")
      .order("created_at", { ascending: false })
      .limit(2000);

    const { data: withdrawals } = await supabaseAdmin
      .from("withdrawals")
      .select("id, business_id, amount_cents, platform_fee_cents, provider_fee_cents, status, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    const { data: businesses } = await supabaseAdmin.from("businesses").select("id, name, owner_id");
    const bizMap = new Map((businesses ?? []).map((b) => [b.id, b]));
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, email");
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const depositRows: TransactionRow[] = (deposits ?? []).map((d) => {
      const b = bizMap.get(d.business_id);
      const owner = b?.owner_id ? profMap.get(b.owner_id) : null;
      const fee = (d.gateway_fee_cents ?? 0) + (d.platform_commission_cents ?? 0);
      return {
        id: `#${d.id.slice(-4)}`,
        uuid: d.id,
        kind: "deposit",
        clientName: (d.payer_name || b?.name || owner?.full_name || "—").toUpperCase(),
        email: d.payer_email || owner?.email || "—",
        type: "PIX",
        grossCents: d.amount_cents,
        feeCents: fee,
        netCents: d.net_amount_cents ?? d.amount_cents - fee,
        status: (d.status ?? "pendente").toUpperCase(),
        date: d.created_at,
        businessId: d.business_id,
        businessName: b?.name ?? null,
      };
    });

    const withdrawalRows: TransactionRow[] = (withdrawals ?? []).map((w) => {
      const b = bizMap.get(w.business_id);
      const owner = b?.owner_id ? profMap.get(b.owner_id) : null;
      const fee = (w.platform_fee_cents ?? 0) + (w.provider_fee_cents ?? 0);
      return {
        id: `#${w.id.slice(-4)}`,
        uuid: w.id,
        kind: "withdrawal",
        clientName: (b?.name || owner?.full_name || "—").toUpperCase(),
        email: owner?.email || "—",
        type: "SAQUE",
        grossCents: w.amount_cents,
        feeCents: fee,
        netCents: w.amount_cents - fee,
        status: (w.status ?? "pendente").toUpperCase(),
        date: w.created_at,
        businessId: w.business_id,
        businessName: b?.name ?? null,
      };
    });

    const pendingDeposits = depositRows.filter((r) => r.status.includes("PEND") || r.status === "AGUARDANDO").length;
    const pendingWithdrawals = withdrawalRows.filter((r) => r.status.includes("PEND") || r.status.includes("SOLICIT")).length;
    const totalProcessedCents =
      depositRows.filter((r) => r.status === "PAGO" || r.status === "PAID").reduce((s, r) => s + r.grossCents, 0) +
      withdrawalRows.filter((r) => r.status.includes("CONCL") || r.status.includes("COMPLET")).reduce((s, r) => s + r.grossCents, 0);

    return {
      deposits: depositRows,
      withdrawals: withdrawalRows,
      metrics: {
        totalDeposits: depositRows.length,
        totalWithdrawals: withdrawalRows.length,
        pendingDeposits,
        pendingWithdrawals,
        totalProcessedCents,
      },
    };
  });
