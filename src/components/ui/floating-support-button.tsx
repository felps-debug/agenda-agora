import * as React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Headset,
  X,
  ArrowUp,
  ArrowLeft,
  MessageCircle,
  Search,
  ChevronRight,
  Home,
  MessagesSquare,
  Sparkles,
  HelpCircle,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

import { useAnimatedModal } from "@/lib/use-animated-modal";
import {
  getSupportMessages,
  getSupportUnreadCount,
  sendSupportMessage,
} from "@/lib/agpay-support.functions";

interface FloatingSupportButtonProps {
  /** Rota interna da central de suporte do painel */
  supportPath?: string;
  /** Estabelecimento do dono: habilita o chat real com o Suporte AG. */
  businessId?: string | null;
  /** Nome do estabelecimento (usado nos detalhes da conversa). */
  ownerName?: string | null;
}

type TabKey = "inicio" | "conversas" | "novidades" | "ajuda";

interface NewsItem {
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
}

interface HelpItem {
  label: string;
  /** Resposta curta (2-3 linhas) exibida ao abrir o tópico, no contexto da Agenda Agora */
  answer: string;
}

interface ChatMessage {
  from: "me" | "them";
  text: string;
  time: string;
  id: string;
}

const SUPPORT_NAME = "Suporte AG";
const SUPPORT_AVATAR = "/suporte-ag.png";
const HEADER_AVATARS = [
  "/avatar-suporte-1.png",
  "/avatar-suporte-2.png",
  "/avatar-suporte-3.png",
];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Botão flutuante de suporte do painel:
 * - FAB circular azul com indicador online
 * - Enquanto um input/textarea estiver focado, o FAB recua (fica atrás do campo)
 * - Ao clicar, abre o popup de suporte (clone do design de referência)
 * - Popup com abas inferiores: Início, Conversas, Novidades e Ajuda
 * - Na aba Conversas há o contato "Suporte AG"; ao abrir, mostra a conversa
 * - A dúvida escrita na aba Início é encaminhada para a conversa do suporte
 */
