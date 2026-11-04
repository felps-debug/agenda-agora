import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowUp,
  CheckCheck,
  Clock3,
  Headset,
  Loader2,
  MessagesSquare,
  ShieldAlert,
  LifeBuoy,
} from "lucide-react";
import { requireMasterAccess } from "@/lib/master.functions";
import {
  getSupportThreadForMaster,
  listSupportConversations,
  replySupportAsMaster,
} from "@/lib/agpay-support.functions";
import { KpiCard, TONE_BLUE, TONE_GREEN, TONE_RED, TONE_VIOLET } from "@/components/master/PlatformOverview";

export const Route = createFileRoute("/_authenticated/painel/suporte")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Suporte técnico — Painel master" },
      { name: "description", content: "Conversas em tempo real com os estabelecimentos." },
    ],
  }),
  component: SuportePage,
});

type PopMessage = {
  id: string;
  sender: "user" | "master";
  text: string;
  createdAt: string;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

/** Mesma identidade da Visão geral (cartões luminosos + tonalidade por contexto). */
const card =
  "rounded-2xl border border-[#2b2b2e] bg-[var(--c-131519)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_28px_rgba(22,119,255,0.05)]";
const sectionTitle = "flex items-center gap-2 text-[15px] font-semibold text-white";

function SuportePage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listSupportConversations);
  const list = useQuery({
    queryKey: ["support-conversations"],
    queryFn: () => listFn(),
    refetchInterval: 4000,
  });
  const conversations = list.data?.conversations ?? [];
  const [selected, setSelected] = useState<string | null>(null);

  const threadFn = useServerFn(getSupportThreadForMaster);
  const thread = useQuery({
    queryKey: ["support-thread-master", selected],
    enabled: !!selected,
    queryFn: () => threadFn({ data: { businessId: selected! } }),
    refetchInterval: 3000,
  });
  const messages: PopMessage[] = thread.data?.messages ?? [];

  const replyFn = useServerFn(replySupportAsMaster);
  const reply = useMutation({
    mutationFn: (input: { businessId: string; message: string }) =>
      replyFn({ data: input }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["support-thread-master", variables.businessId],
      });
      void queryClient.invalidateQueries({ queryKey: ["support-conversations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Seleciona a primeira conversa com pergunta não lida (mais recente primeiro).
  useEffect(() => {
    if (selected) return;
    const withUnread = conversations.find((c) => c.unread > 0);
    if (withUnread) setSelected(withUnread.businessId);
  }, [conversations, selected]);

  const naoRespondidas = useMemo(
    () => conversations.filter((c) => c.unread > 0).length,
    [conversations],
  );
  const respondidas = useMemo(
    () => conversations.filter((c) => c.unread === 0 && c.lastSender === "master").length,
    [conversations],
  );

  const active = conversations.find((c) => c.businessId === selected) ?? null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho no visual da Visão geral */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="report-icon-box report-icon-box-lg relative z-10"
            style={
              {
                "--report-icon-color": TONE_BLUE.color,
                "--report-icon-background": TONE_BLUE.background,
                "--report-icon-border": TONE_BLUE.border,
                "--report-icon-glow": TONE_BLUE.glow,
              } as React.CSSProperties
            }
          >
            <Headset className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white">
              Suporte Técnico
            </h1>
            <p className="text-sm text-muted-foreground">
              Conversas em tempo real — o que você responde chega no pop-up do Painel 2 do
              estabelecimento.
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[11px] font-bold"
          style={{
            color: TONE_AMBER_SAFE.color,
            background: TONE_AMBER_SAFE.background,
            border: `1px solid ${TONE_AMBER_SAFE.border}`,
          }}
        >
          Resposta em tempo real
        </span>
      </header>

      {/* KPIs — mesma linguagem dos cards da Visão geral */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<MessagesSquare className="size-5" />}
          tone={TONE_BLUE}
          label="Conversas totais"
          value={String(conversations.length)}
          hint="estabelecimentos que já perguntaram"
        />
        <KpiCard
          icon={<ShieldAlert className="size-5" />}
          tone={naoRespondidas > 0 ? TONE_RED : TONE_GREEN}
          label="Não respondidas"
          value={String(naoRespondidas)}
          hint={naoRespondidas > 0 ? "responda para chegar no pop-up do dono" : "tudo em dia"}
        />
        <KpiCard
          icon={<CheckCheck className="size-5" />}
          tone={TONE_GREEN}
          label="Respondidas"
          value={String(respondidas)}
          hint="atendimento concluído"
        />
        <KpiCard
          icon={<Clock3 className="size-5" />}
          tone={TONE_VIOLET}
          label="Aguardando há 3h+"
          value={String(
            conversations.filter(
              (c) =>
                c.unread > 0 &&
                Date.now() - new Date(c.lastAt).getTime() > 3 * 60 * 60 * 1000,
            ).length,
          )}
          hint="prioridade de resposta"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Lista de conversas no visual da Visão geral */}
        <section className={`${card} flex flex-col`}>
          <p className={`${sectionTitle} mb-3`}>
            <MessagesSquare className="size-4" style={{ color: TONE_BLUE.color }} />
            Conversas
          </p>
          <div className="max-h-[560px] overflow-y-auto">
            {list.isPending ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[#9aa1ab]">
                <Loader2 className="size-4 animate-spin" /> Carregando conversas…
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-[#9aa1ab]">
                Nenhuma conversa ainda. As perguntas enviadas no pop-up de suporte do Painel 2
                aparecem aqui.
              </p>
            ) : (
              <ul>
                {conversations.map((c) => {
                  const isActive = c.businessId === selected;
                  return (
                    <li key={c.businessId}>
                      <button
                        type="button"
                        onClick={() => setSelected(c.businessId)}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                          isActive
                            ? "bg-[var(--c-1677ff)]/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                            : "hover:bg-[var(--c-1677ff)]/[0.045]"
                        }`}
                      >
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold"
                          style={{
                            color: c.unread > 0 ? TONE_RED.color : TONE_BLUE.color,
                            background:
                              c.unread > 0 ? TONE_RED.background : TONE_BLUE.background,
                            border: `1px solid ${c.unread > 0 ? TONE_RED.border : TONE_BLUE.border}`,
                          }}
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-bold text-white">
                              {c.name}
                            </span>
                            {c.unread > 0 && (
                              <span
                                className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold"
                                style={{ background: TONE_RED.color, color: "#2b0a0d" }}
                              >
                                {c.unread > 9 ? "9+" : c.unread}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] capitalize text-[#9aa1ab]">
                            {c.category ?? "estabelecimento"}
                            {c.ownerName ? ` · ${c.ownerName}` : ""}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-[#777d87]">
                            {c.lastSender === "user" ? "" : "Você: "}
                            {c.lastMessage}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10.5px] text-[#686b74]">
                          {formatRelative(c.lastAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Conversa aberta */}
        <ChatPanel
          active={active ? { ...active } : null}
          messages={messages}
          loading={!!selected && thread.isPending}
          sending={reply.isPending}
          onSend={(message) => {
            if (!active) return;
            reply.mutate({ businessId: active.businessId, message });
          }}
        />
      </div>
    </div>
  );
}

const TONE_AMBER_SAFE = { color: "#f0b429", background: "rgba(250, 204, 21, 0.09)", border: "rgba(250, 204, 21, 0.28)" };

function ChatPanel({
  active,
  messages,
  loading,
  sending,
  onSend,
}: {
  active: {
    name: string;
    category: string | null;
    phone: string | null;
    ownerName: string | null;
    businessId: string;
  } | null;
  messages: PopMessage[];
  loading: boolean;
  sending: boolean;
  onSend: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (!active) {
    return (
      <section
        className={`${card} flex min-h-[420px] items-center justify-center p-8 text-center text-[13px] text-[#9aa1ab]`}
      >
        <div>
          <LifeBuoy className="mx-auto mb-3 size-7" style={{ color: TONE_VIOLET.color }} />
          Selecione uma conversa à esquerda para responder o estabelecimento.
        </div>
      </section>
    );
  }

  const send = () => {
    const value = draft.trim();
    if (!value || sending) return;
    onSend(value);
    setDraft("");
  };

  return (
    <section className={`${card} flex min-h-[420px] flex-col`}>
      <div className="flex items-start justify-between gap-3 border-b border-[#2b2b2e] pb-3">
        <div className="min-w-0">
          <p className={`${sectionTitle}`}>{active.name}</p>
          <p className="mt-0.5 text-[11.5px] capitalize text-[#9aa1ab]">
            {active.category ?? "estabelecimento"}
            {active.ownerName ? ` · ${active.ownerName}` : ""}
            {active.phone ? ` · ${active.phone}` : ""}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
          style={{
            color: TONE_GREEN.color,
            background: TONE_GREEN.background,
            border: `1px solid ${TONE_GREEN.border}`,
          }}
        >
          Tempo real
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#9aa1ab]">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[#9aa1ab]">
            Nenhuma mensagem nesta conversa.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`agenda-master-chat-bubble ${
                message.sender === "master" ? "is-master" : "is-user"
              }`}
            >
              {message.text}
              <span className="agenda-master-chat-time">{formatTime(message.createdAt)}</span>
            </div>
          ))
        )}
        <span ref={endRef} />
      </div>

      <div className="border-t border-[#2b2b2e] pt-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Escreva a resposta…"
            aria-label="Resposta para o estabelecimento"
            className="min-w-0 flex-1 rounded-full border border-[#2b2b2e] bg-[var(--c-0f1114)] px-4 py-2.5 text-sm text-white placeholder:text-[#686b74] focus:border-[var(--c-5da8ff)]/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            aria-label="Enviar resposta"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--c-2563eb)] text-white shadow-[0_0_20px_rgba(22,119,255,0.35)] transition-colors hover:bg-[var(--c-1677ff)] disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-5" strokeWidth={2.2} />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
