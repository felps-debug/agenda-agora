import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { classifyLifecycle, isBusinessTrial, shouldAutoCancel } from "@/lib/subscription-lifecycle";
import { getSetting } from "@/lib/platform-settings.server";
import { fetchAllPages } from "@/lib/fetch-all-pages.server";

/**
 * Varredura automática do ciclo de assinaturas (Painel 3 Master).
 *
 * Chamada pelo agendador externo com `Authorization: Bearer AGENDA_CRON_SECRET`. Os avisos são únicos por estabelecimento, vencimento e estágio; a chave única do banco evita duplicatas concorrentes sem suprimir avisos do próximo ciclo.
 *
 * Regras de aviso (dias calculados das datas reais):
 * - Em teste: 3 dias restantes, 1 dia, último dia.
 * - Assinante: fatura vence em 7 / 3 / 1 dias e no dia do vencimento.
 * - Recuperação: dia 1 (pendente), dia 3 (fim da tolerância), dia 4 (acesso do
 *   dono bloqueado — estágio "bloqueado" existente), dia 7 (recuperação comercial).
 * - Dia 15: cancela automaticamente somente quando lifecycle_auto_cancel_enabled esta ligada; default desligado.
 */
export const Route = createFileRoute("/api/public/hooks/subscription-lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin;

        let businesses;
        try {
          businesses = await fetchAllPages(
            (from, to) =>
              supabaseAdmin
                .from("businesses")
                .select("id, status, trial_days, access_until, cancel_requested_at, cancelled_at")
                .order("id", { ascending: true })
                .range(from, to),
            "Falha ao carregar estabelecimentos.",
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Falha ao carregar estabelecimentos.";
          return Response.json({ error: message }, { status: 500 });
        }
        const autoCancelEnabled = await getSetting<boolean>("lifecycle_auto_cancel_enabled", false);
        const scannedBusinessIds = businesses.map((business) => business.id);
        const [paymentsRes, chargesRes] = await Promise.all([
          db
            .from("subscription_payments")
            .select("business_id")
            .eq("status", "pago")
            .in("business_id", scannedBusinessIds),
          db
            .from("subscription_charges")
            .select("business_id")
            .eq("status", "paid")
            .in("business_id", scannedBusinessIds),
        ]);
        if (paymentsRes.error)
          return Response.json({ error: paymentsRes.error.message }, { status: 500 });
        if (chargesRes.error)
          return Response.json({ error: chargesRes.error.message }, { status: 500 });
        const paidBusinessIds = new Set([
          ...(paymentsRes.data ?? []).map((payment) => payment.business_id),
          ...(chargesRes.data ?? []).map((charge) => charge.business_id),
        ]);

        type Notice = { businessId: string; title: string };
        const notices: Notice[] = [];
        let cancellationsCreated = 0;

        for (const business of businesses) {
          const isTrial = isBusinessTrial(business.trial_days, paidBusinessIds.has(business.id));
          if (
            shouldAutoCancel({
              autoCancelEnabled,
              isTrial,
              cancelledAt: business.cancelled_at,
              accessUntil: business.access_until,
            })
          ) {
            const { data: cancelled, error: cancelError } = await supabaseAdmin.rpc(
              "cancel_overdue_business",
              {
                p_business_id: business.id,
              },
            );
            if (cancelError) return Response.json({ error: cancelError.message }, { status: 500 });
            if (cancelled) cancellationsCreated += 1;
            continue;
          }
          const lifecycle = classifyLifecycle({
            status: business.status,
            isTrial,
            accessUntil: business.access_until,
            cancelRequestedAt: business.cancel_requested_at,
            cancelledAt: business.cancelled_at,
          });

          if (lifecycle.category === "em_teste" && lifecycle.trialAlert != null) {
            notices.push({
              businessId: business.id,
              title:
                lifecycle.trialAlert === 3
                  ? "Teste acaba em 3 dias"
                  : lifecycle.trialAlert === 1
                    ? "Teste acaba amanhã"
                    : "Teste acaba hoje",
            });
          } else if (lifecycle.category === "assinante" && lifecycle.dueAlert != null) {
            notices.push({
              businessId: business.id,
              title:
                lifecycle.dueAlert === 7
                  ? "Fatura vence em 7 dias"
                  : lifecycle.dueAlert === 3
                    ? "Fatura vence em 3 dias"
                    : lifecycle.dueAlert === 1
                      ? "Fatura vence amanhã"
                      : "Fatura vence hoje",
            });
          } else if (lifecycle.reason === "pagamento_pendente") {
            notices.push({
              businessId: business.id,
              title:
                lifecycle.daysLate === 1
                  ? "Pagamento pendente (dia 1)"
                  : lifecycle.daysLate >= 3
                    ? "Último dia de tolerância (dia 3)"
                    : "Pagamento pendente",
            });
          } else if (lifecycle.reason === "assinatura_vencida") {
            if (lifecycle.daysLate === 4) {
              notices.push({ businessId: business.id, title: "Assinatura vencida (dia 4)" });
            }
            if (lifecycle.daysLate === 7) {
              notices.push({ businessId: business.id, title: "Recuperação comercial (dia 7)" });
            }
          }
        }

        let created = 0;
        let skipped = 0;

        const accessUntilByBusiness = new Map(
          businesses.map((business) => [business.id, business.access_until]),
        );
        const toInsert = notices.map((notice) => {
          const accessUntil = accessUntilByBusiness.get(notice.businessId);
          const cycle = accessUntil ? new Date(accessUntil).toISOString() : "sem-vencimento";
          return {
            business_id: notice.businessId,
            actor_id: null,
            type: "assinatura",
            title: notice.title,
            dedupe_key: `${cycle}|${notice.title}`,
          };
        });

        if (toInsert.length) {
          const { data: inserted, error: insertError } = await supabaseAdmin
            .from("master_business_events")
            .upsert(toInsert, { onConflict: "business_id,dedupe_key", ignoreDuplicates: true })
            .select("id");
          if (insertError) return Response.json({ error: insertError.message }, { status: 500 });
          created = inserted?.length ?? 0;
        }

        skipped = notices.length - created;

        const { count: cleanedAttempts, error: cleanupError } = await db
          .from("auth_attempts")
          .delete({ count: "exact" })
          .lt("updated_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
        if (cleanupError) return Response.json({ error: cleanupError.message }, { status: 500 });
        const completedAt = Date.now();
        const { error: runError } = await db.from("subscription_lifecycle_runs").insert({
          started_at: new Date(startedAt).toISOString(),
          completed_at: new Date(completedAt).toISOString(),
          elapsed_ms: completedAt - startedAt,
          businesses_scanned: businesses.length,
          notices_created: created,
          cancellations_created: cancellationsCreated,
          auth_attempts_cleaned: cleanedAttempts ?? 0,
        });
        if (runError) return Response.json({ error: runError.message }, { status: 500 });
        return Response.json({
          created,
          skipped,
          cancellationsCreated,
          cleanedAttempts: cleanedAttempts ?? 0,
        });
      },
    },
  },
});