export const FloatingSupportButton: React.FC<FloatingSupportButtonProps> = ({
  supportPath = "/painel/suporte",
  businessId = null,
  ownerName = null,
}) => {
  const {
    isOpen: open,
    closing: popupClosing,
    open: openPopup,
    close: closePopupBase,
  } = useAnimatedModal();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("inicio");
  const [chatOpen, setChatOpen] = React.useState(false);
  const [openHelp, setOpenHelp] = React.useState<string | null>(null);
  const [focusedElement, setFocusedElement] = React.useState<HTMLElement | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => setMounted(true), []);

  /** Conversa real com o Suporte AG (persistida; o master responde pelo Painel 3). */
  const chatView = open && chatOpen;
  const threadFn = useServerFn(getSupportMessages);
  const thread = useQuery({
    queryKey: ["support-thread", businessId, chatView],
    enabled: !!businessId,
    queryFn: () =>
      threadFn({ data: { businessId: businessId!, markRead: chatView } }),
    refetchInterval: chatView ? 3000 : 12000,
  });
  const unreadFn = useServerFn(getSupportUnreadCount);
  const unread = useQuery({
    queryKey: ["support-unread", businessId],
    enabled: !!businessId,
    queryFn: () => unreadFn({ data: { businessId: businessId! } }),
    refetchInterval: 8000,
  });
  const unreadCount = chatView ? 0 : (unread.data?.count ?? 0);

  const sendFn = useServerFn(sendSupportMessage);
  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      sendFn({ data: { businessId: businessId!, message } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["support-thread", businessId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const messages: ChatMessage[] = (thread.data?.messages ?? []).map((m) => ({
    from: m.sender === "user" ? "me" : "them",
    text: m.text,
    time: formatTime(m.createdAt),
    id: m.id,
  }));
  const lastMessage = messages[messages.length - 1] ?? null;

  React.useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        setFocusedElement(target);
      }
    };
    const handleBlur = () => setFocusedElement(null);

    document.addEventListener("focusin", handleFocus, true);
    document.addEventListener("focusout", handleBlur, true);
    return () => {
      document.removeEventListener("focusin", handleFocus, true);
      document.removeEventListener("focusout", handleBlur, true);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopup();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closePopup = () => {
    closePopupBase();
    setChatOpen(false);
  };

  const go = (to: string) => {
    closePopupBase();
    setChatOpen(false);
    void navigate({ to: to as "/painel/suporte" });
  };

  /** Envia a mensagem do dono para a conversa real com o suporte. */
  const appendMessage = (text: string) => {
    const value = text.trim();
    if (!value) return false;
    if (!businessId) {
      toast.error("Não foi possível enviar agora. Tente novamente.");
      return false;
    }
    if (sendMutation.isPending) return false;
    sendMutation.mutate(value);
    return true;
  };

  /**
   * Encaminha a dúvida escrita na aba Início direto para a conversa com o
   * Suporte AG e já abre a tela da conversa mostrando a mensagem enviada.
   */
  const forwardToSupport = (text: string) => {
    if (!appendMessage(text)) return false;
    setTab("conversas");
    setChatOpen(true);
    return true;
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed bottom-6 right-6 z-40 transition-opacity duration-200"
        style={{
          pointerEvents: focusedElement || open ? "none" : "auto",
          opacity: open ? 0 : 1,
        }}
        aria-hidden={open}
      >
        <button
          type="button"
          className="agenda-fab"
          aria-label="Abrir suporte"
          onClick={() => {
            setFocusedElement(null);
            setChatOpen(false);
            openPopup();
          }}
        >
          <Headset className="size-6" strokeWidth={2} />
          {unreadCount > 0 ? (
            <span className="agenda-fab-badge" aria-label={`${unreadCount} resposta(s) nova(s)`}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : (
            <span className="agenda-fab-dot" aria-hidden="true" />
          )}
        </button>
      </div>

      {open && (
        <>
          <div
            className={`agenda-support-backdrop ${popupClosing ? "animate-backdrop-out" : "animate-backdrop"}`}
            onClick={closePopup}
            aria-hidden="true"
          />
          <section
            className={`agenda-support-popup ${popupClosing ? "animate-modal-out" : "animate-modal-in"}`}
            role="dialog"
            aria-modal="true"
            aria-label="Suporte"
          >
            {chatOpen ? (
              <SupportChat
                messages={messages}
                onSend={appendMessage}
                onBack={() => setChatOpen(false)}
                onClose={closePopup}
              />
            ) : (
              <>
                <header className="agenda-popup-header">
                  <span className="agenda-popup-badge" aria-hidden="true">
                    <Headset className="size-5" strokeWidth={2} />
                  </span>
                  <div className="agenda-popup-header-right">
                    <div className="agenda-avatars">
                      {HEADER_AVATARS.map((src, index) => (
                        <span
                          key={src}
                          className={`agenda-avatar agenda-avatar-${index + 1}`}
                        >
                          <img src={src} alt="" />
                          <span className="agenda-avatar-dot" />
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="agenda-popup-close"
                      aria-label="Fechar"
                      onClick={closePopup}
                    >
                      <X className="size-4.5" strokeWidth={2} />
                    </button>
                  </div>
                </header>

                {tab === "inicio" && (
                  <>
                    <div className="agenda-popup-greeting">
                      <p className="hello">Olá, Guilherme</p>
                      <h2>Como podemos te ajudar hoje?</h2>
                    </div>

                    <SupportComposer onSend={forwardToSupport} />
                  </>
                )}

                <div className="agenda-popup-body" key={tab}>
                  {tab === "inicio" && (
                    <>
                      <button
                        type="button"
                        className="agenda-support-online"
                        onClick={() => go(supportPath)}
                      >
                        <MessageCircle className="size-4.5" strokeWidth={2} />
                        Suporte online
                      </button>

                      <div className="agenda-help-block">
                        <div className="agenda-help-head">
                          <h3>Central de Ajuda</h3>
                        </div>
                        <div className="agenda-help-list">
                          {helpItems.slice(0, 3).map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              className="agenda-help-item"
                              onClick={() => setTab("ajuda")}
                            >
                              {item.label}
                              <ChevronRight
                                className="agenda-chevron size-4.5"
                                strokeWidth={2}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {tab === "conversas" && (
                    <div className="agenda-chat-list">
                      <button
                        type="button"
                        className="agenda-chat-row"
                        onClick={() => setChatOpen(true)}
                      >
                        <span className="agenda-chat-avatar">
                          <img src={SUPPORT_AVATAR} alt={SUPPORT_NAME} />
                          <span className="agenda-chat-avatar-dot" aria-hidden="true" />
                        </span>
                        <span className="agenda-chat-row-main">
                          <span className="agenda-chat-row-top">
                            <span className="agenda-chat-name">{SUPPORT_NAME}</span>
                            {unreadCount > 0 && (
                              <span className="agenda-chat-unread-badge">
                                {unreadCount > 9 ? "9+" : unreadCount}
                              </span>
                            )}
                            <span className="agenda-chat-time">
                              {lastMessage?.time ?? "agora"}
                            </span>
                          </span>
                          <span className="agenda-chat-preview">
                            {lastMessage
                              ? `${lastMessage.from === "me" ? "Você: " : ""}${lastMessage.text}`
                              : "Envie sua dúvida e a gente responde por aqui."}
                          </span>
                          <span className="agenda-chat-status">Em aberto</span>
                        </span>
                      </button>
                    </div>
                  )}

                  {tab === "novidades" && (
                    <>
                      {newsItems.map((item) => (
                        <article
                          key={item.title}
                          className="agenda-news-card"
                          role="button"
                          tabIndex={0}
                          onClick={() => go(item.to)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              go(item.to);
                            }
                          }}
                        >
                          <span className="agenda-news-icon" aria-hidden="true">
                            <item.icon className="size-5" strokeWidth={2} />
                          </span>
                          <div className="agenda-news-content">
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                            <span className="agenda-news-link">
                              Saiba mais
                              <ChevronRight className="size-3.5" strokeWidth={2.4} />
                            </span>
                          </div>
                        </article>
                      ))}
                    </>
                  )}

                  {tab === "ajuda" && (
                    <>
                      <label className="agenda-help-searchbar">
                        <Search className="size-4.5" strokeWidth={2} />
                        <input
                          type="text"
                          placeholder="Buscar na Central de Ajuda"
                          aria-label="Buscar na Central de Ajuda"
                        />
                      </label>
                      <div className="agenda-help-list">
                        {helpItems.map((item) => {
                          const isOpen = openHelp === item.label;
                          return (
                            <div
                              key={item.label}
                              className={`agenda-help-faq${isOpen ? " is-open" : ""}`}
                            >
                              <button
                                type="button"
                                className="agenda-help-item"
                                aria-expanded={isOpen}
                                onClick={() => setOpenHelp(isOpen ? null : item.label)}
                              >
                                {item.label}
                                <ChevronRight
                                  className="agenda-chevron size-4.5"
                                  strokeWidth={2}
                                />
                              </button>
                              {isOpen && (
                                <p className="agenda-help-answer">{item.answer}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <nav className="agenda-popup-tabs" aria-label="Seções do suporte">
                  {supportTabs.map((item) => {
                    const active = tab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`agenda-popup-tab${active ? " is-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setTab(item.key)}
                      >
                        <item.icon className="size-5" strokeWidth={2} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </section>
        </>
      )}
    </>,
    document.body,
  );
};

const supportTabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "inicio", label: "Início", icon: Home },
  { key: "conversas", label: "Conversas", icon: MessagesSquare },
  { key: "novidades", label: "Novidades", icon: Sparkles },
  { key: "ajuda", label: "Ajuda", icon: HelpCircle },
];

const newsItems: NewsItem[] = [
  {
    icon: MessageCircle,
    title: "Lembretes automáticos no WhatsApp",
    description:
      "Confirme presenças e reduza faltas enviando lembretes automáticos para os seus clientes direto do painel.",
    to: "/painel/lembretes",
  },
  {
    icon: BarChart3,
    title: "Relatório da sua agenda",
    description:
      "Acompanhe faturamento, serviços mais vendidos e taxa de ocupação do seu negócio em um só lugar.",
    to: "/painel/relatorio",
  },
];

const helpItems: HelpItem[] = [
  {
    label: "Como conectar o WhatsApp?",
    answer:
      "Vá em Painel › Integrações, escaneie o QR Code com o WhatsApp do seu negócio e aguarde a conexão. Depois disso, os agendamentos e lembretes saem automaticamente pelo WhatsApp.",
  },
  {
    label: "Como cadastrar meus serviços?",
    answer:
      "Acesse Painel › Serviços e clique em Adicionar serviço. Informe nome, duração e valor e deixe o serviço ativo para que ele apareça na sua página de agendamento.",
  },
  {
    label: "Meus lembretes não foram enviados",
    answer:
      "Confirme se o WhatsApp está conectado em Painel › Integrações e se o lembrete está ativo em Painel › Lembretes. Verifique também se o número do cliente foi cadastrado corretamente.",
  },
  {
    label: "Como ver meu faturamento?",
    answer:
      "Abra Painel › Relatório e escolha o período desejado. Ali você acompanha o faturamento, os serviços mais vendidos e a taxa de ocupação da sua agenda.",
  },
];

function SupportChat({
  messages,
  onSend,
  onBack,
  onClose,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState("");
  const endRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = () => {
    if (!onSend(draft)) return;
    setDraft("");
  };

  return (
    <div className="agenda-chat-view">
      <header className="agenda-chat-header">
        <button
          type="button"
          className="agenda-chat-back"
          aria-label="Voltar"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
        </button>
        <span className="agenda-chat-avatar agenda-chat-avatar-sm">
          <img src={SUPPORT_AVATAR} alt={SUPPORT_NAME} />
          <span className="agenda-chat-avatar-dot" aria-hidden="true" />
        </span>
        <div className="agenda-chat-head-name">
          <h3>{SUPPORT_NAME}</h3>
          <span className="agenda-chat-online">
            <span className="agenda-chat-online-dot" aria-hidden="true" />
            Online agora
          </span>
        </div>
        <button
          type="button"
          className="agenda-popup-close"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X className="size-4.5" strokeWidth={2} />
        </button>
      </header>

      <div className="agenda-chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`agenda-chat-bubble ${message.from}`}>
            {message.text}
            <span className="agenda-chat-bubble-time">{message.time}</span>
          </div>
        ))}
        <span ref={endRef} />
      </div>

      <div className="agenda-chat-composer">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Escreva uma mensagem..."
          aria-label="Escreva uma mensagem"
        />
        <button
          type="button"
          className="agenda-chat-send"
          aria-label="Enviar"
          onClick={send}
        >
          <ArrowUp className="size-5" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

function SupportComposer({ onSend }: { onSend: (text: string) => boolean }) {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const send = () => {
    if (!value.trim()) {
      inputRef.current?.focus();
      return;
    }
    onSend(value);
    setValue("");
  };

  return (
    <div className="agenda-composer">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="Descreva sua dúvida..."
        aria-label="Descreva sua dúvida"
      />
      <button
        type="button"
        className="agenda-composer-send"
        aria-label="Enviar"
        onClick={send}
      >
        <ArrowUp className="size-4.5" strokeWidth={2.2} />
      </button>
    </div>
  );
}
