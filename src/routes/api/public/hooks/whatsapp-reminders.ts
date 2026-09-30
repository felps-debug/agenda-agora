import { createFileRoute } from "@tanstack/react-router";
import {
  isReminderDue,
  sendBookingReminder,
  sendExtraBookingReminder,
} from "@/lib/whatsapp-notify.server";
import { loadPanel1Config } from "@/lib/panel1-config.storage";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Agendador de lembretes de WhatsApp: chamado pelo cron da infraestrutura a cada hora.
// Envia o lembrete para agendamentos confirmados cuja janela de aviso abriu
// (starts_at <= agora + reminder_hours_before) e que ainda não foram lembrados.
export const Route = createFileRoute("/api/public/hooks/whatsapp-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const { data: businesses, error: bizErr } = await supabaseAdmin
          .from("businesses")
          .select("id, reminder_hours_before")
          .eq("reminder_enabled", true)
          .eq("status", "ativo");
        if (bizErr) {
          return Response.json({ error: bizErr.message }, { status: 500 });
        }

        let sent = 0;
        let failed = 0;

        for (const biz of businesses ?? []) {
          const { preferences } = await loadPanel1Config(supabaseAdmin, biz.id);
          const hoursBefore = biz.reminder_hours_before ?? 24;
          const extraMinutes = preferences.extra_reminder_minutes;
          const windowEnd = new Date(
            now.getTime() + Math.max(hoursBefore * 60, extraMinutes) * 60_000,
          );

          const { data: appts } = await supabaseAdmin
            .from("appointments")
            .select("id, starts_at")
            .eq("business_id", biz.id)
            .in("status", ["agendado", "confirmado"])
            .gt("starts_at", now.toISOString())
            .lte("starts_at", windowEnd.toISOString());
          if (!appts?.length) continue;

          const ids = appts.map((a) => a.id);
          const { data: logs } = await supabaseAdmin
            .from("reminder_logs")
            .select("appointment_id, channel")
            .in("channel", ["whatsapp", "whatsapp-extra"])
            .in("appointment_id", ids);
          const alreadySent = new Set((logs ?? []).map((l) => `${l.appointment_id}:${l.channel}`));

          for (const appt of appts) {
            const appointment = appt as { id: string; starts_at: string };
            const due = [
              {
                channel: "whatsapp",
                shouldSend: isReminderDue(appointment.starts_at, now, hoursBefore * 60),
                send: () => sendBookingReminder(appt.id),
              },
              {
                channel: "whatsapp-extra",
                shouldSend:
                  extraMinutes > 0 && isReminderDue(appointment.starts_at, now, extraMinutes),
                send: () => sendExtraBookingReminder(appt.id, preferences.extra_reminder_template),
              },
            ];
            for (const reminder of due) {
              if (!reminder.shouldSend || alreadySent.has(`${appt.id}:${reminder.channel}`))
                continue;
              try {
                await reminder.send();
                await supabaseAdmin.from("reminder_logs").insert({
                  business_id: biz.id,
                  appointment_id: appt.id,
                  channel: reminder.channel,
                  status: "enviado",
                });
                sent++;
              } catch (err) {
                failed++;
                await supabaseAdmin.from("reminder_logs").insert({
                  business_id: biz.id,
                  appointment_id: appt.id,
                  channel: reminder.channel,
                  status: "erro",
                  error: err instanceof Error ? err.message : String(err),
                });
              }
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
