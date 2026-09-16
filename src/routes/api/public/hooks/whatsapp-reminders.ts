import { createFileRoute } from "@tanstack/react-router";
import { sendBookingReminder } from "@/lib/whatsapp-notify.server";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Agendador de lembretes de WhatsApp: chamado pelo Cron do Lovable a cada hora.
// Envia o lembrete para agendamentos confirmados cuja janela de aviso abriu
// (starts_at <= agora + reminder_hours_before) e que ainda não foram lembrados.
export const Route = createFileRoute("/api/public/hooks/whatsapp-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const now = new Date();
        const { data: businesses, error: bizErr } = await supabaseAdmin
          .from("businesses")
          .select("id, reminder_hours_before")
          .eq("reminder_enabled", true)
          .eq("whatsapp_status", "conectado")
          .not("whatsapp_instance", "is", null)
          .eq("status", "ativo");
        if (bizErr) {
          return Response.json({ error: bizErr.message }, { status: 500 });
        }

        let sent = 0;
        let failed = 0;

        for (const biz of businesses ?? []) {
          const hoursBefore = biz.reminder_hours_before ?? 24;
          const windowEnd = new Date(now.getTime() + hoursBefore * 3_600_000);

          const { data: appts } = await supabaseAdmin
            .from("appointments")
            .select("id")
            .eq("business_id", biz.id)
            .in("status", ["agendado", "confirmado"])
            .gt("starts_at", now.toISOString())
            .lte("starts_at", windowEnd.toISOString());
          if (!appts?.length) continue;

          const ids = appts.map((a) => a.id);
          const { data: logs } = await supabaseAdmin
            .from("reminder_logs")
            .select("appointment_id")
            .eq("channel", "whatsapp")
            .in("appointment_id", ids);
          const alreadySent = new Set((logs ?? []).map((l) => l.appointment_id));

          for (const appt of appts) {
            if (alreadySent.has(appt.id)) continue;
            try {
              await sendBookingReminder(appt.id);
              await supabaseAdmin.from("reminder_logs").insert({
                business_id: biz.id,
                appointment_id: appt.id,
                channel: "whatsapp",
                status: "enviado",
              });
              sent++;
            } catch (err) {
              failed++;
              await supabaseAdmin.from("reminder_logs").insert({
                business_id: biz.id,
                appointment_id: appt.id,
                channel: "whatsapp",
                status: "erro",
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }

        return Response.json({
          ok: true,
          sent,
          failed,
          businesses: businesses?.length ?? 0,
          ranAt: now.toISOString(),
        });
      },
    },
  },
});
