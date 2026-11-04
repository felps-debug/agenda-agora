import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";

export type SidebarMasterStats = {
  signupsToday: number;
  recentSignups: Array<{ id: string; name: string; createdAt: string }>;
  recentPayments: Array<{ id: string; businessName: string; amountCents: number; createdAt: string }>;
};

export const getSidebarMasterStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SidebarMasterStats> => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: businesses } = await supabaseAdmin
      .from("businesses")
      .select("id, created_at")
      .gte("created_at", today.toISOString());
    const signupsToday = (businesses ?? []).length;

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentBusinesses } = await supabaseAdmin
      .from("businesses")
      .select("id, name, created_at")
      .gte("created_at", threeDaysAgo)
      .order("created_at", { ascending: false })
      .limit(20);
    const recentSignups = (recentBusinesses ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      createdAt: b.created_at,
    }));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: payments } = await supabaseAdmin
      .from("subscription_payments")
      .select("id, business_id, amount_cents, created_at, status")
      .eq("status", "pago")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: bizs } = await supabaseAdmin.from("businesses").select("id, name");
    const nameMap = new Map((bizs ?? []).map((b) => [b.id, b.name]));
    const recentPayments = (payments ?? []).map((p) => ({
      id: p.id,
      businessName: nameMap.get(p.business_id) ?? "—",
      amountCents: p.amount_cents,
      createdAt: p.created_at,
    }));
    return { signupsToday, recentSignups, recentPayments };
  });
