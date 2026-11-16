import { createFileRoute } from "@tanstack/react-router";
import {
  isReminderDue,
  sendBookingReminder,
  sendExtraBookingReminder,
} from "@/lib/whatsapp-notify.server";
import { loadPanel1Config } from "@/lib/panel1-config.storage";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import {
  processPendingIncomingWhatsappGreetings,
  processPostServiceMessages,
} from "@/lib/whatsapp-greeting.server";

// Agendador de lembretes de WhatsApp: chamado pelo cron da infraestrutura a cada hora.
// Envia o lembrete para agendamentos confirmados cuja janela de aviso abriu
// (starts_at <= agora + reminder_hours_before) e que ainda não foram lembrados.
export const Route = createFileRoute("/api/public/hooks/whatsapp-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;

        let incomingGreetings = { processed: 0, sent: 0, skipped: 0, failed: 0 };
        try {
          incomingGreetings = await processPendingIncomingWhatsappGreetings({ limit: 50 });
        } catch {
          console.error("Falha ao processar fila de saudações recebidas.");
          incomingGreetings.failed++;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const reminderRpc = supabaseAdmin as unknown as {
          rpc: (
            name: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: { message: string } | null }>;
        };

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

          const { data: appts, error: apptsError } = await supabaseAdmin
            .from("appointments")
            .select("id, starts_at")
            .eq("business_id", biz.id)
            .in("status", ["agendado", "confirmado"])
            .gt("starts_at", now.toISOString())
            .lte("starts_at", windowEnd.toISOString());
          if (apptsError) {
            return Response.json({ error: apptsError.message }, { status: 500 });
          }
          if (!appts?.length) continue;

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
              if (!reminder.shouldSend) continue;
              const { data: claimToken, error: claimError } = await reminderRpc.rpc(
                "claim_whatsapp_reminder",
                {
                  p_business_id: biz.id,
                  p_appointment_id: appt.id,
                  p_channel: reminder.channel,
                },
              );
              if (claimError) {
                return Response.json({ error: "Falha ao reservar o lembrete." }, { status: 500 });
              }
              if (typeof claimToken !== "string") continue;

              try {
                await reminder.send();
              } catch (err) {
                const { data: finished, error: finishError } = await reminderRpc.rpc(
                  "finish_whatsapp_reminder",
                  {
                    p_business_id: biz.id,
                    p_appointment_id: appt.id,
                    p_channel: reminder.channel,
                    p_claim_token: claimToken,
                    p_sent: false,
                    p_error: err instanceof Error ? err.message : String(err),
                  },
                );
                if (finishError || finished !== true) {
                  return Response.json(
                    { error: "Falha ao registrar o erro do lembrete." },
                    { status: 500 },
                  );
                }
                failed++;
                continue;
              }

              const { data: finished, error: finishError } = await reminderRpc.rpc(
                "finish_whatsapp_reminder",
                {
                  p_business_id: biz.id,
                  p_appointment_id: appt.id,
                  p_channel: reminder.channel,
                  p_claim_token: claimToken,
                  p_sent: true,
                  p_error: null,
                },
              );
              if (finishError || finished !== true) {
                return Response.json(
                  { error: "Falha ao registrar o envio do lembrete." },
                  { status: 500 },
                );
              }
              sent++;
            }
          }
        }

        const postService = await processPostServiceMessages();

        return Response.json({
          ok: true,
          sent,
          failed,
          businesses: businesses?.length ?? 0,
          postService,
          incomingGreetings,
          ranAt: now.toISOString(),
        });
      },
    },
  },
});
