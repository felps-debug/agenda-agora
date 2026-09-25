import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BellRing, MessageCircle, CheckCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { formatPrice, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel/lembretes")({
  head: () => ({
    meta: [
      { title: "Lembretes — Agenda Agora" },
      { name: "description", content: "Lembre os clientes do horário marcado e reduza faltas." },
      { property: "og:title", content: "Lembretes — Agenda Agora" },
      { property: "og:description", content: "Lembretes de WhatsApp para os agendamentos." },
    ],
  }),
  component: LembretesPage,
});

const DEFAULT_TEMPLATE =
  "Olá {nome}! Lembrete: seu horário de {servico} em {negocio} é {data} às {hora}. Qualquer imprevisto, avisa a gente! 😊";

const DEFAULT_CONFIRMATION =
  "Olá, {nome}! Seu sinal foi recebido e seu horário de {servico} está confirmado para {data} às {hora} em {negocio}. Até lá! ✅";

function buildMessage(template: string, vars: Record<string, string>) {
  return template.replace(/\{(nome|servico|hora|data|negocio)\}/g, (_, k) => vars[k] ?? "");
}

function phoneToWa(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function LembretesPage() {
  const { business, businessId } = useBusiness();
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState<string | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<string | null>(null);
  const [hours, setHours] = useState<number | null>(null);

  const config = useQuery({
    queryKey: ["reminder-config", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select(
          "reminder_enabled, reminder_hours_before, reminder_template, confirmation_template, whatsapp_status",
        )
        .eq("id", businessId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const enabled = config.data?.reminder_enabled ?? false;
  const hoursBefore = hours ?? config.data?.reminder_hours_before ?? 24;
  const messageTemplate = template ?? config.data?.reminder_template ?? DEFAULT_TEMPLATE;
  const confirmationTemplate =
    confirmTemplate ?? config.data?.confirmation_template ?? DEFAULT_CONFIRMATION;
  const whatsappConnected = config.data?.whatsapp_status === "conectado";

  const upcoming = useQuery({
    queryKey: ["reminder-upcoming", businessId, hoursBefore],
    enabled: !!businessId && enabled,
    queryFn: async () => {
      const now = new Date();
      const until = new Date(now.getTime() + hoursBefore * 3_600_000);
      const { data: appts, error } = await supabase
        .from("appointments")
        .select("id, customer_name, customer_phone, starts_at, status, service_id, deposit_cents")
        .eq("business_id", businessId!)
        .in("status", ["agendado", "confirmado"])
        .gte("starts_at", now.toISOString())
        .lte("starts_at", until.toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      const serviceIds = [...new Set((appts ?? []).map((a) => a.service_id).filter(Boolean))];
      const { data: services, error: servicesError } = serviceIds.length
        ? await supabase
            .from("services")
            .select("id, name")
            .in("id", serviceIds as string[])
        : { data: [] as { id: string; name: string }[] };
      if (servicesError) throw servicesError;
      const apptIds = (appts ?? []).map((a) => a.id);
      const { data: logs, error: logsError } = apptIds.length
        ? await supabase
            .from("reminder_logs")
            .select("appointment_id, status, created_at")
            .in("appointment_id", apptIds)
        : { data: [] as { appointment_id: string; status: string; created_at: string }[] };
      if (logsError) throw logsError;
      return (appts ?? []).map((a) => ({
        ...a,
        serviceName: (services ?? []).find((s) => s.id === a.service_id)?.name ?? "Serviço",
        reminder:
          (logs ?? []).find((l) => l.appointment_id === a.id && l.status === "enviado") ?? null,
      }));
    },
    refetchInterval: 60_000,
  });

  const saveConfig = useMutation({
    mutationFn: async (
      patch:
        | { reminder_enabled: boolean }
        | { reminder_hours_before: number }
        | { reminder_template: string }
        | { confirmation_template: string },
    ) => {
      const { data, error } = await supabase
        .from("businesses")
        .update(patch)
        .eq("id", businessId!)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("O negócio não foi encontrado para atualizar.");
    },
    onSuccess: () => {
      toast.success("Configuração salva.");
      void queryClient.invalidateQueries({ queryKey: ["reminder-config", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markSent = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase.from("reminder_logs").insert({
        business_id: businessId!,
        appointment_id: appointmentId,
        channel: "whatsapp",
        status: "enviado",
      });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["reminder-upcoming", businessId] }),
    onError: () => toast.error("O lembrete abriu no WhatsApp, mas o envio não foi registrado."),
  });

  const sendReminder = (a: NonNullable<typeof upcoming.data>[number]) => {
    const wa = phoneToWa(a.customer_phone);
    if (!wa) {
      toast.error("Esse agendamento não tem telefone do cliente.");
      return;
    }
    const d = new Date(a.starts_at);
    const msg = buildMessage(messageTemplate, {
      nome: a.customer_name.split(" ")[0] ?? a.customer_name,
      servico: a.serviceName,
      hora: formatTime(a.starts_at),
      data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      negocio: business?.name ?? "",
    });
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
    markSent.mutate(a.id);
  };

  if (!businessId) return <NoBusiness />;

  return (
    <div>
      <PageHeader
        title="Mensagens automáticas"
        subtitle="Confirmação ao pagar o sinal e lembrete antes do horário — enviadas sozinhas pelo WhatsApp conectado."
      />

      {config.isError && (
        <p role="alert" className="mb-4 rounded-xl border border-destructive/40 p-4 text-sm">
          Não foi possível carregar as configurações. Atualize a página antes de alterá-las.
        </p>
      )}

      <div className="surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Mensagem 1 — Confirmação do agendamento</p>
            <p className="text-xs text-muted-foreground">
              Enviada automaticamente assim que o cliente paga o sinal Pix.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="tpl-confirm">Texto da confirmação</Label>
          <Textarea
            id="tpl-confirm"
            className="mt-1 min-h-20"
            disabled={config.isError}
            value={confirmationTemplate}
            onChange={(e) => setConfirmTemplate(e.target.value)}
            onBlur={() => {
              const v = confirmationTemplate.trim() || DEFAULT_CONFIRMATION;
              setConfirmTemplate(v);
              if (v !== config.data?.confirmation_template)
                saveConfig.mutate({ confirmation_template: v });
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use {"{nome}"}, {"{servico}"}, {"{data}"}, {"{hora}"} e {"{negocio}"} — são substituídos
            automaticamente.
          </p>
        </div>
      </div>

      <div className="surface mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <BellRing className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Mensagem 2 — Lembrete do horário</p>
              <p className="text-xs text-muted-foreground">
                {whatsappConnected
                  ? "Enviada automaticamente na antecedência que você definir."
                  : "Conecte o WhatsApp na página Integrações para o envio automático funcionar."}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={config.isError}
            onCheckedChange={(v) => saveConfig.mutate({ reminder_enabled: v })}
          />
        </div>

        {enabled && (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-[140px_1fr]">
            <div>
              <Label htmlFor="hours">Avisar quantas horas antes</Label>
              <Input
                id="hours"
                type="number"
                min={1}
                max={72}
                disabled={config.isError}
                className="mt-1"
                value={hoursBefore}
                onChange={(e) => setHours(Number(e.target.value))}
                onBlur={() => {
                  const v = Math.min(72, Math.max(1, hoursBefore || 24));
                  setHours(v);
                  if (v !== config.data?.reminder_hours_before)
                    saveConfig.mutate({ reminder_hours_before: v });
                }}
              />
            </div>
            <div>
              <Label htmlFor="tpl">Texto da mensagem</Label>
              <Textarea
                id="tpl"
                className="mt-1 min-h-20"
                disabled={config.isError}
                value={messageTemplate}
                onChange={(e) => setTemplate(e.target.value)}
                onBlur={() => {
                  const v = messageTemplate.trim() || DEFAULT_TEMPLATE;
                  setTemplate(v);
                  if (v !== config.data?.reminder_template)
                    saveConfig.mutate({ reminder_template: v });
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use {"{nome}"}, {"{servico}"}, {"{data}"}, {"{hora}"} e {"{negocio}"} — são
                substituídos automaticamente.
              </p>
            </div>
          </div>
        )}
      </div>

      {enabled && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Clientes a lembrar nas próximas {hoursBefore}h
          </h2>
          {upcoming.isError ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 p-6 text-center text-sm"
            >
              Não foi possível carregar o histórico de lembretes. Tente atualizar a página.
            </p>
          ) : !upcoming.data?.length ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum agendamento confirmado nesse período. 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.data.map((a) => (
                <div key={a.id} className="surface flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.serviceName} ·{" "}
                      {new Date(a.starts_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}{" "}
                      às {formatTime(a.starts_at)}
                      {a.deposit_cents > 0 && ` · sinal ${formatPrice(a.deposit_cents)}`}
                    </p>
                  </div>
                  {a.reminder ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <CheckCheck className="size-4" /> Lembrado
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => sendReminder(a)}>
                      <Send className="size-4" /> Lembrar no WhatsApp
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!enabled && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <MessageCircle className="size-5 shrink-0 text-primary" />
          Ative o lembrete acima para os clientes receberem o aviso automaticamente no WhatsApp, na
          antecedência que você definir. A lista de quem será lembrado aparece aqui.
        </div>
      )}
    </div>
  );
}
