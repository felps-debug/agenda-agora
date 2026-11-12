import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Users,
  Scissors,
  UserRound,
  Menu,
  Bell,
  BellRing,
  TriangleAlert,
  Gem,
  PieChart,
  MessageSquareText,
  CircleX,
  Settings2,
  MessageCircle,
  Clock3,
  X,
  Link2,
  Copy,
  Check,
  ShieldCheck,
  FlaskConical,
  BadgeCheck,
  LifeBuoy,
  KeyRound,
  AlertTriangle,
  Camera,
  LockKeyhole,
  CreditCard,
  CalendarClock,
  TrendingUp,
  ClipboardList,
  SlidersHorizontal,
  Paintbrush,
  Palette,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { getMasterStatus } from "@/lib/admin.functions";
import { useBusiness, type Business } from "@/lib/business";
import { publicBookingUrl } from "@/lib/public-booking-link";
import { listBroadcasts } from "@/lib/broadcasts.functions";
import { broadcastVisibleTo, shouldShowPopup, type BroadcastAudienceTag } from "@/lib/broadcast";
import { broadcastIconOption } from "@/components/painel/BroadcastIcon";
import { addDismissed, readDismissedIds, readSeenAt, writeSeenAt } from "@/lib/notifications-store";
import { trialInfo } from "@/lib/trial-store";
import { getBillingCycle } from "@/lib/subscription.functions";
import type { BillingStage } from "@/lib/billing-cycle";
import { SubscriptionPixPayment } from "@/components/painel/SubscriptionPixPayment";
import { AvisoCobranca } from "@/components/painel/AvisoCobranca";
import { dayKey } from "@/lib/day-key";
import { consumeFreshSupportSession } from "@/lib/support-session";
import { formatPhoneBR } from "@/lib/format-phone";
import {
  getPlatformNavCounts,
  getSubscriptionLifecycle,
  returnToMasterSession,
  validateImpersonationSession,
} from "@/lib/lifecycle.functions";
import { masterPanelRedirectHref, publicBookingOrigin } from "@/lib/app-hosts";
import {
  PLATFORM_AVATAR_SPACE,
  panelAvatarPathFromMetadata,
  uploadPanelAvatar,
  usePanelAvatarUrl,
} from "@/lib/panel-avatar";
import { LOGO_ACCEPT } from "@/lib/logo";
import { useAnimatedModal } from "@/lib/use-animated-modal";
import { planState, planStatusClass } from "@/lib/plan-state";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingSupportButton } from "@/components/ui/floating-support-button";
import { SidebarProfileWidget } from "@/components/painel/SidebarProfileWidget";
import { SupportFaq } from "@/components/painel/SupportFaq";
import SecurityPinModal from "@/components/painel/SecurityPinModal";
import { AvisoPop } from "@/components/painel/AvisoPop";

/**
 * Logo da sidebar por tema de cor. O CSS também substitui a imagem via
 * `content: url(...)`, mas isso não funciona no Safari/iOS. Manter o `src`
 * sincronizado com o tema garante o logo correto em todos os navegadores.
 */
const brandLogoByTheme = {
  azul: "/agenda-agora-sidebar-logo-v2.png",
  rosa: "/agenda-agora-sidebar-logo-rosa.png",
  dourado: "/agenda-agora-sidebar-logo-dourada.png",
} as const;

type TemaSistema = keyof typeof brandLogoByTheme;

function useTemaSistema(): TemaSistema {
  // Começa em "azul" para bater com o HTML renderizado no servidor; o efeito
  // sincroniza com o tema real logo após a hidratação (sem mismatch).
  const [tema, setTema] = useState<TemaSistema>("azul");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const atual = root.getAttribute("data-theme");
      setTema(atual === "rosa" || atual === "dourado" ? atual : "azul");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return tema;
}

const brandMark = "/favicon-256.png";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Agenda Agora" },
      { name: "description", content: "Gerencie a agenda, os serviços e os clientes do negócio." },
      { property: "og:title", content: "Painel — Agenda Agora" },
      { property: "og:description", content: "Gerencie a agenda do seu negócio." },
    ],
  }),
  notFoundComponent: PanelNotFoundComponent,
  component: PainelLayout,
});

function PanelNotFoundComponent() {
  const navigate = useNavigate();

  return (
    <section className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold text-white">Página não encontrada</h1>
      <p className="text-sm text-[var(--c-9ca3af)]">Não encontramos esta página do painel.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={() => window.history.back()}>
          Voltar
        </Button>
        <Button onClick={() => void navigate({ to: "/painel" })}>Ir para a agenda</Button>
      </div>
    </section>
  );
}

const nav = [
  {
    title: "Agenda",
    items: [
      {
        to: "/painel",
        label: "Agenda",
        hint: "Visão dos horários",
        icon: CalendarDays,
        exact: true,
      },
      {
        to: "/painel/bloqueios",
        label: "Horários Bloqueados",
        hint: "Folgas e indisponibilidades",
        icon: CircleX,
      },
      {
        to: "/painel/funcionamento",
        label: "Funcionamento",
        hint: "Dias e horários",
        icon: Clock3,
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      { to: "/painel/clientes", label: "Clientes", hint: "Cadastro de clientes", icon: Users },
      {
        to: "/painel/profissionais",
        label: "Profissionais",
        hint: "Equipe e permissões",
        icon: UserRound,
      },
      { to: "/painel/servicos", label: "Serviço", hint: "Serviços e valores", icon: Scissors },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { to: "/painel/as-pay", label: "Ag Pay", hint: "Saldo dos sinais", icon: Gem },
      {
        to: "/painel/relatorio",
        label: "Relatório",
        hint: "Métricas e resultados",
        icon: PieChart,
      },
    ],
  },
  {
    title: "Comunicação",
    items: [
      {
        to: "/painel/templates",
        label: "Templates",
        hint: "Mensagens prontas",
        icon: MessageSquareText,
      },
      {
        to: "/painel/integracoes",
        label: "Integrações",
        hint: "Conexão e mensagens",
        icon: MessageCircle,
      },
      { to: "/painel/lembretes", label: "Lembretes", hint: "Envios automáticos", icon: BellRing },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        to: "/painel/configuracoes",
        label: "Configurações",
        hint: "Preferências do negócio",
        icon: Settings2,
        children: [
          {
            to: "/painel/configuracoes?secao=preferencias",
            label: "Preferências",
            icon: SlidersHorizontal,
          },
          { to: "/painel/configuracoes?secao=aparencia", label: "Aparências", icon: Paintbrush },
        ],
      },
    ],
  },
] as const;

