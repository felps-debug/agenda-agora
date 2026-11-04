import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bold, ChevronRight, Italic, Strikethrough } from "lucide-react";
import { useBusiness } from "@/lib/business";
import { APP_HOSTS } from "@/lib/app-hosts";
import {
  getOutreachBusinessSettings,
  saveOutreachBusinessSettings,
} from "@/lib/outreach-templates.functions";
import { FIXED_REMINDER_TEMPLATE } from "@/lib/outreach-message-settings";
import { NoBusiness } from "@/components/painel/PageHeader";
import { AgpayBackground } from "@/components/painel/AgpayBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  saudacaoTemplate: string;
};

const TABS = [
  {
    id: "saudacao",
    label: "Saudação",
    field: "saudacaoTemplate",
    tokens: [
      ["Saudação", "{Saudacao}"],
      ["Cliente", "{Cliente}"],
      ["Link", "{Link}"],
    ],
  },
  {
    id: "resumo",
    label: "Resumo",
    field: "confirmationTemplate",
    tokens: [
      ["Funcionário", "{Funcionario}"],
      ["Horário", "{Horario}"],
      ["Serviço", "{Serviço}"],
      ["Cliente", "{Cliente}"],
      ["Valor", "{Valor}"],
      ["Data", "{Data}"],
    ],
  },
  {
    id: "avisar",
    label: "Avisar",
    field: "reminderTemplate",
    tokens: [
      ["Cliente", "{Cliente}"],
      ["Serviço", "{Serviço}"],
      ["Data", "{Data}"],
      ["Horário", "{Horario}"],
      ["Link", "{Link}"],
    ],
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DEFAULT_SAUDACAO =
  "👋 {negocio} {Cliente}, seja bem-vindo!\n\n📅 Este é o link para você agendar!!\n{Link}";

const TOKENS = [
  "nome",
  "servico",
  "hora",
  "data",
  "negocio",
  "Cliente",
  "Saudacao",
  "Link",
  "Data",
  "Horario",
  "Serviço",
  "Funcionario",
  "Valor",
];

const EMOJIS = [
  "😁",
  "😊",
  "😷",
  "😜",
  "🤗",
  "🥳",
  "😱",
  "💇‍♀️",
  "💇‍♂️",
  "🙏",
  "🙌",
  "👏",
  "🤝",
  "👍",
  "👊",
  "🤞",
  "👈",
  "👋",
  "👉",
  "👇",
  "⚒️",
  "💰",
  "🕗",
  "💈",
  "📅",
  "👤",
  "📍",
  "💖",
  "❤️",
  "🩷",
];

function placeholdersAreValid(text: string) {
  return [...text.matchAll(/\{([^{}]+)\}/g)].every((match) => TOKENS.includes(match[1] ?? ""));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/** Imita a formatação do WhatsApp: *negrito*, _itálico_, ~riscado~. */
function renderWhatsappPreview(text: string) {
  return escapeHtml(text)
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~([^~]+)~/g, "<s>$1</s>")
    .replace(/\n/g, "<br />");
}

function LembretesPage() {
  const { businessId, businesses } = useBusiness();
  const business = businesses.find((b) => b.id === businessId);
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getOutreachBusinessSettings);
  const saveSettingsFn = useServerFn(saveOutreachBusinessSettings);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("saudacao");
  const [started, setStarted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const settings = useQuery({
    queryKey: ["outreach-business-settings", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const value = await getSettingsFn({ data: { businessId: businessId! } });
      return {
        selectedTemplateIds: value.selectedTemplateIds,
        confirmationTemplate: value.confirmationTemplate,
        paymentConfirmationTemplate: value.paymentConfirmationTemplate,
        // Mensagem de lembrete ("Avisar") é fixa do sistema: sempre este texto.
        reminderTemplate: FIXED_REMINDER_TEMPLATE,
        reminderHoursBefore: value.reminderHoursBefore,
        saudacaoTemplate: value.saudacaoTemplate ?? DEFAULT_SAUDACAO,
      } satisfies Settings;
    },
  });

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (value: Settings) =>
      saveSettingsFn({ data: { businessId: businessId!, ...value } }),
    onSuccess: async (result) => {
      if (result.saudacaoPersisted === false) {
        toast.warning(
          "Mensagens salvas, menos a Saudação: rode a migration no Supabase para ativá-la.",
        );
      } else {
        toast.success("Mensagens salvas.");
      }
      await queryClient.invalidateQueries({ queryKey: ["outreach-business-settings", businessId] });
    },
    onError: () => toast.error("Não foi possível salvar as mensagens. Tente novamente."),
  });

  const hasInvalidPlaceholder = useMemo(
    () =>
      !!draft &&
      (["saudacaoTemplate", "confirmationTemplate", "reminderTemplate"] as const).some(
        (key) => !placeholdersAreValid(draft[key]),
      ),
    [draft],
  );

  if (!businessId) return <NoBusiness />;
  if (!started) {
    return (
      <div className="lembretes-blue-screen space-y-6">
        <section aria-label="Configurar mensagens" className="relative w-full px-6 pb-8 pt-10">
          <AgpayBackground
            /* Transição tema -> azul, igual à abertura do Carteira. */
            morphFromTheme
            morphAccentTo="#4A90E2"
            morphLightTo="#8ABAF0"
            morphDelayMs={500}
            morphDurationMs={1200}
            blueWash
            blueEdges
            canvasClassName="pointer-events-none absolute inset-x-0 top-0 z-[1] w-full"
            words={[
              "MENSAGEM",
              "AUTOMÁTICO",
              "WHATSAPP",
              "LEMBRETE",
              "MENSAGEM",
              "WHATSAPP",
              "LEMBRETE",
            ]}
          />
          <div className="relative z-10 mx-auto max-w-xl text-center">
            <p className="lembretes-hero-eyebrow lembretes-fade-slide-up lembretes-delay-1">
              Mensagens <span className="ew-white">Automáticas</span>{" "}
              <span className="ew-white">WhatsApp</span>
            </p>
            <h1 className="lembretes-hero-title lembretes-fade-slide-up lembretes-delay-2 mx-auto mt-4 max-w-md">
              Configure suas <span>Mensagens</span>
            </h1>
            <p className="lembretes-hero-sub lembretes-fade-slide-up lembretes-delay-3 mx-auto mt-6 max-w-md">
              Personalize as mensagens automáticas de Boas vindas, Confirmação de agendamento e
              Lembrete e ajude seus clientes a não esquecerem o horário.
            </p>
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="lembretes-btn-solid lembretes-fade-slide-up lembretes-delay-4 mt-10"
            >
              Configurar Mensagens
              <ChevronRight className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Aviso abaixo" className="lembretes-aviso-outline mt-10">
              Aviso Abaixo
            </button>
            <div className="lembretes-scroll-cue lembretes-fade-slide-up lembretes-delay-6 mt-10">
              <span>Scroll</span>
              <span aria-hidden="true" className="lembretes-scroll-line" />
            </div>
            <div className="lembretes-fade-slide-up lembretes-delay-7 mx-auto mt-14 max-w-md text-left">
              <p className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-10 shrink-0 bg-[var(--c-4a90e2)] shadow-[0_0_8px_var(--c-rgba-74-144-226-a0d8)]"
                />
                <span className="lembretes-hero-eyebrow" style={{ textIndent: 0 }}>
                  Aviso importante
                </span>
              </p>
              <h2 className="lembretes-hero-title small mt-3">
                Cuidado <span>ao editar</span>
              </h2>
              <p className="lembretes-hero-sub mt-4">
                Tome cuidado e não fique mexendo toda hora editando essas frases pré-definidas,
                porque elas são mandadas automaticamente para os seus clientes. Edite com atenção
                para não bagunçar os envios.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }
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

  const activeTabDef = TABS.find((tab) => tab.id === activeTab)!;
  const activeField = activeTabDef.field;
  const activeText = draft[activeField];
  const activeValid = placeholdersAreValid(activeText);

  const sampleVars: Record<string, string> = {
    nome: "João",
    servico: "Corte",
    hora: "10:30",
    data: "23/08",
    negocio: business?.name ?? "seu negócio",
    Cliente: "João",
    Saudacao: "Olá!",
    Link: `https://${APP_HOSTS.public}/agendar/${business?.slug ?? "seu-negocio"}`,
    Data: "23/08/2022",
    Horario: "10:30",
    Serviço: "Corte",
    Funcionario: "José",
    Valor: "35,00",
  };
  const previewHtml = renderWhatsappPreview(
    activeText.replace(
      /\{(nome|servico|hora|data|negocio|Cliente|Saudacao|Link|Data|Horario|Serviço|Funcionario|Valor)\}/g,
      (match, key) => sampleVars[key] ?? match,
    ),
  );

  const restoreCaret = (start: number, end: number) => {
    window.setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    }, 0);
  };

  const insertAtCursor = (insert: string) => {
    const el = textareaRef.current;
    if (!el) {
      patchDraft(activeField, `${activeText}${insert}`);
      return;
    }
    const start = el.selectionStart ?? activeText.length;
    const end = el.selectionEnd ?? activeText.length;
    patchDraft(activeField, activeText.slice(0, start) + insert + activeText.slice(end));
    restoreCaret(start + insert.length, start + insert.length);
  };

  const wrapSelection = (marker: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? activeText.length;
    const end = el?.selectionEnd ?? activeText.length;
    const selected = activeText.slice(start, end) || "texto";
    patchDraft(
      activeField,
      activeText.slice(0, start) + marker + selected + marker + activeText.slice(end),
    );
    restoreCaret(start + marker.length, start + marker.length + selected.length);
  };

  const prefixLines = (prefix: (index: number) => string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? activeText.length;
    const end = el?.selectionEnd ?? activeText.length;
    const lineStart = activeText.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = activeText.indexOf("\n", end);
    const targetEnd = lineEnd === -1 ? activeText.length : lineEnd;
    const lines = activeText.slice(lineStart, targetEnd).split("\n");
    const prefixed = lines.map((line, index) => `${prefix(index)}${line}`).join("\n");
    patchDraft(
      activeField,
      activeText.slice(0, lineStart) + prefixed + activeText.slice(targetEnd),
    );
    restoreCaret(lineStart, lineStart + prefixed.length);
  };

  const hoursInvalid = draft.reminderHoursBefore < 1 || draft.reminderHoursBefore > 168;

  return (
    <div className="lembretes-blue-screen lembretes-static space-y-6">
      <AgpayBackground noCanvas words={[]} blueWash blueEdges />
      <section
        aria-label="Customizar Whatsapp"
        className="mx-auto max-w-xl rounded-2xl border border-[#26262b] bg-[#131316] p-4 sm:p-5"
      >
        <div>
          <h1 className="text-lg font-bold text-white">Customizar Whatsapp</h1>
          <p className="mt-1 text-sm text-[#8a8a92]">
            Personalize as mensagens que seus clientes receberão.
          </p>
        </div>

        <div
          className="mt-3 flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Tipo de mensagem"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black"
                  : "rounded-full px-3 py-1.5 text-sm text-[#8a8a92] transition-colors hover:text-white"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-[var(--c-0d0d10)] p-3">
          <p className="mb-2 text-center text-[0.63rem] font-semibold uppercase tracking-[0.16em] text-[#6d6e76]">
            Como seu cliente vai ver
          </p>
          <div className="rounded-lg bg-[#005c4b] px-4 py-3 text-[0.95rem] leading-relaxed text-white [overflow-wrap:anywhere]">
            <span dangerouslySetInnerHTML={{ __html: previewHtml || "<br />" }} />
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-[#232327] p-3">
          {activeTab !== "avisar" && (
          <div className="flex items-center gap-1">
            {[
              { label: "Negrito", marker: "*", Icon: Bold },
              { label: "Itálico", marker: "_", Icon: Italic },
              { label: "Riscado", marker: "~", Icon: Strikethrough },
            ].map(({ label, marker, Icon }) => (
              <button
                key={marker}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => wrapSelection(marker)}
                className="flex size-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
          )}
          <textarea
            ref={textareaRef}
            aria-label={`Texto da mensagem de ${activeTabDef.label.toLowerCase()}`}
            placeholder="✍️ Insira seu texto aqui..."
            value={activeTab === "avisar" ? FIXED_REMINDER_TEMPLATE : activeText}
            readOnly={activeTab === "avisar"}
            onChange={(event) => patchDraft(activeField, event.target.value)}
            maxLength={2000}
            className="mt-2 min-h-[280px] w-full resize-y rounded-lg bg-[#101013] px-4 py-3 text-sm leading-6 text-[var(--c-f4f5f7)] outline-none placeholder:text-[#5c5c64] focus:ring-1 focus:ring-[var(--c-1677ff)]/50"
          />
          {activeTab === "avisar" ? (
            <p className="mt-2 text-xs text-[#8a8a92]">
              🔒 Mensagem pré-definida fixa do sistema — enviada exatamente assim para os clientes.
            </p>
          ) : null}
          {!activeValid && (
            <p role="alert" className="mt-2 text-sm text-red-400">
              Remova os campos não reconhecidos.
            </p>
          )}
          {activeTab !== "avisar" && (
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1" aria-label="Emojis">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Inserir emoji ${emoji}`}
                onClick={() => insertAtCursor(emoji)}
                className="shrink-0 rounded-lg px-1.5 py-1 text-xl transition-colors hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
          )}
          {activeTab !== "avisar" && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              aria-label="Abrir emojis"
              onClick={() => textareaRef.current?.focus()}
              className="rounded-lg border border-[#2c2c31] bg-[#101013] px-3 py-2 text-xs font-medium text-[var(--c-b8bec7)] transition-colors hover:border-[var(--c-1677ff)]/40 hover:text-white"
            >
              😁
            </button>
            <button
              type="button"
              onClick={() => prefixLines(() => "• ")}
              className="rounded-lg border border-[#2c2c31] bg-[#101013] px-3 py-2 text-xs font-medium text-[var(--c-b8bec7)] transition-colors hover:border-[var(--c-1677ff)]/40 hover:text-white"
            >
              Marcador
            </button>
            <button
              type="button"
              onClick={() => prefixLines((index) => `${index + 1}. `)}
              className="rounded-lg border border-[#2c2c31] bg-[#101013] px-3 py-2 text-xs font-medium text-[var(--c-b8bec7)] transition-colors hover:border-[var(--c-1677ff)]/40 hover:text-white"
            >
              Tópico
            </button>
          </div>
          )}
          {activeTab !== "avisar" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {activeTabDef.tokens.map(([label, token]) => (
              <button
                key={token}
                type="button"
                onClick={() => insertAtCursor(token)}
                className="rounded-lg border border-[#2c2c31] bg-[#101013] px-3 py-2 text-xs font-medium text-[var(--c-b8bec7)] transition-colors hover:border-[var(--c-1677ff)]/40 hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
          )}
        </div>

        {activeTab === "avisar" && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="reminderHoursBefore" className="text-xs font-medium text-[var(--c-b8bec7)]">
                Enviar quantas horas antes?
              </label>
              <Input
                id="reminderHoursBefore"
                type="number"
                min={1}
                max={168}
                value={draft.reminderHoursBefore}
                onChange={(event) => patchDraft("reminderHoursBefore", Number(event.target.value))}
                className="w-28 border-[#2c2c31] bg-[#101013] text-white"
              />
            </div>
            <p className="pb-2 text-xs text-[#5c5c64]">Entre 1 e 168 horas.</p>
          </div>
        )}

        <p className="mt-3 text-xs text-[#5c5c64]">
          Campos disponíveis: {"{Cliente}"}, {"{Serviço}"}, {"{Data}"}, {"{Horario}"},{" "}
          {"{Funcionario}"}, {"{Valor}"}, {"{Saudacao}"}, {"{Link}"}, {"{nome}"}, {"{servico}"},{" "}
          {"{data}"}, {"{hora}"}, {"{negocio}"}.
        </p>
        <Button
          type="button"
          className="integration-whatsapp-button mt-3 w-full"
          disabled={save.isPending || hasInvalidPlaceholder || hoursInvalid}
          onClick={() => save.mutate({ ...draft, reminderTemplate: FIXED_REMINDER_TEMPLATE })}
        >
          {save.isPending ? "Salvando..." : "Salvar mensagens"}
        </Button>
      </section>
    </div>
  );
}
