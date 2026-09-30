import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useBusiness } from "@/lib/business";
import {
  getOutreachBusinessSettings,
  saveOutreachBusinessSettings,
} from "@/lib/outreach-templates.functions";
import { sendTestMessage } from "@/lib/whatsapp.functions";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/painel/lembretes")({
  head: () => ({
    meta: [
      { title: "Lembretes — Agenda Agora" },
      { name: "description", content: "Configure as mensagens automáticas de WhatsApp." },
    ],
  }),
  component: LembretesPage,
});

type Settings = {
  selectedTemplateIds: string[];
  confirmationTemplate: string;
  paymentConfirmationTemplate: string;
  reminderTemplate: string;
  reminderHoursBefore: number;
};

const MESSAGE_FIELDS = [
  ["confirmationTemplate", "Confirmação do agendamento"],
  ["paymentConfirmationTemplate", "Confirmação do sinal"],
  ["reminderTemplate", "Lembrete"],
] as const;
const TOKENS = ["nome", "servico", "hora", "data", "negocio"];

function placeholdersAreValid(text: string) {
  return [...text.matchAll(/\{([^{}]+)\}/g)].every((match) => TOKENS.includes(match[1] ?? ""));
}

function LembretesPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getOutreachBusinessSettings);
  const saveSettingsFn = useServerFn(saveOutreachBusinessSettings);
  const testFn = useServerFn(sendTestMessage);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["outreach-business-settings", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const value = await getSettingsFn({ data: { businessId: businessId! } });
      return {
        selectedTemplateIds: value.selectedTemplateIds,
        confirmationTemplate: value.confirmationTemplate,
        paymentConfirmationTemplate: value.paymentConfirmationTemplate,
        reminderTemplate: value.reminderTemplate,
        reminderHoursBefore: value.reminderHoursBefore,
      } satisfies Settings;
    },
  });

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (value: Settings) =>
      saveSettingsFn({ data: { businessId: businessId!, ...value } }),
    onSuccess: async () => {
      toast.success("Configurações salvas.");
      await queryClient.invalidateQueries({ queryKey: ["outreach-business-settings", businessId] });
    },
    onError: () => toast.error("Não foi possível salvar as configurações. Tente novamente."),
  });

  const test = useMutation({
    mutationFn: (vars: { key: string; template: string }) =>
      testFn({ data: { businessId: businessId!, phone: testPhone, template: vars.template } }),
    onMutate: (vars) => setTestingKey(vars.key),
    onSuccess: () => toast.success("Mensagem de teste enviada."),
    onError: (error: Error) =>
      toast.error(error.message || "Não foi possível enviar a mensagem de teste."),
    onSettled: () => setTestingKey(null),
  });

  const hasInvalidPlaceholder = useMemo(
    () => !!draft && MESSAGE_FIELDS.some(([key]) => !placeholdersAreValid(draft[key])),
    [draft],
  );
  // Aceita com ou sem o "55" do país na frente (o servidor normaliza do mesmo jeito).
  const testPhoneDigits = testPhone.replace(/\D/g, "");
  const testPhoneValid = /^\d{10,13}$/.test(testPhoneDigits);
  const testPhoneTouched = testPhoneDigits.length > 0;

  if (!businessId) return <NoBusiness />;
  if (!draft && settings.isLoading) return <p role="status">Carregando lembretes...</p>;
  if (settings.isError) {
    return (
      <p role="alert">
        Não foi possível carregar os lembretes. Atualize a página e tente novamente.
      </p>
    );
  }
  if (!draft) return <p role="status">Carregando configurações...</p>;

  const patchDraft = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lembretes"
        subtitle="Mensagens automáticas de WhatsApp enviadas pro cliente."
      />

      <section aria-labelledby="outreach-messages-title" className="surface space-y-5 p-5">
        <div>
          <h2 id="outreach-messages-title" className="text-lg font-bold">
            Mensagens automáticas
          </h2>
          <p className="text-sm text-muted-foreground">
            Use os campos entre chaves para preencher os dados do agendamento.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="testPhone">Número para teste</Label>
          <Input
            id="testPhone"
            type="tel"
            placeholder="(99) 99999-9999"
            value={testPhone}
            onChange={(event) => setTestPhone(event.target.value)}
            aria-invalid={testPhoneTouched && !testPhoneValid}
            className="max-w-xs"
          />
          {testPhoneTouched && !testPhoneValid ? (
            <p role="alert" className="text-sm text-destructive">
              Número inválido. Informe DDD + número (10 ou 11 dígitos), com ou sem o 55 do país.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Informe o número que vai receber os testes de cada mensagem abaixo. Os botões "Testar"
              só ficam ativos com um número válido aqui.
            </p>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {MESSAGE_FIELDS.map(([key, label]) => (
            <div key={key} className="flex flex-col space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Textarea
                id={key}
                rows={6}
                maxLength={2000}
                className="resize-none"
                aria-invalid={!placeholdersAreValid(draft[key])}
                aria-describedby={!placeholdersAreValid(draft[key]) ? `${key}-error` : undefined}
                value={draft[key]}
                onChange={(event) => patchDraft(key, event.target.value)}
              />
              {!placeholdersAreValid(draft[key]) && (
                <p id={`${key}-error`} role="alert" className="text-sm text-destructive">
                  Remova os campos não reconhecidos.
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-fit"
                disabled={
                  !testPhoneValid || testingKey !== null || !placeholdersAreValid(draft[key])
                }
                onClick={() => test.mutate({ key, template: draft[key] })}
              >
                <Send className="size-4" />
                {testingKey === key ? "Enviando..." : "Testar"}
              </Button>
            </div>
          ))}
        </div>

        <div className="max-w-xs space-y-2">
          <Label htmlFor="reminderHoursBefore">Antecedência do lembrete (horas)</Label>
          <Input
            id="reminderHoursBefore"
            type="number"
            min={1}
            max={168}
            aria-invalid={draft.reminderHoursBefore < 1 || draft.reminderHoursBefore > 168}
            aria-describedby="reminder-hours-help"
            value={draft.reminderHoursBefore}
            onChange={(event) => patchDraft("reminderHoursBefore", Number(event.target.value))}
          />
          <p id="reminder-hours-help" className="text-xs text-muted-foreground">
            Informe um valor entre 1 e 168 horas.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Campos disponíveis: {TOKENS.map((token) => `{${token}}`).join(", ")}. O teste usa dados
          fictícios de exemplo.
        </p>
        <Button
          type="button"
          disabled={
            save.isPending ||
            hasInvalidPlaceholder ||
            draft.reminderHoursBefore < 1 ||
            draft.reminderHoursBefore > 168
          }
          onClick={() => save.mutate(draft)}
        >
          {save.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </section>
    </div>
  );
}