const platformNav = [
  {
    title: "Visão geral",
    items: [
      {
        to: "/painel/master",
        label: "Visão geral",
        hint: "Métricas da plataforma",
        icon: ShieldCheck,
        exact: true,
      },
      {
        to: "/painel/recebiveis",
        label: "Agenda de Recebíveis",
        hint: "Vencimentos e recebimentos",
        icon: CalendarClock,
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      {
        to: "/painel/em-teste",
        label: "(Em teste)",
        hint: "Contas em avaliação",
        icon: FlaskConical,
      },
      {
        to: "/painel/assinantes",
        label: "(Assinantes)",
        hint: "Comércios com assinatura",
        icon: BadgeCheck,
      },
      {
        to: "/painel/precisa-de-atencao",
        label: "(Precisa de atenção)",
        hint: "Contas expiradas e canceladas",
        icon: AlertTriangle,
      },
    ],
  },
  {
    title: "Financeiro",
    items: [
      {
        to: "/painel/pix-aprovacao",
        label: "(Pix em Aprovação)",
        hint: "Chaves Pix pendentes",
        icon: KeyRound,
      },
      {
        to: "/painel/carteira-desempenho",
        label: "Ag Pay — Performance",
        hint: "Performance financeira do Ag Pay",
        icon: TrendingUp,
      },
    ],
  },
  {
    title: "Comunicação",
    items: [
      {
        to: "/painel/notificacoes-alertas",
        label: "(Notificações e Alertas)",
        hint: "Avisos para todos os usuários",
        icon: BellRing,
      },
      {
        to: "/painel/erros",
        label: "Erros de produção",
        hint: "Falhas de interface e requisições",
        icon: TriangleAlert,
      },
    ],
  },
  {
    title: "Equipe",
    items: [
      {
        to: "/painel/equipe-geral",
        label: "Equipe Geral",
        hint: "Performance da equipe SDR",
        icon: UsersRound,
      },
      {
        to: "/painel/suporte",
        label: "Suporte técnico",
        hint: "Tickets e atendimento",
        icon: LifeBuoy,
      },
    ],
  },
] as const;

const routePermission: Partial<Record<string, string | string[]>> = {
  "/painel": "view_agenda",
  "/painel/bloqueios": ["block_schedule", "block_agenda"],
  "/painel/clientes": "view_customer_phone",
  "/painel/relatorio": "view_reports",
};

function NotificationBell({ audienceTag }: { audienceTag?: BroadcastAudienceTag | undefined }) {
  const [day, setDay] = useState("");
  const [open, setOpen] = useState(false);
  // Carrega o estado "visto/dispensado" sincronamente (lazy initializer) para o
  // popup não piscar como "não visto" no primeiro render após navegar/recarregar.
  const [seenAt, setSeenAt] = useState(() => readSeenAt());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readDismissedIds());
  useEffect(() => {
    const refresh = () => {
      setDay(dayKey());
      setDismissedIds(readDismissedIds());
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const [popup, setPopup] = useState<{
    id: string;
    title: string;
    message: string;
    accent?: string | undefined;
    icon?: string | undefined;
  } | null>(null);
  const listBroadcastsFn = useServerFn(listBroadcasts);
  const { data: list = [] } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => listBroadcastsFn(),
    refetchInterval: 10000,
  });
  // O painel 2 só vê avisos do público-alvo escolhido no painel 3 e que ainda estão
  // dentro do prazo de exibição (1 a 7 dias); os expirados saem da caixa sozinhos.
  const visible = audienceTag ? list.filter((b) => broadcastVisibleTo(b, audienceTag)) : list;
  const unread = visible.filter((b) => new Date(b.createdAt).getTime() > seenAt).length;

  /** Marca o aviso como dispensado (X do popup): persiste por id e fecha. */
  const dismissPopup = (id: string) => {
    setDismissedIds(addDismissed(id));
    setPopup(null);
  };

  // Nova notificação enviada pelo Painel 3: aparece como pop-up padrão
  // (mesma identidade do aviso de vencimento), no máximo uma vez por aviso.
  useEffect(() => {
    const nova = visible[0];
    if (!nova || !day || !shouldShowPopup(nova, { seenAt, dismissedIds })) {
      setPopup(null);
      return;
    }
    setPopup((current) =>
      current?.id === nova.id
        ? current
        : {
            id: nova.id,
            title: nova.title,
            message: nova.message,
            accent: nova.accent ?? undefined,
            icon: nova.icon ?? undefined,
          },
    );
  }, [visible, seenAt, dismissedIds, day]);

  // Query refetches must not cancel the automatic dismissal timer.
  const popupId = popup?.id;
  useEffect(() => {
    if (!popupId) return;
    const timer = window.setTimeout(() => {
      setDismissedIds(addDismissed(popupId));
      setPopup(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [popupId]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        const now = Date.now();
        setSeenAt(now);
        writeSeenAt(now);
      }
      return next;
    });
  };

  return (
    <div className="relative">
      {popup
        ? (() => {
            const { Icon } = broadcastIconOption(popup.icon);
            return (
              <AvisoPop
                extraClass="aa-aviso-pop--broadcast"
                accent={popup.accent}
                icon={<Icon strokeWidth={1.8} aria-hidden="true" />}
                title={popup.title}
                onClose={() => dismissPopup(popup.id)}
              >
                <p>{popup.message}</p>
              </AvisoPop>
            );
          })()
        : null}
      <Button
        variant="ghost"
        size="icon"
        style={{ width: 39, height: 39 }}
        className="relative size-[39px] shrink-0 rounded-xl border border-[#2b2b2e] bg-[var(--c-0d0d10)] text-[#8a8f98] shadow-none hover:bg-[var(--c-121216)] hover:text-white"
        aria-label="Notificações"
        onClick={toggle}
      >
        <Bell className="size-[39px]" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-[#050607]" />
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-[#25282c] bg-[var(--c-0d0d10)] p-3 shadow-2xl">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[#626872]">
            Notificações
          </p>
          {!visible.length ? (
            <p className="px-1 py-4 text-center text-sm text-[#626872]">
              Nenhuma notificação por enquanto.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {visible.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border border-[var(--c-1f232b)] bg-[var(--c-12141a)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--c-f3f4f6)]">{b.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--c-9ca3af)]">{b.message}</p>
                  <p className="mt-1 text-[10px] text-[#626872]">
                    {new Date(b.createdAt).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const subscribeToOrigin = () => () => {};

/** Origem do navegador; null no servidor e na hidratação, evitando divergência de HTML. */
function useBrowserOrigin() {
  return useSyncExternalStore(
    subscribeToOrigin,
    () => window.location.origin,
    () => null,
  );
}

function PublicBookingLinkCard({ slug }: { slug: string | null | undefined }) {
  const origin = useBrowserOrigin();
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const url = publicBookingUrl(publicBookingOrigin(origin), slug);

  useEffect(() => {
    setFeedback("idle");
  }, [url]);

  useEffect(() => {
    if (feedback !== "copied") return;
    const timer = window.setTimeout(() => setFeedback("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (!url) return null;

  const copy = async () => {
    const absolute = publicBookingUrl(publicBookingOrigin(window.location.origin), slug);
    try {
      if (!absolute || !navigator.clipboard) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(absolute);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  };

  return (
    <section
      aria-labelledby="public-booking-link-title"
      className="mb-5 flex flex-col gap-3 rounded-lg border border-primary/30 bg-card p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Link2 className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="public-booking-link-title" className="text-sm font-medium text-foreground">
            Link de agendamento
          </h2>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {url}
          </a>
        </div>
      </div>
      <div className="flex flex-col gap-1 sm:items-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copy()}
          className="w-full focus-visible:ring-2 sm:w-auto"
        >
          {feedback === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {feedback === "copied" ? "Link copiado" : "Copiar link"}
        </Button>
        <p aria-live="polite" role="status" className="min-h-0 text-xs text-muted-foreground">
          {feedback === "copied"
            ? "Link copiado para a área de transferência."
            : feedback === "failed"
              ? "Não foi possível copiar. Selecione o link e copie manualmente."
              : ""}
        </p>
      </div>
    </section>
  );
}

const subAccountTabs = [
  { id: "visao", label: "Visão Geral", enabled: true },
  { id: "assinatura", label: "Assinatura", enabled: true },
  { id: "suporte", label: "Suporte & FAQ", enabled: true },
];

/** Opções de cor do sistema exibidas no seletor "Cor do Tema". */
const temaOpcoes = [
  { id: "azul", label: "Azul", swatch: "#3b82f6", soft: "#60a5fa" },
  { id: "rosa", label: "Rosa", swatch: "#f63b99", soft: "#f472b6" },
  { id: "dourado", label: "Dourado", swatch: "#c19b35", soft: "#e8ce72" },
] as const;

// Página de conta/assinatura exibida dentro do painel (branch `subOpen`).
// Estrutura e classes replicam o HTML original; apenas os dados são dinâmicos.
function AssinaturaContaPanel({
  business,
  user,
  platformMode,
}: {
  business: Business | null;
  user: User | null;
  platformMode: boolean;
}) {
  const [tab, setTab] = useState("visao");
  const [idCopied, setIdCopied] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarPath = panelAvatarPathFromMetadata(user);
  const { data: avatarUrl } = usePanelAvatarUrl(avatarPath);
  // O Painel master gerencia a plataforma inteira (não é um estabelecimento):
  // a foto do perfil dele fica num espaço próprio da plataforma.
  const avatarSpaceId = platformMode ? PLATFORM_AVATAR_SPACE : (business?.id ?? null);
  const {
    isOpen: gerenciarOpen,
    closing: gerenciarClosing,
    open: openGerenciar,
    close: closeGerenciar,
  } = useAnimatedModal();
  const [gerenciarMounted, setGerenciarMounted] = useState(false);
  useEffect(() => setGerenciarMounted(true), []);
  const [temaSistema, setTemaSistema] = useState<"azul" | "rosa" | "dourado">(() => {
    if (typeof document !== "undefined") {
      const t = document.documentElement.dataset["theme"];
      if (t === "rosa" || t === "dourado") return t;
    }
    return "azul";
  });
  const temaAtual = temaOpcoes.find((o) => o.id === temaSistema) ?? temaOpcoes[0];

  /**
   * Alterna o tema de cor do sistema do SaaS (azul | rosa | dourado). Aplica na
   * hora (1 atributo no <html>), persiste no banco por estabelecimento e
   * recarrega em seguida para redesenhar também os canvases com a cor nova.
   */
  async function trocarTemaSistema(op: "azul" | "rosa" | "dourado") {
    if (op === temaSistema) return;
    setTemaSistema(op);
    const root = document.documentElement;
    if (op === "rosa" || op === "dourado") root.setAttribute("data-theme", op);
    else root.removeAttribute("data-theme");
    window.localStorage.setItem("agendaagora:tema", op);
    if (business?.id) {
      // Se a coluna `theme` ainda não existir no banco (migração pendente),
      // o erro é ignorado em silêncio e a preferência continua valendo pelo
      // localStorage — nada de ruído no console.
      const { error } = await supabase
        .from("businesses")
        .update({ theme: op })
        .eq("id", business.id);
      void error;
    }
    const labels: Record<typeof op, string> = {
      azul: "Tema azul aplicado.",
      rosa: "Tema rosa aplicado.",
      dourado: "Tema dourado aplicado.",
    };
    toast.success(labels[op]);
    window.setTimeout(() => window.location.reload(), 900);
  }

  function openAvatarPicker() {
    if (!avatarSpaceId) {
      toast.error("Selecione um estabelecimento para alterar a foto.");
      return;
    }
    avatarInputRef.current?.click();
  }

  async function handleAvatarFile(file: File | undefined) {
    if (!file || !avatarSpaceId) return;
    setAvatarBusy(true);
    try {
      await uploadPanelAvatar({
        businessId: avatarSpaceId,
        file,
        previousPath: avatarPath,
      });
      toast.success("Foto de perfil atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar a foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  useEffect(() => {
    if (!idCopied) return;
    const timer = window.setTimeout(() => setIdCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [idCopied]);

  const trial = business ? trialInfo(business) : null;

  // Estado do plano: pago > ativo (verde); teste com dias positivos > amarelo;
  // vencido > Renovar (vermelho). `access_until` é a fonte única (dias do
  // teste adicionados pelo master também entram por lá).
  const hasPaidQ = useQuery({
    queryKey: ["payment-has-paid", business?.id ?? null],
    enabled: !!business,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("subscription_payments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id)
        .eq("status", "pago");
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },
    refetchInterval: 60_000,
  });
  const plan = planState(business ?? null, hasPaidQ.data);
  const planLabel = plan.label;
  const planExpired = plan.tone === "renovar";
  const planoCardTone =
    plan.tone === "ativo"
      ? "border-emerald-400/35 bg-[linear-gradient(145deg,rgba(16,185,129,0.08)_0%,rgba(7,12,10)_55%,rgba(6,10,8)_100%)]"
      : plan.tone === "teste"
        ? "border-amber-400/35 bg-[linear-gradient(145deg,rgba(245,158,11,0.08)_0%,rgba(13,11,6)_55%,rgba(11,9,5)_100%)]"
        : "border-destructive/40 bg-[linear-gradient(145deg,rgba(239,68,68,0.08)_0%,rgba(13,8,8)_55%,rgba(11,6,6)_100%)]";
  const planoDetalheTone =
    plan.tone === "ativo"
      ? "text-emerald-300"
      : plan.tone === "teste"
        ? "text-amber-300"
        : "text-destructive";
  const accountId = business?.id ?? null;
  const shortId = accountId ? `${accountId.slice(0, 8)}...` : "—";
  const monthlyValue = business?.monthly_fee_cents
    ? (business.monthly_fee_cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })
    : "—";
  const memberSince = business?.created_at
    ? new Date(business.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const lastAccess = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const planBadgeClass = plan.badgeClass;

  const copyAccountId = async () => {
    if (!accountId || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(accountId);
      setIdCopied(true);
    } catch {
      // Clipboard indisponível: o ID permanece visível no botão.
    }
  };

  return (
    <div className="owner-route-content">
      <div className="mx-auto w-full max-w-5xl pb-8">
        <section className="overflow-hidden rounded-[20px] border border-[var(--c-26292f)] bg-[#050607] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative shrink-0">
              <div className="flex size-[88px] items-center justify-center overflow-hidden rounded-[20px] bg-[#f4f4f5] text-2xl font-semibold text-[var(--c-111318)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  (business?.name ?? user?.email ?? "G").charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={openAvatarPicker}
                disabled={avatarBusy}
                aria-label="Alterar foto do perfil"
                title="Alterar foto"
                className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-[9px] border-2 border-[#050607] bg-[var(--c-146cff)] text-white shadow-[0_4px_14px_var(--c-rgba-20-108-255-a0d35)] transition-colors hover:bg-[var(--c-2a7cff)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-146cff)]/60 disabled:opacity-60"
              >
                <Camera className="size-4" aria-hidden="true" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept={LOGO_ACCEPT}
                style={{ display: "none" }}
                aria-label="Selecionar foto do perfil"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void handleAvatarFile(file);
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[26px]! leading-tight! font-semibold! tracking-[-0.035em] text-[#f5f5f6]">
                {business?.name ??
                  (platformMode ? "Administração da plataforma" : "Acesso do estabelecimento")}
              </h1>
              <p className="mt-1 truncate text-sm text-[#777d87]">
                {business?.phone ? formatPhoneBR(business.phone) : "—"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${planBadgeClass}`}
                >
                  {planLabel}
                </span>
                <button
                  type="button"
                  onClick={() => void copyAccountId()}
                  title="Copiar ID da conta"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2d3037] bg-[var(--c-15171b)] px-3 py-1 text-[10px] font-medium text-[#7f858f] transition-colors hover:border-[var(--c-3b4049)] hover:text-[var(--c-b8bdc5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-146cff)]/60"
                >
                  {idCopied ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3" aria-hidden="true" />
                  )}
                  {idCopied ? "ID copiado" : shortId}
                </button>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-[17px] border p-5 sm:p-6 ${planoCardTone}`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.10em] text-[#69717f]">
              Seu plano
            </p>
            <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-[var(--c-f4f5f7)]">
              {planLabel}
            </p>
            <p className={`mt-0.5 text-xs font-semibold ${planoDetalheTone}`}>{plan.detail}</p>
            <button
              type="button"
              onClick={openGerenciar}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-[9px] bg-[var(--c-0d4bc3)] text-sm font-medium text-white transition-colors hover:bg-[var(--c-1558d5)]"
            >
              Gerenciar assinatura
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[14px] border border-[var(--c-282b31)] bg-[var(--c-0d0e11)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#676d77]">
              MEMBRO DESDE
            </p>
            <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-e6e8eb)]">
              {memberSince}
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--c-282b31)] bg-[var(--c-0d0e11)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#676d77]">
              ÚLTIMO ACESSO
            </p>
            <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-e6e8eb)]">
              {lastAccess}
            </p>
          </div>
          <div className="col-span-1 rounded-[14px] border border-[var(--c-282b31)] bg-[var(--c-0d0e11)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#676d77]">
              CONTAS CONECTADAS
            </p>
            <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-e6e8eb)]">
              1
            </p>
          </div>
        </section>

        <nav className="mt-7 flex flex-wrap gap-x-7 gap-y-1 border-b border-[var(--c-272a30)] px-1">
          {subAccountTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.enabled}
                onClick={() => item.enabled && setTab(item.id)}
                className={`relative py-3 text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-[#666d78]"
                } ${item.enabled ? (active ? "cursor-pointer" : "cursor-pointer hover:text-[var(--c-d9dce1)]") : "cursor-default"}`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-[var(--c-1774ff)]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 space-y-4">
          {tab === "assinatura" && (
            <>
              <section className="rounded-[18px] border border-[var(--c-272a30)] bg-[#050607] p-5 sm:p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#686f7b]">
                  Plano atual
                </p>
                <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.10em] text-[#69717f]">
                  Seu plano
                </p>
                <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-[var(--c-f4f5f7)]">
                  {planLabel}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${planBadgeClass}`}
                  >
                    {plan.label}
                  </span>
                  <span className={`text-sm font-medium ${planoDetalheTone}`}>{plan.detail}</span>
                </div>
                <div className="mt-5 flex items-center gap-2 border-t border-[var(--c-202329)] pt-4 text-sm">
                  <CreditCard className="size-4 text-[#6d7480]" aria-hidden="true" />
                  <span className="text-[#6d7480]">Valor mensal</span>
                  <span className="ml-auto font-semibold text-[var(--c-e8eaed)]">
                    {monthlyValue}
                  </span>
                </div>
              </section>
              <section className="rounded-[18px] border border-[var(--c-272a30)] bg-[#050607] p-5 sm:p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#686f7b]">
                  Uso
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Agendamentos", value: planExpired ? "—" : "Ilimitado" },
                    { label: "Lembretes", value: planExpired ? "—" : "Auto" },
                    { label: "Sinal Pix", value: planExpired ? "—" : "Ativo" },
                    { label: "Campanhas", value: planExpired ? "—" : "Ativo" },
                    { label: "Relatórios", value: planExpired ? "—" : "Ativo" },
                    { label: "Suporte", value: planExpired ? "—" : "Ativo" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="rounded-xl border border-[var(--c-24272e)] bg-[var(--c-0d0e11)] p-3.5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b8e96]">
                        {f.label}
                      </p>
                      <p className="mt-1.5 text-[15px] font-semibold text-[var(--c-e7e9ed)]">
                        {f.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "suporte" && <SupportFaq />}

          {tab !== "assinatura" && tab !== "suporte" && (
            <>
              <section className="rounded-[18px] border border-[var(--c-272a30)] bg-[#050607] p-5 sm:p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#686f7b]">
                  Segurança
                </p>
                <div className="mt-4 rounded-[15px] border border-[var(--c-282b31)] bg-[var(--c-0a0b0d)] p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--c-08162d)] text-[var(--c-3485ff)]">
                      <LockKeyhole className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[var(--c-eef0f3)]">
                        Senha de acesso
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#6e747e]">
                        Consulte o usuário desta conta e os dados disponíveis do acesso atual
                      </p>
                      <button
                        type="button"
                        className="mt-4 rounded-full border border-[#383c44] bg-[var(--c-121317)] px-5 py-2 text-sm font-semibold text-[var(--c-e2e5e9)] transition-colors hover:border-[#4b505a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-146cff)]/60"
                      >
                        Ver acesso
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[18px] border border-[var(--c-272a30)] bg-[#050607] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#686f7b]">
                    Informações da conta
                  </p>
                  <button
                    type="button"
                    className="rounded-[9px] border border-[var(--c-30343b)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--c-b9bec7)] transition-colors hover:border-[var(--c-3b4049)] hover:text-[var(--c-d9dce1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-146cff)]/60"
                  >
                    Atualizar dados
                  </button>
                </div>
                <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#666d77]">
                      NOME
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-5 text-[var(--c-aeb4bd)]">
                      {business?.name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#666d77]">
                      TELEFONE
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-5 text-[var(--c-aeb4bd)]">
                      {business?.phone ? formatPhoneBR(business.phone) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#666d77]">
                      CPF / CNPJ
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-5 text-[var(--c-aeb4bd)]">
                      —
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#666d77]">
                      PLANO
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-5 text-[var(--c-aeb4bd)]">
                      {planLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#666d77]">
                      MEMBRO DESDE
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-5 text-[var(--c-aeb4bd)]">
                      {memberSince}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#666d77]">
                      ID DA CONTA
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-5 text-[var(--c-aeb4bd)]">
                      {accountId ?? "—"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <div
                      className="sys-theme-card"
                      style={
                        {
                          "--sys-theme-accent": temaAtual.swatch,
                          "--sys-theme-accent-soft": temaAtual.soft,
                        } as CSSProperties
                      }
                    >
                      <div className="sys-theme-header">
                        <div className="sys-theme-icon" aria-hidden="true">
                          <Palette className="size-4" strokeWidth={2} />
                        </div>
                        <div>
                          <h4 className="sys-theme-title">Cor do Tema</h4>
                          <p className="sys-theme-sub">Personalize a interface</p>
                        </div>
                      </div>

                      <div className="sys-theme-options" role="group" aria-label="Cor do Tema">
                        {temaOpcoes.map(({ id, label, swatch }) => {
                          const selected = temaSistema === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              aria-pressed={selected}
                              aria-label={label}
                              title={label}
                              onClick={() => void trocarTemaSistema(id)}
                              className={`sys-theme-swatch${selected ? " is-active" : ""}`}
                              style={
                                {
                                  "--active-color": swatch,
                                  background:
                                    id === "dourado"
                                      ? "linear-gradient(135deg, #e8ce72, #c19b35 52%, #a9801f)"
                                      : swatch,
                                } as CSSProperties
                              }
                            >
                              <Check
                                className="sys-theme-check"
                                strokeWidth={3}
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Pop-up "Gerenciar assinatura": plano atual, status e dias restantes. */}
          {gerenciarOpen &&
            gerenciarMounted &&
            createPortal(
              <div
                className="aa-popup-full fixed inset-0 z-[70] overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-label="Gerenciar assinatura"
              >
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={closeGerenciar}
                  className={`fixed inset-0 h-full w-full cursor-default bg-black/65 ${gerenciarClosing ? "animate-backdrop-out" : "animate-backdrop"}`}
                />
                <div className="flex min-h-full items-center justify-center p-4">
                  <div
                    className={`relative w-full max-w-sm rounded-2xl border border-[var(--c-272a30)] bg-[var(--c-0b0b0e)] p-6 ${gerenciarClosing ? "animate-modal-out" : "animate-modal-in"}`}
                  >
                    <button
                      type="button"
                      onClick={closeGerenciar}
                      aria-label="Fechar"
                      className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-[#30333a] text-[var(--c-9aa4b2)] transition-colors hover:text-white"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                    <h3 className="text-center text-[1.15rem] font-bold text-white">
                      Sua assinatura
                    </h3>
                    <div className="mt-4 flex justify-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${planBadgeClass}`}
                      >
                        {plan.label}
                      </span>
                    </div>
                    <p className={`mt-2 text-center text-sm font-semibold ${planoDetalheTone}`}>
                      {plan.detail}
                    </p>
                    <div className="mt-5 space-y-3 border-t border-white/10 pt-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#8b8e96]">Plano atual</span>
                        <span className="font-semibold text-white">
                          {plan.tone === "ativo"
                            ? "Assinante Premium"
                            : "Premium (aguardando pagamento)"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#8b8e96]">Dias restantes</span>
                        <span className="font-semibold text-white">
                          {plan.daysLeft != null && plan.tone !== "renovar" && plan.daysLeft >= 0
                            ? plan.daysLeft === 0
                              ? "Último dia"
                              : `${plan.daysLeft} dia${plan.daysLeft === 1 ? "" : "s"}`
                            : "—"}
                        </span>
                      </div>
                      {business?.access_until ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[#8b8e96]">Vencimento</span>
                          <span className="font-semibold text-white">
                            {new Date(business.access_until).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#8b8e96]">Valor mensal</span>
                        <span className="font-semibold text-white">{monthlyValue}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeGerenciar}
                      className="mt-4 h-10 w-full rounded-xl border border-[var(--c-272a30)] bg-[var(--c-111317)] text-sm font-semibold text-[var(--c-cfd3d9)] transition-colors hover:border-[var(--c-1677ff)]/30 hover:bg-[var(--c-1677ff)]/[0.06] hover:text-white"
                    >
                      Voltar ao painel
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
}

/** Tela de pagamentos da assinatura: faturas do estabelecimento. */
function brlAssinatura(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PagamentosView({ business }: { business: Business | null }) {
  const [planOpen, setPlanOpen] = useState(true);
  const {
    isOpen: checkoutOpen,
    closing: checkoutClosing,
    open: openCheckout,
    close: closeCheckout,
  } = useAnimatedModal();
  const [mounted, setMounted] = useState(false);
  const [payMethod, setPayMethod] = useState<"pix" | "cartao">("pix");
  const [cardForm, setCardForm] = useState({
    number: "",
    expiry: "",
    cvv: "",
    holder: "",
    doc: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);
  const trial = business ? trialInfo(business) : null;
  const expired = business?.status === "suspenso" || (trial ? trial.remaining <= 0 : false);

  // Faturas do ciclo (vencimento rolante): UMA caixa de status (a vencer/vencida)
  // + histórico permanente de pagamentos confirmados.
  const cycleFn = useServerFn(getBillingCycle);
  const cycle = useQuery({
    queryKey: ["billing-cycle", business?.id],
    enabled: !!business,
    refetchInterval: 60000,
    queryFn: () => cycleFn({ data: { businessId: business!.id } }),
  });
  const statusCard = cycle.data?.statusCard;
  const statusCardVisible = statusCard?.visible ?? false;
  const pagoHistory = cycle.data?.pagoHistory ?? [];

  // Cupom ativo definido pelo master (expira sozinho no banco).
  const masterCoupon = cycle.data?.coupon ?? null;
  const baseTotalCents = cycle.data?.amountCents ?? 8990;
  const couponDiscountCents = Math.round((baseTotalCents * (masterCoupon?.percent ?? 0)) / 100);
  const pixDiscountedCents = Math.max(baseTotalCents - couponDiscountCents, 0);
  const statusLabel: Record<string, string> = {
    pago: "Pago",
    a_vencer: "A vencer",
    vencida: "Vencida",
  };
  const rowClassByStatus: Record<string, string> = {
    pago: "bg-[#1e7e4d]",
    a_vencer: "bg-[#8a6d1c]",
    vencida: "bg-[#c0392b]",
  };

  const value = business?.monthly_fee_cents
    ? (business.monthly_fee_cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })
    : "—";

  return (
    <div className="owner-route-content">
      <div className="mx-auto w-full max-w-5xl pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Pagamentos</h1>
        <div className="report-luminous-card report-effect-strong relative mx-auto mt-8 w-full max-w-sm p-6 pt-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-[var(--c-4a90e2)] to-transparent shadow-[0_0_16px_var(--c-rgba-74-144-226-a0d9)]"
          />
          <span className="absolute left-6 top-3 rounded-full bg-[var(--c-1f6df9)] px-3 py-1 font-[General_Sans] text-[0.65rem] font-normal tracking-wide text-white">
            MAIS POPULAR
          </span>
          <p className="mt-6 font-[General_Sans] text-xs font-normal uppercase tracking-[0.14em] text-[var(--c-5b8def)]">
            Premium
          </p>
          <button
            type="button"
            onClick={() => setPlanOpen((v) => !v)}
            aria-expanded={planOpen}
            aria-label={planOpen ? "Recolher assinatura" : "Expandir assinatura"}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg border border-[var(--c-1f6df9)]/30 bg-[var(--c-1f6df9)]/10 text-[var(--c-8fb5ff)] transition-colors hover:bg-[var(--c-1f6df9)]/20"
          >
            {planOpen ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            )}
          </button>
          <div
            className={`grid transition-all duration-300 ease-in-out ${planOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          >
            <div className="overflow-hidden">
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-white">
                {brlAssinatura(cycle.data?.amountCents ?? 8990)}
                <span className="text-base font-medium text-[#8a8f98]">/mês</span>
              </p>
              <p className="mt-1 text-sm text-[#8a8f98]">Para o seu negócio crescer</p>
              {(cycle.data?.professionalsCount ?? 0) > 1 ? (
                <p className="mt-2 text-xs leading-relaxed text-[#8a8f98]">
                  Inclui 1 profissional (a agenda principal) +{" "}
                  {Math.max((cycle.data?.professionalsCount ?? 0) - 1, 0)} adicional(is) de{" "}
                  <span className="font-semibold text-[var(--c-8fb5ff)]">+R$ 10,00/mês</span> cada —
                  agendas próprias e separadas.
                </p>
              ) : null}
              <button
                type="button"
                onClick={openCheckout}
                className="mt-5 h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition-colors hover:bg-[#e5e5e5]"
              >
                Assinar Premium
              </button>
              <ul className="mt-5 space-y-2.5 border-t border-white/10 pt-5 text-sm text-[var(--c-c9cdd4)]">
                {" "}
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-[#49db7e]" strokeWidth={2.5} />
                  <span>
                    <strong className="text-white">Agendamentos ilimitados</strong>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-[#49db7e]" strokeWidth={2.5} />
                  <span>
                    <strong className="text-white">Lembretes automáticos</strong> no WhatsApp
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-[#49db7e]" strokeWidth={2.5} />
                  <span>
                    <strong className="text-white">Sinal antecipado</strong> via Pix
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-[#49db7e]" strokeWidth={2.5} />
                  <span>
                    <strong className="text-white">Página de agendamento</strong> própria
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-[#49db7e]" strokeWidth={2.5} />
                  <span>
                    <strong className="text-white">Suporte prioritário</strong>
                  </span>
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg border border-[var(--c-2f83ff)]/40 bg-[var(--c-2f83ff)]/10 px-4 py-[7px] text-center text-sm font-semibold text-[var(--c-8fb5ff)]">
                + Bônus Adicionais
              </div>
              <ul className="mt-2.5 space-y-2.5 text-sm text-[var(--c-c9cdd4)]">
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-[#49db7e]" strokeWidth={2.5} />
                  <span>
                    <strong className="text-white">Campanha de retorno</strong>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-[#49db7e]" strokeWidth={2.5} />
                  <span>
                    <strong className="text-white">Relatórios gerais</strong>
                  </span>
                </li>
              </ul>
            </div>
          </div>
          {business ? (
            <div className="mt-5">
              <SubscriptionPixPayment businessId={business.id} onPaid={() => cycle.refetch()} />
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            {statusCardVisible && statusCard ? (
              <div
                className={`flex items-center justify-between gap-4 rounded-lg border border-white/20 px-6 py-3.5 text-white ${rowClassByStatus[statusCard.status]}`}
              >
                <span className="text-[0.95rem]">
                  {cycle.data
                    ? new Date(cycle.data.accessUntil).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })
                    : "—"}
                </span>
                <span className="text-[0.95rem]">
                  {cycle.data
                    ? (cycle.data.amountCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"}
                </span>
                <span className="text-[0.95rem]">
                  {statusLabel[statusCard.status]}
                  {statusCard.status === "a_vencer" && statusCard.daysLeft === 0
                    ? " · hoje"
                    : statusCard.status === "a_vencer"
                      ? ` · em ${statusCard.daysLeft} dia(s)`
                      : ` · ${Math.abs(statusCard.daysLeft)} dia(s) de atraso`}
                </span>
              </div>
            ) : (
              <div className="rounded-lg border border-white/20 px-6 py-3.5 text-center text-sm text-white/80">
                {cycle.data?.accessUntil
                  ? `Nenhuma fatura em aberto. A próxima aparece aqui 10 dias antes do vencimento (${new Date(cycle.data.accessUntil).toLocaleDateString("pt-BR")}).`
                  : "Carregando faturas…"}
              </div>
            )}
            {pagoHistory.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/20 px-6 py-3.5 text-white bg-[#1e7e4d]"
              >
                <span className="text-[0.95rem]">
                  {new Date(payment.paidAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
                <span className="text-[0.95rem]">
                  {(payment.amountCents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <span className="text-[0.95rem]">Pago</span>
              </div>
            ))}
            {!pagoHistory.length && !statusCardVisible ? null : null}
          </div>
        </div>
      </div>
      {checkoutOpen && mounted
        ? createPortal(
            <div
              className="aa-popup-full fixed inset-0 z-[70] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Confirmar assinatura"
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={closeCheckout}
                className={`fixed inset-0 h-full w-full cursor-default bg-black/60 ${checkoutClosing ? "animate-backdrop-out" : "animate-backdrop"}`}
              />
              {/* Comemoração: cupom do master em vigor → confete ao abrir */}
              {masterCoupon ? <ConfettiBurst /> : null}
              <div className="flex min-h-full items-center justify-center p-4">
                <div
                  className={`relative w-full max-w-md rounded-2xl border border-[var(--c-272a30)] bg-[var(--c-0b0b0e)] p-6 ${checkoutClosing ? "animate-modal-out" : "animate-modal-in"}`}
                >
                  <button
                    type="button"
                    onClick={closeCheckout}
                    aria-label="Fechar"
                    className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-[#30333a] text-[var(--c-9aa4b2)] transition-colors hover:text-white"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                  <h3 className="text-center text-[1.18rem] font-bold text-white">
                    Confirmar assinatura
                  </h3>
                  <p className="mt-1.5 text-center text-sm text-[var(--c-9aa4b2)]">
                    Revise seu pedido antes do pagamento
                  </p>

                  <div className="mt-5 rounded-[10px] border border-[var(--c-2a2e35)] bg-[var(--c-101218)] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">Premium</p>
                        <p className="mt-0.5 text-xs text-[#8b8e96]">Cobrança mensal</p>
                      </div>
                      <p className="font-bold text-white">
                        {brlAssinatura(cycle.data?.baseCents ?? 8990)}
                      </p>
                    </div>
                    {(cycle.data?.professionalsCount ?? 0) > 1 ? (
                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-2">
                        <p className="text-xs text-[#8b8e96]">
                          {Math.max((cycle.data?.professionalsCount ?? 0) - 1, 0)} profissional(is)
                          adicional(is) × R$ 10,00
                        </p>
                        <p className="text-xs font-semibold text-white">
                          +{brlAssinatura(((cycle.data?.professionalsCount ?? 0) - 1) * 1000)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <p className="mb-2 mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[#8b8e96]">
                    Forma de pagamento
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPayMethod("pix")}
                      className={`flex items-center gap-2.5 rounded-[10px] border p-3 text-left transition-colors ${
                        payMethod === "pix"
                          ? "border-[var(--c-2f83ff)]/60 bg-[var(--c-rgba-59-130-246-a0d1)]"
                          : "border-[var(--c-2a2e35)] bg-[var(--c-101218)] hover:border-white/25"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="21"
                        height="21"
                        fill="#32BCAD"
                        aria-hidden="true"
                      >
                        <path d="M5.283 18.36c.85 0 1.647-.331 2.246-.932l3.243-3.242c.228-.228.625-.228.853 0l3.255 3.254a3.152 3.152 0 0 0 2.245.93h.638l-4.106 4.107c-1.282 1.283-3.363 1.283-4.646 0l-4.118-4.117h.39zm12.472-12.72c-.85 0-1.647.33-2.246.93l-3.254 3.255a.604.604 0 0 1-.854 0L8.16 6.573a3.153 3.153 0 0 0-2.246-.932h-.39l4.118-4.117a3.286 3.286 0 0 1 4.646 0l4.106 4.106h-.638zM1.817 9.633l2.492-2.492h.974c.587 0 1.161.238 1.575.652l3.254 3.254a1.55 1.55 0 0 0 1.096.451c.398 0 .796-.15 1.097-.45l3.254-3.255a2.24 2.24 0 0 1 1.575-.652h1.113l2.505 2.505c1.282 1.283 1.282 3.364 0 4.646l-2.505 2.505h-1.113a2.24 2.24 0 0 1-1.575-.651l-3.254-3.254a1.594 1.594 0 0 0-2.193 0l-3.254 3.254a2.24 2.24 0 0 1-1.575.651h-.974l-2.492-2.492c-1.283-1.282-1.283-3.363 0-4.646" />
                      </svg>
                      <span className="min-w-0">
                        <span className="block text-[0.86rem] font-semibold text-white">PIX</span>
                        <span className="block text-xs text-[#8b8e96]">Liberação imediata</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMethod("cartao")}
                      className={`flex items-center gap-2.5 rounded-[10px] border p-3 text-left transition-colors ${
                        payMethod === "cartao"
                          ? "border-[var(--c-2f83ff)]/60 bg-[var(--c-rgba-59-130-246-a0d1)]"
                          : "border-[var(--c-2a2e35)] bg-[var(--c-101218)] hover:border-white/25"
                      }`}
                    >
                      <CreditCard
                        className="size-[21px] shrink-0 text-[var(--c-69a2ff)]"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-[0.86rem] font-semibold text-white">
                          Cartão
                        </span>
                        <span className="block text-xs text-[#8b8e96]">Crédito à vista</span>
                      </span>
                    </button>
                  </div>

                  {/* Cupom — só aparece se o master ativou um cupom para este estabelecimento (auto-expira) */}
                  {payMethod === "pix" && masterCoupon ? (
                    <div className="mt-3">
                      <div className="rounded-[10px] border border-[var(--c-2f83ff)]/50 bg-[var(--c-rgba-59-130-246-a0d1)] px-3 py-2.5">
                        <p className="truncate text-sm text-white">
                          Cupom <span className="font-bold uppercase">{masterCoupon.code}</span>{" "}
                          aplicado — {masterCoupon.percent}% de desconto
                        </p>
                        <p className="mt-0.5 text-xs text-[#8b8e96]">
                          Válido até {new Date(masterCoupon.expiresAt).toLocaleDateString("pt-BR")}{" "}
                          (expira sozinho)
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Dados do cartão */}
                  {payMethod === "cartao" ? (
                    <div className="mt-2.5 space-y-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardForm.number}
                        onChange={(e) =>
                          setCardForm({
                            ...cardForm,
                            number: e.target.value.replace(/\D/g, "").slice(0, 16),
                          })
                        }
                        placeholder="Número do cartão"
                        className="h-11 w-full rounded-[10px] border border-[var(--c-2a2e35)] bg-[var(--c-101218)] px-3 text-sm text-white placeholder:text-[#6d717a] focus:border-[var(--c-2f83ff)]/60 focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cardForm.expiry}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setCardForm({
                              ...cardForm,
                              expiry:
                                digits.length > 2
                                  ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                                  : digits,
                            });
                          }}
                          placeholder="MM/AA"
                          className="h-11 w-full rounded-[10px] border border-[var(--c-2a2e35)] bg-[var(--c-101218)] px-3 text-sm text-white placeholder:text-[#6d717a] focus:border-[var(--c-2f83ff)]/60 focus:outline-none"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cardForm.cvv}
                          onChange={(e) =>
                            setCardForm({
                              ...cardForm,
                              cvv: e.target.value.replace(/\D/g, "").slice(0, 4),
                            })
                          }
                          placeholder="CVV"
                          className="h-11 w-full rounded-[10px] border border-[var(--c-2a2e35)] bg-[var(--c-101218)] px-3 text-sm text-white placeholder:text-[#6d717a] focus:border-[var(--c-2f83ff)]/60 focus:outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        value={cardForm.holder}
                        onChange={(e) => setCardForm({ ...cardForm, holder: e.target.value })}
                        placeholder="Nome impresso no cartão"
                        className="h-11 w-full rounded-[10px] border border-[var(--c-2a2e35)] bg-[var(--c-101218)] px-3 text-sm text-white placeholder:text-[#6d717a] focus:border-[var(--c-2f83ff)]/60 focus:outline-none"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardForm.doc}
                        onChange={(e) =>
                          setCardForm({
                            ...cardForm,
                            doc: e.target.value.replace(/\D/g, "").slice(0, 14),
                          })
                        }
                        placeholder="CPF do titular"
                        className="h-11 w-full rounded-[10px] border border-[var(--c-2a2e35)] bg-[var(--c-101218)] px-3 text-sm text-white placeholder:text-[#6d717a] focus:border-[var(--c-2f83ff)]/60 focus:outline-none"
                      />
                    </div>
                  ) : null}

                  <div className="mt-3.5 flex items-center justify-between border-t border-white/10 py-3.5">
                    <p className="font-semibold text-white">Total</p>
                    <div className="text-right">
                      {masterCoupon && payMethod === "pix" ? (
                        <>
                          <p className="text-xs text-[#8b8e96]">
                            <span className="line-through">{brlAssinatura(baseTotalCents)}</span> (−
                            {brlAssinatura(couponDiscountCents)})
                          </p>
                          <p className="text-[1.4rem] font-bold leading-tight text-emerald-400">
                            {brlAssinatura(pixDiscountedCents)}
                          </p>
                        </>
                      ) : (
                        <p className="text-[1.4rem] font-bold text-white">
                          {brlAssinatura(baseTotalCents)}
                        </p>
                      )}
                    </div>
                  </div>

                  {payMethod === "cartao" ? (
                    <>
                      <button
                        type="button"
                        disabled={
                          cardForm.number.length < 13 ||
                          cardForm.expiry.length < 5 ||
                          cardForm.cvv.length < 3 ||
                          !cardForm.holder.trim() ||
                          cardForm.doc.length < 11
                        }
                        onClick={() =>
                          toast.info(
                            "Checkout com cartão em breve. Fale com o suporte para assinar.",
                          )
                        }
                        className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition-colors hover:bg-[#e5e5e5] disabled:opacity-50"
                      >
                        Pagar com cartão
                      </button>
                      <p className="mt-2.5 text-center text-xs text-[#8b8e96]">
                        Cobrança mensal no cartão de crédito — liberação após a confirmação.
                      </p>
                    </>
                  ) : (
                    <>
                      {business ? (
                        <SubscriptionPixPayment
                          mode="checkout"
                          businessId={business.id}
                          onPaid={() => {
                            closeCheckout();
                            void cycle.refetch();
                          }}
                        />
                      ) : null}
                      <p className="mt-2.5 text-center text-xs text-[#8b8e96]">
                        Pagamento via PIX (instantâneo) — liberação automática.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Confete colorido do popup de assinatura quando o cupom do master está ativo. */
const CONFETTI_COLORS = [
  "#f43f5e",
  "#f97316",
  "#facc15",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: 4 + Math.random() * 92,
        dx: `${(Math.random() * 44 - 22).toFixed(1)}`,
        delay: (Math.random() * 0.6).toFixed(2),
        duration: (2.1 + Math.random() * 1.1).toFixed(2),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        tilt: `${(Math.random() * 360).toFixed(0)}deg`,
        scaleW: `${(0.7 + Math.random() * 0.7).toFixed(2)}`,
      })),
    [],
  );

  return (
    <div
      className="aa-confetti pointer-events-none fixed inset-0 z-[85] overflow-hidden"
      aria-hidden="true"
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="aa-confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              "--confetti-dx": `${piece.dx}vw`,
              "--confetti-tilt": piece.tilt,
              width: `${9 * Number(piece.scaleW)}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Esqueleto neutro exibido entre o clique no menu e a montagem da nova rota.
 * Substitui a tela anterior na hora, evitando o "congelamento" enquanto os dados
 * da próxima página chegam do servidor.
 */
function RoutePendingSkeleton() {
  return (
    <div
      className="owner-route-skeleton animate-slide-up"
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
    >
      <span className="sr-only">Carregando…</span>
      <div className="owner-skeleton-line w-52 max-w-[60%]" />
      <div className="owner-skeleton-line w-80 max-w-[85%]" />
      <div className="owner-skeleton-cards">
        <div className="owner-skeleton-card" />
        <div className="owner-skeleton-card" />
        <div className="owner-skeleton-card" />
      </div>
    </div>
  );
}

function PainelLayout() {
  const { user, signOut } = useAuth();
  const { businesses, business, businessId, isPlatformAdmin } = useBusiness();
  const temaSistema = useTemaSistema();
  const { data: profileAvatarUrl } = usePanelAvatarUrl(panelAvatarPathFromMetadata(user));
  const masterStatusFn = useServerFn(getMasterStatus);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("agenda-agora:sidebar-collapsed") === "true");
    } catch {
      setCollapsed(false);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("agenda-agora:sidebar-collapsed", String(next));
      } catch {
        // O estado continua funcionando durante a sessão mesmo sem armazenamento disponível.
      }
      return next;
    });
  };
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [pendingVisible, setPendingVisible] = useState(false);
  const routerPending = useRouterState({ select: (state) => state.status === "pending" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [impersonation, setImpersonation] = useState<"checking" | "off" | "on">("checking");
  const [impersonationToken, setImpersonationToken] = useState("");
  const [returnPin, setReturnPin] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [impersonationFabOpen, setImpersonationFabOpen] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [profileClosing, setProfileClosing] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [notificationsAuthorized, setNotificationsAuthorized] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return window.sessionStorage.getItem("agenda-agora:notif-auth") === "1";
    } catch {
      return false;
    }
  });
  const [pixPinModalOpen, setPixPinModalOpen] = useState(false);
  const [pixAuthorized, setPixAuthorized] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return window.sessionStorage.getItem("agenda-agora:pix-auth") === "1";
    } catch {
      return false;
    }
  });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    if (pathname === "/painel/configuracoes") setConfigOpen(true);
  }, [pathname]);
  // `location` é otimista (muda no instante do clique); `resolvedLocation` só muda
  // quando a rota nova termina de montar. É esse segundo sinal que revela a página.
  const resolvedPathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  });
  const { data: member } = useQuery({
    queryKey: ["current-professional", user?.id, businessId],
    enabled: !!user?.id && !!businessId,
    queryFn: async () => {
      const { data } = await supabase
        .from("professionals")
        .select("permissions")
        .eq("user_id", user!.id)
        .eq("business_id", businessId!)
        .maybeSingle();
      return data;
    },
  });
  const { data: masterStatus } = useQuery({
    queryKey: ["master-status", user?.id],
    enabled: !!user,
    queryFn: () => masterStatusFn(),
    retry: false,
  });
  const platformMode = isPlatformAdmin || masterStatus?.isMaster === true;
  const permissions =
    member?.permissions &&
    typeof member.permissions === "object" &&
    !Array.isArray(member.permissions)
      ? (member.permissions as Record<string, boolean>)
      : null;
  const canOpen = (to: string) => {
    if (!permissions || !!permissions["admin"]) return true;
    const need = routePermission[to] ?? "admin";
    return Array.isArray(need) ? need.some((k) => !!permissions[k]) : !!permissions[need];
  };

  // Impersonação: banner "Voltar ao Painel Master" só para a sessão gerada pelo
  // botão "Abrir Painel 2" da ficha (token de sessão + negócio + dono validados
  // no servidor). Donos que entram normalmente nunca têm o token → nunca veem.
  const impersonateValidateFn = useServerFn(validateImpersonationSession);
  const impersonateReturnFn = useServerFn(returnToMasterSession);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setImpersonation("checking");
    setImpersonationFabOpen(false);
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem("agenda-agora:impersonation");
    } catch {
      raw = null;
    }
    if (!raw) {
      setImpersonation("off");
      return;
    }
    let token = "";
    try {
      const parsed = JSON.parse(raw) as { token?: unknown; businessId?: unknown };
      if (typeof parsed.token !== "string") {
        setImpersonation("off");
        return;
      }
      token = parsed.token;
    } catch {
      setImpersonation("off");
      return;
    }
    setImpersonationToken(token);
    if (consumeFreshSupportSession(token)) {
      setImpersonation("on");
      return;
    }
    impersonateValidateFn({ data: { token } })
      .then(() => {
        if (!cancelled) setImpersonation("on");
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          window.sessionStorage.removeItem("agenda-agora:impersonation");
        } catch {
          // Ignora.
        }
        setImpersonationToken("");
        setImpersonation("off");
        setReturnOpen(false);
        toast.error("Sessão de suporte expirada ou inválida. Entre novamente como Master.");
        await supabase.auth.signOut({ scope: "local" });
        await navigate({ to: "/auth", replace: true });
      });
    return () => {
      cancelled = true;
    };
    // A new owner/master identity must revalidate support without a full page reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, impersonateValidateFn]);

  const goBackToMaster = useMutation({
    mutationFn: (pin: string) =>
      impersonateReturnFn({
        data: { token: impersonationToken, pin, origin: window.location.origin },
      }),
    onSuccess: async (result) => {
      try {
        window.sessionStorage.removeItem("agenda-agora:impersonation");
      } catch {
        // Ignora.
      }
      // Restaura a sessão do master NA MESMA ORIGEM (sem redirect pelo
      // Supabase — que caía no domínio de produção a partir da LAN/preview).
      const { error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (error) {
        setReturnError("Não foi possível restaurar a sessão do master.");
        return;
      }
      setReturnOpen(false);
      setReturnPin("");
      setReturnError("");
      setImpersonationFabOpen(false);
      setImpersonation("off");
      setImpersonationToken("");
      setPayOpen(false);
      setSubOpen(false);
      setConfigOpen(false);
      setProfileOpen(false);
      toast.success("Sessão do master restaurada.");
      await navigate({ to: "/painel/master", replace: true });
    },
    onError: async (error: Error) => {
      const message = error.message.includes("ORIGIN_NOT_ALLOWED")
        ? "Este endereço não está autorizado para retornar ao Master. Verifique ALLOWED_APP_ORIGINS no servidor."
        : error.message;
      setReturnError(message);
      // Expired/revoked support must end this generated owner session only.
      if (/encerrada|expirada|não encontrada/i.test(error.message)) {
        try {
          window.sessionStorage.removeItem("agenda-agora:impersonation");
        } catch {
          // Ignora.
        }
        setImpersonation("off");
        setImpersonationToken("");
        setReturnOpen(false);
        toast.error(error.message);
        await supabase.auth.signOut({ scope: "local" });
        await navigate({ to: "/auth", replace: true });
      }
    },
  });

  useEffect(() => {
    const href = masterPanelRedirectHref(pathname, window.location, {
      isMaster: masterStatus?.isMaster === true,
      supportState: impersonation,
    });
    if (href) window.location.replace(href);
  }, [masterStatus, pathname, impersonation]);

  // A rota de destino terminou de montar (o `resolvedLocation` mudou): limpa o estado
  // de espera para a página nova aparecer já com a animação de entrada. Usar o
  // `resolvedLocation` (e não o `location`, otimista) evita revelar a tela nova antes
  // da hora — antes o overlay ficava parado sobre a tela nova.
  useEffect(() => {
    setPendingPath(null);
  }, [resolvedPathname]);

  // Rede de segurança: se a navegação não completar, não deixa a tela presa no esqueleto.
  useEffect(() => {
    if (pendingPath === null) return;
    const timer = window.setTimeout(() => setPendingPath(null), 1800);
    return () => window.clearTimeout(timer);
  }, [pendingPath]);

  // Esqueleto visível enquanto a rota de destino ainda não terminou de montar.
  useEffect(() => {
    setPendingVisible(false);
    if (!pendingPath || !routerPending) return;
    const timer = window.setTimeout(() => setPendingVisible(true), 150);
    return () => window.clearTimeout(timer);
  }, [pendingPath, routerPending]);
  const isRoutePending =
    pendingVisible && routerPending && pendingPath !== null && pendingPath !== resolvedPathname;

  const beginNavigation = (to?: string) => {
    setOpen(false);
    setSubOpen(false);
    setPayOpen(false);
    setProfileOpen(false);
    // Já estamos na rota de destino: apenas fecha o menu, sem exibir esqueleto.
    if (!to || to === pathname) return;
    setPendingPath(to);
  };

  const handleNotificationsClick = () => {
    setOpen(false);
    setSubOpen(false);
    setPayOpen(false);
    setProfileOpen(false);
    if (notificationsAuthorized) {
      beginNavigation("/painel/notificacoes-alertas");
      void navigate({ to: "/painel/notificacoes-alertas" });
    } else {
      setPinModalOpen(true);
    }
  };

  const handlePinSuccess = () => {
    setNotificationsAuthorized(true);
    try {
      window.sessionStorage.setItem("agenda-agora:notif-auth", "1");
    } catch {
      // Ignora falhas de armazenamento.
    }
    setPinModalOpen(false);
    beginNavigation("/painel/notificacoes-alertas");
    void navigate({ to: "/painel/notificacoes-alertas" });
  };

  const handlePixAprovacaoClick = () => {
    setOpen(false);
    setSubOpen(false);
    setPayOpen(false);
    setProfileOpen(false);
    if (pixAuthorized) {
      beginNavigation("/painel/pix-aprovacao");
      void navigate({ to: "/painel/pix-aprovacao" });
    } else {
      setPixPinModalOpen(true);
    }
  };

  const handlePixPinSuccess = () => {
    setPixAuthorized(true);
    try {
      window.sessionStorage.setItem("agenda-agora:pix-auth", "1");
    } catch {
      // Ignora falhas de armazenamento.
    }
    setPixPinModalOpen(false);
    beginNavigation("/painel/pix-aprovacao");
    void navigate({ to: "/painel/pix-aprovacao" });
  };

  const visibleNav = platformMode ? platformNav : nav;
  const trial = business ? trialInfo(business) : null;

  // Badges de alerta da sidebar master: Pix aguardando aprovação, contas
  // precisando de atenção e assinantes pagantes do dia (+N, zera à meia-noite).
  const navCountsFn = useServerFn(getPlatformNavCounts);
  const navCounts = useQuery({
    queryKey: ["platform-nav-counts"],
    enabled: platformMode,
    queryFn: () => navCountsFn(),
    refetchInterval: 20_000,
  });
  const navLifecycleFn = useServerFn(getSubscriptionLifecycle);
  const navLifecycle = useQuery({
    queryKey: ["platform-nav-lifecycle"],
    enabled: platformMode,
    queryFn: () => navLifecycleFn(),
    refetchInterval: 60_000,
  });
  const atencaoCount = navLifecycle.data?.kpis.atencao ?? 0;
  const navBadge = (to: string) => {
    if (!platformMode) return null;
    if (to === "/painel/pix-aprovacao") {
      const count = navCounts.data?.pixPendentes ?? 0;
      if (count <= 0) return null;
      return (
        <span
          className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full bg-[#ff5c5c] px-[7px] py-[1px] text-[10.5px] font-bold leading-[1.35] text-white shadow-[0_0_10px_rgba(255,92,92,0.45)]"
          title={`${count} chave${count > 1 ? "s" : ""} Pix em espera de aprovação`}
        >
          {count}
        </span>
      );
    }
    if (to === "/painel/precisa-de-atencao") {
      const count = atencaoCount;
      if (count <= 0) return null;
      return (
        <span
          className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full bg-[#e8b93e] px-[7px] py-[1px] text-[10.5px] font-bold leading-[1.35] text-[#1a1410] shadow-[0_0_10px_rgba(232,185,62,0.4)]"
          title={`${count} conta${count > 1 ? "s" : ""} com assinatura em atraso`}
        >
          {count}
        </span>
      );
    }
    if (to === "/painel/assinantes") {
      const count = navCounts.data?.novosAssinantes ?? 0;
      if (count <= 0) return null;
      return (
        <span
          className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full bg-[#25d366] px-[7px] py-[1px] text-[10.5px] font-bold leading-[1.35] text-[#06250f] shadow-[0_0_10px_rgba(37,211,102,0.4)]"
          title={`+${count} assinante${count > 1 ? "s" : ""} hoje`}
        >
          +{count}
        </span>
      );
    }
    return null;
  };

  // Ciclo de cobrança mensal (5 estágios): lembrete 1 dia antes, aviso no dia,
  // alertas nos 3 dias seguintes e bloqueio no 4º dia após o vencimento.
  const billingFn = useServerFn(getBillingCycle);
  const billing = useQuery({
    queryKey: ["billing-cycle", business?.id ?? null],
    enabled: !platformMode && !!business,
    queryFn: () => billingFn({ data: { businessId: business!.id } }),
    refetchInterval: 30_000,
  });
  const billingStage: BillingStage = billing.data?.stage ?? "ok";
  // Travado: dentro do painel normal, porém fixo na tela de assinaturas — a
  // navegação fica inerte (ver .aa-nav-travado) até o mês estar pago.
  const travadoNaAssinatura = billingStage === "bloqueado";
  const assinaturaNavRef = useRef<HTMLButtonElement | null>(null);

  // Estado do plano do dono (Ativo/Teste/Renovar): usa access_until + histórico
  // de pagamento ("vencimento rolante": dias adicionados pelo master contam).
  const hasPaidQ = useQuery({
    queryKey: ["payment-has-paid", business?.id ?? null],
    enabled: !platformMode && !!business,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("subscription_payments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id)
        .eq("status", "pago");
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },
    refetchInterval: 60_000,
  });
  const planInfo = planState(business ?? null, hasPaidQ.data);

  const renovarAssinatura = () => {
    setPayOpen(true);
    setSubOpen(false);
    setOpen(false);
    setProfileOpen(false);
  };

  // Travado: posiciona a sidebar com o menu Assinatura visível no rodapé da
  // barra (igual à referência), para o dono saber em qual menu está fixo.
  useEffect(() => {
    if (!travadoNaAssinatura) return;
    const aplicar = () => {
      const el = assinaturaNavRef.current;
      const nav = el?.closest("nav");
      if (!el || !nav) return;
      const navRect = nav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const target =
        nav.scrollTop + (elRect.top - navRect.top) - (navRect.height - elRect.height) + 16;
      nav.scrollTo({ top: Math.max(Math.round(target), 0) });
    };
    aplicar();
    // Reaplica após fontes/layout assentarem.
    const timer = window.setTimeout(aplicar, 350);
    return () => window.clearTimeout(timer);
  }, [travadoNaAssinatura]);

  return (
    <div className="owner-panel relative min-h-screen min-h-[100dvh] overflow-x-clip bg-[#050607] text-[var(--c-f3f4f6)] lg:flex">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-40 top-1/4 z-0 size-[28rem] rounded-full bg-[var(--c-2563eb)]/[0.055] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-40 bottom-0 z-0 size-[30rem] rounded-full bg-[var(--c-22d3ee)]/[0.045] blur-3xl"
      />
      <Button
        type="button"
        variant="ghost"
        aria-label="Fechar menu"
        onClick={() => {
          setOpen(false);
          setProfileOpen(false);
        }}
        className={`${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"} fixed inset-0 z-40 h-auto w-auto rounded-none bg-[#050607]/75 p-0 backdrop-blur-[2px] transition-opacity hover:bg-[#050607]/75 lg:hidden`}
      />
      <aside
        data-collapsed={collapsed}
        className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[17.5rem] max-w-[82vw] flex-col overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.33,0,0.2,1)] border-r border-[var(--c-1b2d47)] bg-[radial-gradient(ellipse_120%_54%_at_0%_0%,var(--c-rgba-22-119-255-a0d28)_0%,var(--c-rgba-22-119-255-a0d15)_28%,var(--c-rgba-22-119-255-a0d055)_49%,transparent_72%),linear-gradient(180deg,var(--c-rgba-6-9-15-a0d72)_0%,var(--c-rgba-5-7-11-a0d68)_34%,rgba(5,6,7,0.62)_100%)] px-5 py-4 shadow-[18px_0_55px_rgba(0,0,0,0.35),inset_0_1px_0_var(--c-rgba-93-168-255-a0d10),inset_-1px_0_0_var(--c-rgba-22-119-255-a0d08)] backdrop-blur-xl lg:fixed lg:top-0 lg:h-screen lg:w-[15.5rem] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:px-5 lg:shadow-[inset_0_1px_0_var(--c-rgba-93-168-255-a0d10),inset_-1px_0_0_var(--c-rgba-22-119-255-a0d08)] ${collapsed ? "lg:w-[4.5rem] lg:px-2" : ""}`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-28 -top-32 z-0 h-[23rem] w-[23rem] rounded-full bg-[var(--c-1677ff)]/[0.16] blur-[86px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-[linear-gradient(180deg,var(--c-rgba-93-168-255-a0d075)_0%,var(--c-rgba-22-119-255-a0d025)_42%,transparent_100%)]"
        />

        <Link
          to="/painel"
          onClick={() => beginNavigation("/painel")}
          className={`group relative z-10 flex h-[5.25rem] shrink-0 items-center border-b border-[#25282c] px-1 ${collapsed ? "lg:justify-center" : ""}`}
        >
          {collapsed ? (
            <span
              className="hidden size-10 items-center justify-center lg:flex"
              aria-label="Agenda Agora"
            >
              <img
                src={brandMark}
                alt="Agenda Agora"
                decoding="async"
                className="size-9 object-contain"
              />
            </span>
          ) : (
            <img
              src={brandLogoByTheme[temaSistema]}
              alt="Agenda Agora"
              decoding="async"
              // Se o arquivo do tema não existir no ambiente, volta ao logo azul
              // em vez de exibir um espaço vazio na sidebar.
              onError={(event) => {
                const target = event.currentTarget;
                if (target.src.endsWith(brandLogoByTheme.azul)) return;
                target.src = brandLogoByTheme.azul;
              }}
              className="aa-logo-theme h-12 w-auto max-w-[210px] object-contain object-left px-2 transition-transform duration-300 group-hover:scale-[1.01]"
            />
          )}
        </Link>

        <div
          className={`relative z-20 shrink-0 border-b border-[#25282c] px-1 py-3 ${collapsed ? "lg:hidden" : ""}`}
        >
          <SidebarProfileWidget
            businessId={businessId ?? null}
            name={
              business?.name ?? (platformMode ? "Administração da plataforma" : "Estabelecimento")
            }
            initial={(business?.name ?? (platformMode ? "Administração" : "Estabelecimento"))
              .charAt(0)
              .toUpperCase()}
            role={platformMode ? "Plataforma" : "Usuário"}
            statusLabel={platformMode ? "Plataforma" : planInfo.label}
            statusTone={platformMode ? undefined : (planInfo.tone as string)}
            profileOpen={profileOpen}
            onProfileClick={() => {
              // Abre/fecha o card de dados com animacao suave (saida antes de sumir).
              if (profileOpen) {
                setProfileClosing(true);
                window.setTimeout(() => {
                  setProfileOpen(false);
                  setProfileClosing(false);
                }, 190);
              } else {
                setProfileOpen(true);
              }
            }}
            platformMode={platformMode}
            onLogout={async () => {
              await signOut();
              void navigate({ to: "/auth" });
            }}
          />
          {!business && !platformMode && null}
          {profileOpen && (
            <div
              className={`absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border border-[#2b2b2e] bg-black py-[17px] px-3.5 shadow-2xl ${
                profileClosing ? "profile-pop-out" : "profile-pop-in"
              }`}
            >
              <div className="flex items-center gap-2">
                {profileAvatarUrl ? (
                  <div className="size-9 shrink-0 overflow-hidden rounded-[11px]">
                    <img src={profileAvatarUrl} alt="" className="size-full object-cover" />
                  </div>
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--c-f2f3f5)] text-xs font-semibold text-[var(--c-111318)]">
                    {(business?.name ?? (platformMode ? "Administração" : "Estabelecimento"))
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="text-[13px] font-semibold text-white">
                    {platformMode ? "Guilherme" : (business?.name ?? user?.email ?? "Usuário")}
                  </p>
                  <p className="text-[11px] text-[#626872]">Dados da conta</p>
                </div>
              </div>
              <div className="mt-4 border-t border-[#2b2b2e]" />
              <div className="mt-3 space-y-1.5 text-[11.5px]">
                <div className="flex justify-between">
                  <span className="text-[#626872]">Estabelecimento</span>
                  <span className="text-white">{business?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#626872]">Telefone</span>
                  <span className="text-white">
                    {business?.phone ? formatPhoneBR(business.phone) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#626872]">Plano</span>
                  <span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold ${planInfo.badgeClass}`}
                    >
                      {planInfo.label}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#626872]">Acesso</span>
                  <span
                    className={business?.status === "suspenso" ? "text-destructive" : "text-white"}
                  >
                    {business?.status === "suspenso" ? "Bloqueado" : "Ativo"}
                  </span>
                </div>
              </div>
              <a
                href="/painel/assinatura"
                data-status="active"
                aria-current="page"
                onClick={(event) => {
                  event.preventDefault();
                  setPayOpen(false);
                  setSubOpen(true);
                  setOpen(false);
                  setProfileOpen(false);
                }}
                className="mt-3 flex w-full items-center justify-center rounded-xl border border-[var(--c-262a30)] bg-[var(--c-111317)] px-3 py-2 text-[11px] font-medium text-[var(--c-cfd3d9)] transition-colors hover:border-[var(--c-1677ff)]/30 hover:bg-[var(--c-1677ff)]/[0.06] hover:text-white active"
              >
                Ver dados da assinatura
              </a>
            </div>
          )}
        </div>

        <nav
          className={`relative z-10 min-h-0 flex-1 overflow-y-auto pr-1 ${collapsed ? "space-y-2 py-2 lg:space-y-1" : "space-y-6 py-5"} ${travadoNaAssinatura ? "aa-nav-travado" : ""}`}
        >
          {visibleNav.map((group) => (
            <section key={group.title}>
              <div className="owner-sidebar-collapsible">
                <p className="px-3 pb-2 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#4f5660]">
                  {group.title}
                </p>
              </div>
              <div className="space-y-1">
                {group.items
                  .filter((item) => canOpen(item.to))
                  .map((item) => {
                    if ("children" in item && item.children) {
                      const isExpanded = configOpen;
                      return (
                        <div key={item.to} className="space-y-1">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => setConfigOpen((v) => !v)}
                            className={`owner-nav-item group relative flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-200 ${pathname === "/painel/configuracoes" ? "owner-nav-active border-[var(--c-1677ff)]/15 bg-[var(--c-1677ff)]/[0.09] text-[var(--c-f3f4f6)]" : ""}`}
                          >
                            <item.icon
                              className="size-5 shrink-0 transition-colors group-hover:text-[var(--c-5da8ff)]"
                              strokeWidth={1.8}
                            />
                            <span className="min-w-0 flex-1 leading-[1.25]">
                              <span className="owner-nav-label block text-[0.86rem] font-medium">
                                {item.label}
                              </span>
                              <span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-[var(--c-555d68)]">
                                {item.hint}
                              </span>
                            </span>
                            <ChevronDown
                              className={`size-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                          <div
                            className={`ml-2 space-y-1 rounded-xl border border-[var(--c-1677ff)]/10 bg-[var(--c-1677ff)]/[0.045] p-1.5 transition-all duration-200 ease-in-out ${isExpanded ? "" : "hidden"}`}
                          >
                            {item.children.map((child) => (
                              <Link
                                key={child.to}
                                to={child.to as never}
                                activeOptions={{ exact: false }}
                                onClick={() => {
                                  setConfigOpen(false);
                                  beginNavigation(child.to);
                                }}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[0.82rem] font-medium text-[var(--c-c9ced6)] transition-colors hover:bg-[var(--c-1677ff)]/10 hover:text-white"
                              >
                                {child.icon ? (
                                  <child.icon className="size-4 text-[var(--c-5da8ff)]" />
                                ) : null}
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (item.to === "/painel/pix-aprovacao") {
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          activeOptions={{ exact: false }}
                          onClick={(e) => {
                            e.preventDefault();
                            handlePixAprovacaoClick();
                          }}
                          className={`owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent py-2.5 text-[#7f8793] transition-all duration-200 hover:border-[var(--c-1677ff)]/10 hover:bg-[var(--c-1677ff)]/[0.055] hover:text-[var(--c-e5e7eb)] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`}
                          activeProps={
                            payOpen || subOpen
                              ? {
                                  className: `owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent py-2.5 text-[#7f8793] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`,
                                }
                              : {
                                  className: `owner-nav-item owner-nav-active group relative flex items-center gap-3 rounded-xl border border-[var(--c-1677ff)]/15 bg-[var(--c-1677ff)]/[0.09] py-2.5 text-[var(--c-f3f4f6)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`,
                                }
                          }
                        >
                          <item.icon
                            className="size-5 shrink-0 transition-colors group-hover:text-[var(--c-5da8ff)]"
                            strokeWidth={1.8}
                          />
                          <span className="owner-nav-copy min-w-0 leading-[1.25]">
                            <span className="owner-nav-label block text-[0.86rem] font-medium">
                              {item.label}
                            </span>
                            <span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-[var(--c-555d68)]">
                              {item.hint}
                            </span>
                          </span>
                          {!collapsed && navBadge(item.to)}
                        </Link>
                      );
                    }
                    if (item.to === "/painel/notificacoes-alertas") {
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          activeOptions={{ exact: false }}
                          onClick={(e) => {
                            e.preventDefault();
                            handleNotificationsClick();
                          }}
                          className={`owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent py-2.5 text-[#7f8793] transition-all duration-200 hover:border-[var(--c-1677ff)]/10 hover:bg-[var(--c-1677ff)]/[0.055] hover:text-[var(--c-e5e7eb)] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`}
                          activeProps={
                            payOpen || subOpen
                              ? {
                                  className: `owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent py-2.5 text-[#7f8793] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`,
                                }
                              : {
                                  className: `owner-nav-item owner-nav-active group relative flex items-center gap-3 rounded-xl border border-[var(--c-1677ff)]/15 bg-[var(--c-1677ff)]/[0.09] py-2.5 text-[var(--c-f3f4f6)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`,
                                }
                          }
                        >
                          <item.icon
                            className="size-5 shrink-0 transition-colors group-hover:text-[var(--c-5da8ff)]"
                            strokeWidth={1.8}
                          />
                          <span className="owner-nav-copy min-w-0 leading-[1.25]">
                            <span className="owner-nav-label block text-[0.86rem] font-medium">
                              {item.label}
                            </span>
                            <span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-[var(--c-555d68)]">
                              {item.hint}
                            </span>
                          </span>
                          {!collapsed && navBadge(item.to)}
                        </Link>
                      );
                    }
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        activeOptions={{ exact: "exact" in item ? item.exact : false }}
                        onClick={() => beginNavigation(item.to)}
                        className={`owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent py-2.5 text-[#7f8793] transition-all duration-200 hover:border-[var(--c-1677ff)]/10 hover:bg-[var(--c-1677ff)]/[0.055] hover:text-[var(--c-e5e7eb)] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`}
                        activeProps={
                          payOpen || subOpen
                            ? {
                                className: `owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent py-2.5 text-[#7f8793] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`,
                              }
                            : {
                                className: `owner-nav-item owner-nav-active group relative flex items-center gap-3 rounded-xl border border-[var(--c-1677ff)]/15 bg-[var(--c-1677ff)]/[0.09] py-2.5 text-[var(--c-f3f4f6)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`,
                              }
                        }
                      >
                        <item.icon
                          className="size-5 shrink-0 transition-colors group-hover:text-[var(--c-5da8ff)]"
                          strokeWidth={1.8}
                        />
                        <span className="owner-nav-copy min-w-0 leading-[1.25]">
                          <span className="owner-nav-label block text-[0.86rem] font-medium">
                            {item.label}
                          </span>
                          <span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-[var(--c-555d68)]">
                            {item.hint}
                          </span>
                        </span>
                        {!collapsed && navBadge(item.to)}
                      </Link>
                    );
                  })}
                {!platformMode && group.title === "Financeiro" ? (
                  <button
                    ref={assinaturaNavRef}
                    type="button"
                    onClick={() => {
                      setPayOpen(true);
                      setSubOpen(false);
                      setOpen(false);
                      setProfileOpen(false);
                    }}
                    className={`owner-assinatura-nav owner-nav-item group relative flex w-full items-center gap-3 rounded-xl border border-transparent py-2.5 text-left text-[#7f8793] transition-all duration-200 hover:border-[var(--c-1677ff)]/10 hover:bg-[var(--c-1677ff)]/[0.055] hover:text-[var(--c-e5e7eb)] ${payOpen || travadoNaAssinatura ? "owner-nav-active aa-assinatura-ativa" : ""} ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`}
                  >
                    <CreditCard
                      className="size-5 shrink-0 text-[#25d366] transition-colors group-hover:text-[#2fe873]"
                      strokeWidth={1.8}
                    />
                    <span className="owner-nav-copy min-w-0 leading-[1.25]">
                      <span className="owner-nav-label block text-[0.86rem] font-medium text-[#25d366]">
                        Assinatura
                      </span>
                      <span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-[var(--c-555d68)]">
                        Seu plano e upgrades
                      </span>
                    </span>
                  </button>
                ) : null}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div
        className={`owner-main-content relative z-10 min-w-0 flex-1 ${collapsed ? "lg:pl-[4.5rem]" : "lg:pl-[15.5rem]"}`}
      >
        <div
          aria-hidden="true"
          className={`owner-route-progress ${isRoutePending ? "is-visible" : ""}`}
        />
        <header className="sticky top-0 z-30 grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#25282c] bg-[#050607]/90 px-3 py-[8.5px] shadow-[0_10px_35px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            style={{ width: 39, height: 39 }}
            className="size-[39px] shrink-0 rounded-xl border border-[#2b2b2e] bg-[var(--c-0d0d10)] text-[#e6e6e6] shadow-none hover:bg-[var(--c-121216)] hover:text-white"
            onClick={() => {
              if (window.matchMedia("(min-width: 1024px)").matches) toggleCollapsed();
              else {
                // Reabrindo a barra no celular: apenas o submenu Configurações
                // volta fechado. As telas abertas (Carteira/Assinatura) permanecem.
                if (!open) {
                  setConfigOpen(false);
                }
                setOpen((v) => !v);
              }
            }}
            aria-label="Alternar menu lateral"
          >
            <Menu className="size-[39px]" />
          </Button>
          <Link
            to="/painel"
            onClick={() => beginNavigation("/painel")}
            className="flex min-w-0 items-center justify-center"
            aria-label="Agenda Agora — início"
          >
            <span className="relative flex size-[47px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--c-1677ff)]/70 bg-[var(--c-0d0d10)] shadow-[0_0_16px_var(--c-rgba-22-119-255-a0d25)]">
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,var(--c-rgba-56-150-255-a0d42)_0%,var(--c-rgba-22-119-255-a0d13)_48%,transparent_72%)]"
              />
              <img
                src={brandMark}
                alt="Agenda Agora"
                decoding="async"
                className="relative h-[38px] w-auto -translate-y-[1px] object-contain"
              />
            </span>
          </Link>
          <NotificationBell
            audienceTag={
              platformMode
                ? undefined
                : planInfo.tone === "ativo"
                  ? "assinantes"
                  : planInfo.tone === "teste"
                    ? "teste"
                    : "expirados"
            }
          />
          <FloatingSupportButton
            businessId={businessId ?? null}
            ownerName={business?.name ?? null}
          />
        </header>
        <main
          data-resolved-pathname={resolvedPathname}
          aria-busy={routerPending}
          className={`relative mx-auto w-full ${
            resolvedPathname.startsWith("/painel/aparencia-editor")
              ? "max-w-none p-0 sm:p-0 lg:p-0"
              : "max-w-7xl p-4 sm:p-7 lg:p-8"
          }`}
        >
          {travadoNaAssinatura ? (
            <div key="assinatura-travada" className="owner-route-content">
              <PagamentosView business={business ?? null} />
            </div>
          ) : payOpen ? (
            <div key="as-pay" className="owner-route-content">
              <PagamentosView business={business ?? null} />
            </div>
          ) : subOpen ? (
            <div key="assinatura" className="owner-route-content">
              <AssinaturaContaPanel business={business} user={user} platformMode={platformMode} />
            </div>
          ) : isRoutePending ? (
            <RoutePendingSkeleton />
          ) : (
            <div key={resolvedPathname} className="owner-route-content">
              <Outlet />
            </div>
          )}
        </main>
      </div>
      <SecurityPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
      <SecurityPinModal
        isOpen={pixPinModalOpen}
        onClose={() => setPixPinModalOpen(false)}
        onSuccess={handlePixPinSuccess}
      />
      {/* Impersonação (Abrir Painel 2): botão flutuante redondo (como o botão
          de suporte) — não cobre a tela no celular. O clique abre o popover com
          a opção de voltar ao Painel Master (PIN). Donos que entram
          normalmente nunca têm esse token. */}
      {impersonation === "on" ? (
        <>
          {impersonationFabOpen ? (
            <div className="aa-aviso-in fixed bottom-[10.75rem] right-6 z-40 w-[16.5rem] rounded-2xl border border-[#2a2f37] bg-[#0d1015] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.7)]">
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setImpersonationFabOpen(false)}
                className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full text-[#9aa1ab] transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
              <p className="flex items-start gap-2 pr-6 text-xs font-semibold leading-relaxed text-amber-200">
                <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                Você está acessando como cliente (sessão da equipe Agenda Agora)
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3 h-9 w-full rounded-lg bg-amber-500 text-[11px] font-bold text-black hover:bg-amber-400"
                onClick={() => {
                  setImpersonationFabOpen(false);
                  setReturnError("");
                  setReturnOpen(true);
                }}
              >
                Voltar ao Painel Master
              </Button>
            </div>
          ) : null}
          <div className="fixed bottom-[6.5rem] right-6 z-40">
            <button
              type="button"
              aria-label="Sessão de suporte — voltar ao Painel Master"
              onClick={() => setImpersonationFabOpen((value) => !value)}
              className="impersonation-fab"
            >
              <LockKeyhole className="size-6" strokeWidth={2} />
              <span className="impersonation-fab-dot" aria-hidden="true" />
            </button>
          </div>
        </>
      ) : null}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-[#2a2f37] bg-[#0d1015]">
          <DialogHeader>
            <DialogTitle className="text-[var(--c-eef1f6)]">Voltar ao Painel Master</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-[#9aa1ab]">
              Acesso restrito à equipe. Digite o PIN de retorno da equipe Agenda Agora para encerrar
              a sessão do cliente e restaurar o Painel 3.
            </p>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={returnPin}
              onChange={(event) => setReturnPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="PIN de 8 dígitos"
              className="h-11 border-white/10 bg-black/40 text-center text-lg tracking-[0.4em] text-white"
            />
            {returnError ? (
              <p role="alert" className="text-xs text-destructive">
                {returnError}
              </p>
            ) : null}
            <Button
              type="button"
              disabled={goBackToMaster.isPending || returnPin.length < 4}
              onClick={() => goBackToMaster.mutate(returnPin)}
              className="h-10 w-full rounded-xl bg-[var(--c-1677ff)] font-bold text-white hover:bg-[var(--c-3b82f6)]"
            >
              {goBackToMaster.isPending ? "Restaurando…" : "Voltar ao Painel Master"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Avisos de cobrança (5 estágios) — só para donos, nunca no modo plataforma.
          Durante o suporte (impersonação pelo master) também fica escondido:
          quem está dando suporte não precisa do lembrete cobrindo o banner. */}
      {!platformMode &&
      impersonation !== "on" &&
      business &&
      billingStage !== "ok" &&
      billingStage !== "bloqueado" ? (
        <AvisoCobranca
          key={`${business.id}:${billingStage}`}
          stage={billingStage}
          businessId={business.id}
          businessName={business.name}
          onRenovar={renovarAssinatura}
        />
      ) : null}
    </div>
  );
}
