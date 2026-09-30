import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { expirePendingDeposits, processAgpayWebhookEvents } from "@/lib/agpay-events.server";

export const Route = createFileRoute("/api/public/hooks/agpay-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        try {
          const [events, expirations] = await Promise.all([
            processAgpayWebhookEvents(25),
            expirePendingDeposits(25),
          ]);
          return Response.json({
            ok: true,
            events,
            expirations,
            ranAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Falha no worker AgPay:", error);
          return Response.json({ error: "Worker failed" }, { status: 500 });
        }
      },
    },
  },
});
