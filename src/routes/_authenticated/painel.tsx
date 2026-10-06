import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Users,
  Scissors,
  UserRound,
  LogOut,
  Menu,
  Bell,
  BellRing,
  Gem,
  PieChart,
  MessageSquareText,
  CircleX,
  Settings2,
  MessageCircle,
  UserCircle,
  Clock3,
  LoaderCircle,
  Link2,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { getMasterStatus } from "@/lib/admin.functions";
import { getWhatsappStatus } from "@/lib/whatsapp.functions";
import { useBusiness } from "@/lib/business";
import { publicBookingUrl } from "@/lib/public-booking-link";
import { panelPathHref, publicBookingOrigin } from "@/lib/app-hosts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const brandLogo = "/agenda-agora-sidebar-logo-v2.png";
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
      <p className="text-sm text-[#9ca3af]">Não encontramos esta página do painel.</p>
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
      { to: "/painel/as-pay", label: "AS Pay", hint: "Saldo dos sinais", icon: Gem },
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
      },
    ],
  },
] as const;

const routePermission: Partial<Record<string, string>> = {
  "/painel": "view_agenda",
  "/painel/bloqueios": "block_schedule",
  "/painel/clientes": "view_customer_phone",
  "/painel/relatorio": "view_reports",
};

function WhatsappBadge() {
  const { businessId } = useBusiness();
  const statusFn = useServerFn(getWhatsappStatus);
  const { data } = useQuery({
    queryKey: ["whatsapp-status", businessId],
    queryFn: () => statusFn({ data: { businessId: businessId! } }),
    enabled: !!businessId,
    refetchInterval: (query) => (query.state.data?.status === "conectado" ? false : 15_000),
    refetchIntervalInBackground: false,
  });
  const connected = data?.status === "conectado";
  return (
    <Link
      to="/painel/integracoes"
      className={`flex flex-1 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium ${connected ? "border-primary/60 text-primary" : "border-destructive/50 text-destructive"}`}
    >
      <MessageCircle className="mr-2 size-4" />
      {connected ? "WHATSAPP CONECTADO" : "WHATSAPP DESCONECTADO"}
    </Link>
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

function PainelLayout() {
  const { user, signOut } = useAuth();
  const { businesses, business, businessId, isPlatformAdmin } = useBusiness();
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
  const [transitioning, setTransitioning] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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
    queryKey: ["master-status"],
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
  const canOpen = (to: string) =>
    !permissions || !!permissions["admin"] || !!permissions[routePermission[to] ?? "admin"];

  useEffect(() => {
    if (!masterStatus) return;
    const href = panelPathHref(pathname, window.location);
    if (!href.startsWith("/") && href !== window.location.href) window.location.replace(href);
  }, [masterStatus, pathname]);

  useEffect(() => {
    if (!transitioning) return;
    const timer = window.setTimeout(() => setTransitioning(false), 360);
    return () => window.clearTimeout(timer);
  }, [pathname, transitioning]);

  const beginNavigation = () => {
    setOpen(false);
    setTransitioning(true);
  };

  const visibleNav = platformMode ? [] : nav;

  return (
    <div className="owner-panel relative min-h-screen min-h-[100dvh] overflow-x-clip bg-[#050607] text-[#f3f4f6] lg:flex">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_0%_20%,rgba(15,48,86,0.42),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(0,70,150,0.16),transparent_34%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(115deg,rgba(11,29,49,0.18),transparent_32%,transparent_70%,rgba(4,15,28,0.18))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-40 top-1/4 z-0 size-[28rem] rounded-full bg-blue-600/[0.055] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-40 bottom-0 z-0 size-[30rem] rounded-full bg-cyan-400/[0.045] blur-3xl"
      />
      <Button
        type="button"
        variant="ghost"
        aria-label="Fechar menu"
        onClick={() => setOpen(false)}
        className={`${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"} fixed inset-0 z-40 h-auto w-auto rounded-none bg-[#050607]/75 p-0 backdrop-blur-[2px] transition-opacity hover:bg-[#050607]/75 lg:hidden`}
      />
      <aside
        data-collapsed={collapsed}
        className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[17.5rem] max-w-[82vw] flex-col overflow-hidden border-r border-[#1b2d47] bg-[radial-gradient(ellipse_120%_54%_at_0%_0%,rgba(22,119,255,0.28)_0%,rgba(22,119,255,0.15)_28%,rgba(22,119,255,0.055)_49%,transparent_72%),linear-gradient(180deg,rgba(6,9,15,0.72)_0%,rgba(5,7,11,0.68)_34%,rgba(5,6,7,0.62)_100%)] px-5 py-4 shadow-[18px_0_55px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(93,168,255,0.10),inset_-1px_0_0_rgba(22,119,255,0.08)] backdrop-blur-xl transition-[width,transform,padding] duration-200 ease-out lg:fixed lg:top-0 lg:h-screen lg:w-[18.5rem] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:px-5 lg:shadow-[inset_0_1px_0_rgba(93,168,255,0.10),inset_-1px_0_0_rgba(22,119,255,0.08)] ${collapsed ? "lg:w-[4.5rem] lg:px-2" : ""}`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-28 -top-32 z-0 h-[23rem] w-[23rem] rounded-full bg-[#1677ff]/[0.16] blur-[86px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0 h-[18rem] w-px bg-gradient-to-b from-[#5da8ff]/70 via-[#1677ff]/30 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-[linear-gradient(180deg,rgba(93,168,255,0.075)_0%,rgba(22,119,255,0.025)_42%,transparent_100%)]"
        />

        <Link
          to="/painel"
          onClick={beginNavigation}
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
              src={brandLogo}
              alt="Agenda Agora"
              decoding="async"
              className="h-12 w-auto max-w-[210px] object-contain object-left px-2 transition-transform duration-300 group-hover:scale-[1.01]"
            />
          )}
        </Link>

        <div
          className={`relative z-10 shrink-0 border-b border-[#25282c] px-1 py-3 ${collapsed ? "lg:hidden" : ""}`}
        >
          <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#f2f3f5] text-[11px] font-semibold text-[#111318] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
              {(business?.name ?? user?.email ?? "A").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-semibold leading-[14px] tracking-[-0.01em] text-[#f0f1f3]">
                {business?.name ??
                  (platformMode ? "Administração da plataforma" : "Acesso do estabelecimento")}
              </span>
              <span className="mt-[3px] block truncate text-[9.5px] leading-3 text-[#626872]">
                {user?.email}
              </span>
            </span>
          </div>
          {!business && (
            <div className="mt-2 rounded-xl border border-dashed border-[#262a30] px-3 py-2 text-[11px] text-[#646b75]">
              {platformMode
                ? "Acesso de plataforma; use o Painel Master para gerenciar estabelecimentos."
                : "Aguardando configuração pelo painel Master."}
            </div>
          )}
          {businesses.length > 1 && (
            <p className="mt-2 text-[10px] leading-4 text-[#676d76]">
              Este acesso possui mais de uma unidade vinculada. A seleção de unidade é administrada
              pelo Master.
            </p>
          )}
        </div>

        <nav
          className={`relative z-10 min-h-0 flex-1 overflow-y-auto pr-1 ${collapsed ? "space-y-2 py-2 lg:space-y-1" : "space-y-6 py-5"}`}
        >
          {visibleNav.map((group) => (
            <section key={group.title}>
              <p
                className={`px-3 pb-2 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#4f5660] ${collapsed ? "lg:hidden" : ""}`}
              >
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items
                  .filter((item) => canOpen(item.to))
                  .map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: "exact" in item ? item.exact : false }}
                      onClick={beginNavigation}
                      className={`owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent py-2.5 text-[#7f8793] transition-all duration-200 hover:border-[#1677ff]/10 hover:bg-[#1677ff]/[0.055] hover:text-[#e5e7eb] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`}
                      activeProps={{
                        className: `owner-nav-item owner-nav-active group relative flex items-center gap-3 rounded-xl border border-[#1677ff]/15 bg-[#1677ff]/[0.09] py-2.5 text-[#f3f4f6] shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${collapsed ? "lg:justify-center lg:px-0" : "px-3"}`,
                      }}
                    >
                      <item.icon
                        className="size-5 shrink-0 transition-colors group-hover:text-[#5da8ff]"
                        strokeWidth={1.8}
                      />
                      <span className={`min-w-0 leading-[1.25] ${collapsed ? "lg:hidden" : ""}`}>
                        <span className="owner-nav-label block text-[0.86rem] font-medium">
                          {item.label}
                        </span>
                        <span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-[#555d68]">
                          {item.hint}
                        </span>
                      </span>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
          {masterStatus?.isMaster && (
            <section>
              <p
                className={`px-3 pb-2 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#4f5660] ${collapsed ? "lg:hidden" : ""}`}
              >
                Plataforma
              </p>
              <Link
                to="/painel/master"
                onClick={(event) => {
                  const href = panelPathHref("/painel/master", window.location);
                  if (!href.startsWith("/")) {
                    event.preventDefault();
                    window.location.assign(href);
                    return;
                  }
                  beginNavigation();
                }}
                className="owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-[#7f8793] transition-all hover:border-[#1677ff]/10 hover:bg-[#1677ff]/[0.055] hover:text-[#e5e7eb]"
                activeProps={{
                  className:
                    "owner-nav-item owner-nav-active group flex items-center gap-3 rounded-xl border border-[#1677ff]/15 bg-[#1677ff]/[0.09] px-3 py-2.5 text-[#f3f4f6]",
                }}
              >
                <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
                <span
                  className={`owner-nav-label text-[0.86rem] font-medium ${collapsed ? "lg:hidden" : ""}`}
                >
                  Painel Master
                </span>
              </Link>
            </section>
          )}
        </nav>

        <div
          className={`relative z-20 shrink-0 border-t border-[#25282c] pt-3 ${collapsed ? "lg:px-0 lg:pt-2" : ""}`}
        >
          <div
            className={`mb-2 flex items-center gap-3 px-3 py-2 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            <UserCircle className="size-5 shrink-0 text-[#5da8ff]" aria-label="Conta" />
            <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate text-[0.82rem] font-medium text-[#c8cdd4]">
                {platformMode ? "Conta da plataforma" : "Conta do estabelecimento"}
              </span>
              <span className="block text-[0.68rem] text-[#626872]">
                {business?.status === "suspenso" ? "Conta bloqueada" : "Conta ativa"}
              </span>
            </span>
          </div>
          <Button
            variant="ghost"
            aria-label="Sair"
            title="Sair"
            className={`mt-1 w-full rounded-xl text-[#c8cdd4] hover:bg-white/[0.035] hover:text-white ${collapsed ? "lg:justify-center lg:px-0" : "justify-start"}`}
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" />
            <span className={collapsed ? "lg:hidden" : ""}>Sair</span>
          </Button>
        </div>
      </aside>

      <div
        className={`relative z-10 min-w-0 flex-1 transition-[padding] duration-200 ${collapsed ? "lg:pl-[4.5rem]" : "lg:pl-[18.5rem]"}`}
      >
        <div
          aria-hidden="true"
          className={`owner-route-progress ${transitioning ? "is-visible" : ""}`}
        />
        <header className="sticky top-0 z-30 grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#25282c] bg-[#050607]/90 px-3 py-3 shadow-[0_10px_35px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-[11px] border border-[#2b2b2e] bg-[#0d0d10] text-[#e6e6e6] shadow-none hover:bg-[#121216] hover:text-white"
            onClick={() => {
              if (window.matchMedia("(min-width: 1024px)").matches) toggleCollapsed();
              else setOpen((v) => !v);
            }}
            aria-label="Alternar menu lateral"
          >
            <Menu className="size-5" />
          </Button>
          {platformMode ? <span /> : <WhatsappBadge />}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl text-[#7f8793] hover:bg-[#1677ff]/[0.055] hover:text-[#f3f4f6]"
            aria-label="Notificações"
          >
            <Bell className="size-5" />
          </Button>
        </header>
        <main className="relative mx-auto w-full max-w-7xl p-4 sm:p-7 lg:p-8">
          {transitioning && (
            <div className="owner-route-loader" aria-label="Carregando página" role="status">
              <LoaderCircle className="size-6 animate-spin text-[#1677ff]" />
            </div>
          )}
          <PublicBookingLinkCard slug={business?.slug} />
          <div key={pathname} className="owner-route-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
