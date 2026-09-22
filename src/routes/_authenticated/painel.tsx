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
  Calculator,
  MessageSquareText,
  DollarSign,
  CircleX,
  Settings2,
  MessageCircle,
  UserCircle,
  Clock3,
  LoaderCircle,
  Package,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import brandLogo from "@/assets/agenda-agora-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Agenda Agora" },
      { name: "description", content: "Gerencie a agenda, os serviços e os clientes do negócio." },
      { property: "og:title", content: "Painel — Agenda Agora" },
      { property: "og:description", content: "Gerencie a agenda do seu negócio." },
    ],
  }),
  component: PainelLayout,
});

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
      { to: "/painel/produtos", label: "Produtos", hint: "Produtos e catálogo", icon: Package },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { to: "/painel/as-pay", label: "AS Pay", hint: "Saldo dos sinais", icon: Gem },
      { to: "/painel/caixa", label: "Caixa", hint: "Entradas e saídas", icon: Calculator },
      {
        to: "/painel/pagamentos",
        label: "Pagamentos",
        hint: "Histórico da assinatura",
        icon: DollarSign,
      },
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
  "/painel/caixa": "view_financial",
  "/painel/pagamentos": "view_financial",
  "/painel/relatorio": "view_reports",
};

function WhatsappBadge() {
  const { businessId } = useBusiness();
  const { data } = useQuery({
    queryKey: ["whatsapp-badge", businessId],
    queryFn: async () => {
      const { data: row } = await supabase
        .from("businesses")
        .select("whatsapp_status")
        .eq("id", businessId!)
        .maybeSingle();
      return row?.whatsapp_status ?? "desconectado";
    },
    enabled: !!businessId,
    refetchInterval: 15000,
  });
  const connected = data === "conectado";
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

function PainelLayout() {
  const { user, signOut } = useAuth();
  const { businesses, business, businessId } = useBusiness();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
  const permissions =
    member?.permissions &&
    typeof member.permissions === "object" &&
    !Array.isArray(member.permissions)
      ? (member.permissions as Record<string, boolean>)
      : null;
  const canOpen = (to: string) =>
    !permissions || !!permissions["admin"] || !!permissions[routePermission[to] ?? "admin"];

  useEffect(() => {
    if (!transitioning) return;
    const timer = window.setTimeout(() => setTransitioning(false), 360);
    return () => window.clearTimeout(timer);
  }, [pathname, transitioning]);

  const beginNavigation = () => {
    setOpen(false);
    setTransitioning(true);
  };

  return (
    <div className="owner-panel min-h-screen overflow-x-hidden bg-background lg:flex">
      <Button
        type="button"
        variant="ghost"
        aria-label="Fechar menu"
        onClick={() => setOpen(false)}
        className={`${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"} fixed inset-0 z-40 h-auto w-auto rounded-none bg-background/75 p-0 backdrop-blur-[2px] transition-opacity hover:bg-background/75 lg:hidden`}
      />
      <aside
        className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[17.5rem] max-w-[78vw] flex-col border-r border-sidebar-border bg-sidebar px-5 py-4 shadow-2xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-[18.5rem] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:overflow-y-auto lg:px-5 lg:shadow-none`}
      >
        <Link
          to="/painel"
          onClick={beginNavigation}
          className="flex h-[5.25rem] shrink-0 items-center border-b border-sidebar-border px-1"
        >
          <img
            src={brandLogo.url}
            alt="Agenda Agora"
            decoding="async"
            className="h-11 w-auto max-w-[220px] object-contain object-left"
          />
        </Link>

        <div className="border-b border-sidebar-border px-1 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-foreground font-display text-base font-bold text-background">
              {(business?.name ?? user?.email ?? "A").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.85rem] font-medium text-sidebar-accent-foreground">
                {business?.name ?? "Acesso do estabelecimento"}
              </span>
              <span className="mt-px block truncate text-[0.72rem] text-muted-foreground">
                {user?.email}
              </span>
            </span>
          </div>
          {business ? (
            <div className="mt-3 rounded-md border border-sidebar-border bg-card px-3 py-2 text-[0.75rem] text-muted-foreground">
              <span className="block font-medium text-sidebar-foreground">
                Estabelecimento configurado
              </span>
              <span className="block truncate">{business.slug}</span>
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-dashed border-sidebar-border px-3 py-2 text-[0.75rem] text-muted-foreground">
              Aguardando configuração pelo painel Master.
            </div>
          )}
          {businesses.length > 1 && (
            <p className="mt-2 text-[0.68rem] text-muted-foreground">
              Este acesso possui mais de uma unidade vinculada. A seleção de unidade é administrada
              pelo Master.
            </p>
          )}
        </div>

        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto py-5 pr-1">
          {nav.map((group) => (
            <section key={group.title}>
              <p className="px-3 pb-2 text-[0.66rem] font-medium uppercase text-muted-foreground/60">
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
                      className="owner-nav-item relative flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeProps={{
                        className:
                          "owner-nav-item owner-nav-active relative flex items-center gap-3 rounded-md bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground",
                      }}
                    >
                      <item.icon className="size-5 shrink-0" strokeWidth={1.8} />
                      <span className="min-w-0 leading-[1.25]">
                        <span className="owner-nav-label block text-[0.86rem] font-medium">
                          {item.label}
                        </span>
                        <span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-muted-foreground">
                          {item.hint}
                        </span>
                      </span>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border pt-3">
          <div className="mb-2 flex items-center gap-3 px-3 py-2">
            <UserCircle className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.82rem] font-medium text-sidebar-accent-foreground">
                Conta do estabelecimento
              </span>
              <span className="block text-[0.68rem] text-muted-foreground">
                {business?.status === "suspenso" ? "Conta bloqueada" : "Conta ativa"}
              </span>
            </span>
          </div>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start text-sidebar-foreground"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div
          aria-hidden="true"
          className={`owner-route-progress ${transitioning ? "is-visible" : ""}`}
        />
        <header className="sticky top-0 z-30 grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
          <WhatsappBadge />
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Notificações">
            <Bell className="size-5" />
          </Button>
        </header>
        <main className="relative mx-auto w-full max-w-7xl p-4 sm:p-7 lg:p-8">
          {transitioning && (
            <div className="owner-route-loader" aria-label="Carregando página" role="status">
              <LoaderCircle className="size-6 animate-spin text-primary" />
            </div>
          )}
          <div key={pathname} className="owner-route-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
