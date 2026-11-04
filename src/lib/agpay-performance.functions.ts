import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const periodSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export type AgpayPerformanceData = {
  period: { from: string; to: string };
  kpi: {
    signalCount: number;
    signalVolumeCents: number;
    revenueCents: number;
    gatewayFeeCents: number;
    estimatedProfitCents: number;
    avgSignalCents: number;
    avgRevenuePerTx: number;
    businessesWithSignals: number;
    totalBusinesses: number;
    pendingWithdrawalsCount: number;
    pendingWithdrawalsCents: number;
    completedWithdrawalsCount: number;
    completedWithdrawalsCents: number;
    withdrawalFeesCents: number;
  };
  daily: Array<{
    date: string;
    volumeCents: number;
    revenueCents: number;
    gatewayFeeCents: number;
    profitCents: number;
    count: number;
  }>;
  businesses: Array<{
    businessId: string;
    name: string;
    ownerName: string | null;
    signalCount: number;
    volumeCents: number;
    revenueCents: number;
    profitCents: number;
    lastTxAt: string | null;
    pendingWithdrawals: number;
  }>;
  signals: Array<{
    id: string;
    businessId: string;
    businessName: string;
    appointmentId: string | null;
    amountCents: number;
    revenueCents: number;
    gatewayFeeCents: number;
    profitCents: number;
    status: string;
    providerStatus: string | null;
    paidAt: string | null;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    businessId: string;
    businessName: string;
    amountCents: number;
    platformFeeCents: number;
    providerFeeCents: number | null;
    netCents: number;
    status: string;
    providerRef: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export const getAgpayPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => periodSchema.parse(data))
  .handler(async ({ context, data }): Promise<AgpayPerformanceData> => {
    const supabaseAdmin = await assertSuperAdmin(context);

    const from = data.from;
    const to = data.to;

    // businesses
    const { data: businesses } = await supabaseAdmin
      .from("businesses")
      .select("id, name, owner_id");
    const bizMap = new Map((businesses ?? []).map((b) => [b.id, b]));
    const { data: owners } = await supabaseAdmin.from("profiles").select("id, full_name");
    const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.full_name]));

    // deposit payments in period (by paid_at or created_at)
    const { data: deposits } = await supabaseAdmin
      .from("deposit_payments")
      .select(
        "id, business_id, appointment_id, amount_cents, status, provider_status, gateway_fee_cents, platform_commission_cents, net_amount_cents, paid_at, created_at",
      )
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .limit(5000);

    // withdrawals in period
    const { data: withdrawals } = await supabaseAdmin
      .from("withdrawals")
      .select("id, business_id, amount_cents, platform_fee_cents, provider_fee_cents, status, provider_ref, created_at, updated_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .limit(5000);

    // Aggregations
    let signalCount = 0;
    let signalVolumeCents = 0;
    let revenueCents = 0;
    let gatewayFeeCents = 0;
    let estimatedProfitCents = 0;
    const bizAgg = new Map<
      string,
      { signalCount: number; volumeCents: number; revenueCents: number; profitCents: number; lastTxAt: string | null; pendingWithdrawals: number }
    >();
    const dailyMap = new Map<string, { volumeCents: number; revenueCents: number; gatewayFeeCents: number; profitCents: number; count: number }>();

    const signalsOut: AgpayPerformanceData["signals"] = [];

    for (const d of deposits ?? []) {
      const isPaid = d.status === "pago" || d.status === "paid" || !!d.paid_at;
      const rev = d.platform_commission_cents ?? 0;
      const gw = d.gateway_fee_cents ?? 0;
      // Lucro = comissão da plataforma gravada no ledger (a tarifa do gateway é descontada do dono).
      const profit = rev;
      signalsOut.push({
        id: d.id,
        businessId: d.business_id,
        businessName: bizMap.get(d.business_id)?.name ?? "—",
        appointmentId: d.appointment_id,
        amountCents: d.amount_cents,
        revenueCents: rev,
        gatewayFeeCents: gw,
        profitCents: profit,
        status: d.status,
        providerStatus: d.provider_status,
        paidAt: d.paid_at,
        createdAt: d.created_at,
      });

      if (isPaid) {
        signalCount += 1;
        signalVolumeCents += d.amount_cents;
        revenueCents += rev;
        gatewayFeeCents += gw;
        estimatedProfitCents += profit;

        const biz = bizAgg.get(d.business_id) ?? { signalCount: 0, volumeCents: 0, revenueCents: 0, profitCents: 0, lastTxAt: null, pendingWithdrawals: 0 };
        biz.signalCount += 1;
        biz.volumeCents += d.amount_cents;
        biz.revenueCents += rev;
        biz.profitCents += profit;
        if (!biz.lastTxAt || d.created_at > biz.lastTxAt) biz.lastTxAt = d.created_at;
        bizAgg.set(d.business_id, biz);

        const day = d.created_at.slice(0, 10);
        const dd = dailyMap.get(day) ?? { volumeCents: 0, revenueCents: 0, gatewayFeeCents: 0, profitCents: 0, count: 0 };
        dd.volumeCents += d.amount_cents;
        dd.revenueCents += rev;
        dd.gatewayFeeCents += gw;
        dd.profitCents += profit;
        dd.count += 1;
        dailyMap.set(day, dd);
      }
    }

    // pending withdrawals count/value
    let pendingWithdrawalsCount = 0;
    let pendingWithdrawalsCents = 0;
    let completedWithdrawalsCount = 0;
    let completedWithdrawalsCents = 0;
    let withdrawalFeesCents = 0;

    const withdrawalsOut: AgpayPerformanceData["withdrawals"] = [];
    for (const w of withdrawals ?? []) {
      const biz = bizMap.get(w.business_id);
      withdrawalsOut.push({
        id: w.id,
        businessId: w.business_id,
        businessName: biz?.name ?? "—",
        amountCents: w.amount_cents,
        platformFeeCents: w.platform_fee_cents,
        providerFeeCents: w.provider_fee_cents,
        netCents: w.amount_cents - (w.platform_fee_cents ?? 0) - (w.provider_fee_cents ?? 0),
        status: w.status,
        providerRef: w.provider_ref,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      });

      const st = (w.status ?? "").toLowerCase();
      if (st.includes("pend") || st === "solicitado" || st === "aprovado") {
        pendingWithdrawalsCount += 1;
        pendingWithdrawalsCents += w.amount_cents;
      }
      if (st.includes("conclu") || st === "completed" || st === "pago") {
        completedWithdrawalsCount += 1;
        completedWithdrawalsCents += w.amount_cents;
        withdrawalFeesCents += (w.platform_fee_cents ?? 0) + (w.provider_fee_cents ?? 0);
      }

      // pending withdrawals per business
      if (st.includes("pend") || st === "solicitado" || st === "aprovado") {
        const agg = bizAgg.get(w.business_id) ?? { signalCount: 0, volumeCents: 0, revenueCents: 0, profitCents: 0, lastTxAt: null, pendingWithdrawals: 0 };
        agg.pendingWithdrawals += 1;
        bizAgg.set(w.business_id, agg);
      }
    }

    const businessesOut = Array.from(bizAgg.entries()).map(([id, agg]) => {
      const b = bizMap.get(id);
      return {
        businessId: id,
        name: b?.name ?? "—",
        ownerName: b?.owner_id ? (ownerMap.get(b.owner_id) ?? null) : null,
        signalCount: agg.signalCount,
        volumeCents: agg.volumeCents,
        revenueCents: agg.revenueCents,
        profitCents: agg.profitCents,
        lastTxAt: agg.lastTxAt,
        pendingWithdrawals: agg.pendingWithdrawals,
      };
    });

    const daily = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: { from, to },
      kpi: {
        signalCount,
        signalVolumeCents,
        revenueCents,
        gatewayFeeCents,
        estimatedProfitCents,
        avgSignalCents: signalCount ? Math.round(signalVolumeCents / signalCount) : 0,
        avgRevenuePerTx: signalCount ? Math.round(revenueCents / signalCount) : 0,
        businessesWithSignals: bizAgg.size,
        totalBusinesses: businesses?.length ?? 0,
        pendingWithdrawalsCount,
        pendingWithdrawalsCents,
        completedWithdrawalsCount,
        completedWithdrawalsCents,
        withdrawalFeesCents,
      },
      daily,
      businesses: businessesOut,
      signals: signalsOut,
      withdrawals: withdrawalsOut,
    };
  });
