import { useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronRight, Clock, Eye, EyeOff, Headset, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import {
  loginInputMode,
  onlyDigits,
  postLoginDestination,
  resolveLoginCredentials,
  type LoginCredentials,
  type PostLoginDestination,
} from "@/lib/auth/login-flow";
import { Button } from "@/components/ui/button";
import { AgpayBackground } from "@/components/painel/AgpayBackground";
import { friendlyError } from "@/lib/error-page";
import { APP_HOSTS, appSurfaceForHostname, isLocalAppHost } from "@/lib/app-hosts";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no Agenda Agora — painel de agendamentos" },
      {
        name: "description",
        content: "Acesse o painel do seu negócio para gerenciar agenda, serviços e clientes.",
      },
      { property: "og:title", content: "Entrar no Agenda Agora" },
      { property: "og:description", content: "Acesse o painel de agendamentos do seu negócio." },
    ],
  }),
  component: AuthRoute,
});

function AuthRoute() {
  return (
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  );
}

const formatPhone = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
async function getRoles(userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Não foi possível confirmar o acesso desta conta.");
  return (data ?? []).map((row) => row.role);
}

/** Role confirmada em `user_roles`, nunca por metadata do usuário. */
async function destinationFor(userId: string) {
  const roles = await getRoles(userId);
  return postLoginDestination({ roles });
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const surface = useSyncExternalStore(
    () => () => {},
    () => appSurfaceForHostname(window.location.hostname),
    () => null,
  );

  const passwordMode = loginInputMode(identifier);
  const emailMode = passwordMode.email;

  const goTo = (destination: PostLoginDestination) =>
    void navigate({ to: destination as "/painel" });

  const destinationAllowedHere = (destination: PostLoginDestination) => {
    // No localhost os três hosts de produção compartilham a mesma origem. Permitir
    // ambos os destinos aqui torna o Master verificável sem relaxar a separação real.
    if (isLocalAppHost(window.location.hostname)) return true;
    if (surface === "public") return false;
    return surface !== "admin"
      ? destination !== "/painel/master"
      : destination === "/painel/master";
  };

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const destination = await destinationFor(user.id).catch(() => null);
      if (!destination) return;
      if (destinationAllowedHere(destination)) goTo(destination);
      else void supabase.auth.signOut();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, surface, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    let credentials: LoginCredentials;
    try {
      credentials = resolveLoginCredentials(identifier, password);
    } catch (error) {
      toast.error(friendlyError(error, "validar os dados de acesso"));
      return;
    }
    setBusy(true);
    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      // Contas de equipe (profissionais com e-mail próprio) usam o mesmo padrão de senha
      // de 4 dígitos dos donos (prefixo "agendaagora:"), mas entram pelo campo de e-mail.
      // Se a tentativa direta falhar e a senha digitada for um PIN de 4 dígitos, tenta de
      // novo com o prefixo antes de desistir.
      if ((error || !data.user) && credentials.kind === "admin" && /^\d{4}$/.test(password)) {
        ({ data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: `agendaagora:${password}`,
        }));
      }
      if (error || !data.user) {
        throw new Error(
          credentials.kind === "admin"
            ? "E-mail ou senha incorretos."
            : "Telefone ou senha incorretos.",
        );
      }
      const destination = await destinationFor(data.user.id);
      if (!destination) {
        await supabase.auth.signOut();
        throw new Error("Esta conta não possui acesso ao painel.");
      }
      if (!destinationAllowedHere(destination)) {
        await supabase.auth.signOut();
        throw new Error(
          destination === "/painel/master"
            ? `O administrador entra em admin.agendagora.company.`
            : `Este acesso pertence ao painel do estabelecimento em painel.agendagora.company.`,
        );
      }
      goTo(destination);
    } catch (error) {
      toast.error(friendlyError(error, "entrar"));
    } finally {
      setBusy(false);
    }
  };

  if (surface === "public") return <AccessChooser />;

  return (
    <div className="aa-auth-screen relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4">
      <AgpayBackground
        /* Login: sempre azul padrao, independente do tema do painel. */
        accent="#4A90E2"
        light="#8ABAF0"
        canvasClassName="pointer-events-none absolute inset-x-0 top-0 z-[2] w-full"
        words={["BEM VINDO", "BOM USO", "APROVEITE", "ACESSE", "BEM VINDO", "APROVEITE", "ACESSE"]}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0600] via-[#050505] to-[#050505]" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--c-4a90e2)] to-transparent opacity-40"
      />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-10 flex flex-col items-center">
          <div className="translate-y-[8%] drop-shadow-[0_0_38px_var(--c-rgba-32-150-255-a0d6)]">
            <div className="flex h-[122px] items-center justify-center overflow-hidden">
              <img
                src="/agenda-agora-logo-nova.png"
                alt="Agenda Agora"
                decoding="async"
                className="h-[233px] w-auto max-w-none object-cover mix-blend-screen"
              />
            </div>
          </div>
        </div>
        <div className="aa-auth-card report-luminous-card report-effect-strong relative overflow-hidden p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-[var(--c-4a90e2)] to-transparent shadow-[0_0_16px_var(--c-rgba-74-144-226-a0d9)]"
          />
          <form onSubmit={handleSubmit} className="relative flex flex-col gap-6">
            <div className="flex w-full flex-col items-center gap-1 text-center">
              <h1 className="text-2xl font-bold text-white">Entrar</h1>
              <p className="text-balance text-sm text-white/50">Acesse o painel do seu negócio</p>
            </div>

            <div className="flex w-full flex-col gap-3">
              <label htmlFor="identifier" className="text-xs font-medium text-white/50">
                Telefone ou e-mail
              </label>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true">
                  <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                </svg>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  inputMode={emailMode ? "email" : "text"}
                  value={identifier}
                  onChange={(e) => {
                    const value = e.target.value;
                    setIdentifier(/[a-z@]/i.test(value) ? value : formatPhone(value));
                  }}
                  placeholder="(00) 00000-0000"
                  required
                  className="flex h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-10 pr-4 text-sm text-white transition-all placeholder:text-white/40 hover:border-white/10 focus:border-[var(--c-4a90e2)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--c-4a90e2)]/30"
                />
              </div>
            </div>

            <div className="flex w-full flex-col gap-3">
              <label htmlFor="password" className="text-xs font-medium text-white/50">
                {passwordMode.label}
              </label>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  inputMode={emailMode ? "text" : "numeric"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(emailMode ? e.target.value : onlyDigits(e.target.value).slice(0, 4))
                  }
                  placeholder={emailMode ? "Sua senha" : "1234"}
                  maxLength={passwordMode.maxLength}
                  pattern={passwordMode.pattern}
                  required
                  className="flex h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-10 pr-10 text-sm text-white transition-all placeholder:text-white/40 hover:border-white/10 focus:border-[var(--c-4a90e2)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--c-4a90e2)]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-[var(--c-4a90e2)]"
                >
                  {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3">
              <span className="relative inline-flex w-full">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-6 top-0 z-10 h-[2.7px] w-16 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,var(--c-0187fc),var(--c-01fbfd))] shadow-[0_0_12px_var(--c-rgba-1-251-253-a0d9),0_0_30px_var(--c-rgba-0-30-252-a0d7)]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-6 top-0 z-0 h-8 w-16 bg-[radial-gradient(ellipse_at_50%_0%,var(--c-rgba-109-179-255-a0d28),transparent_75%)] blur-[6px]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--c-rgba-51-125-255-a0d29)] bg-[var(--c-rgba-22-119-255-a0d09)] px-4 py-2 text-base font-bold text-[var(--c-69a2ff)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_18px_var(--c-rgba-22-119-255-a0d08)] transition-colors hover:border-[var(--c-rgba-51-125-255-a0d5)] hover:bg-[var(--c-rgba-22-119-255-a0d14)] hover:text-[var(--c-8fb5ff)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Aguarde..." : "Entrar"}
                  {!busy && <ChevronRight className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
                </button>
              </span>
            </div>
          </form>
        </div>
        <div className="aa-auth-metrics">
          <div className="aa-auth-metric-item">
            <div className="aa-auth-metric-icon">
              <UserRound className="size-[13px]" aria-hidden="true" />
            </div>
            <div>
              <p className="aa-auth-metric-value">+10.000</p>
              <p className="aa-auth-metric-label">Usuários</p>
            </div>
          </div>
          <div className="aa-auth-metric-item">
            <div className="aa-auth-metric-icon">
              <Clock className="size-[13px]" aria-hidden="true" />
            </div>
            <div>
              <p className="aa-auth-metric-value">24 HORAS</p>
              <p className="aa-auth-metric-label">Agenda Ativa</p>
            </div>
          </div>
          <div className="aa-auth-metric-item">
            <div className="aa-auth-metric-icon">
              <Headset className="size-[13px]" aria-hidden="true" />
            </div>
            <div>
              <p className="aa-auth-metric-value">100%</p>
              <p className="aa-auth-metric-label">Suporte Online</p>
            </div>
          </div>
        </div>
        <div className="mt-8 flex select-none items-center justify-center gap-2">
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-[#22c55e] drop-shadow-[0_0_6px_rgba(34,197,94,0.7)]" aria-hidden="true">
            <rect x="2" y="7" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-neutral-700">Conexão segura</span>
        </div>
      </div>
    </div>
  );
}

function AccessChooser() {
  return (
    <div className="flex min-h-screen items-center justify-center hero-wash px-6 py-12">
      <div className="w-full max-w-md">
        <img
          src="/agenda-agora-logo.svg"
          alt="Agenda Agora"
          className="aa-logo-theme mx-auto mb-6 block h-auto w-full max-w-[10rem]"
        />
        <div className="surface space-y-4 p-7">
          <div>
            <h1 className="text-2xl font-bold">Escolha seu acesso</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Os painéis do estabelecimento e da plataforma são separados.
            </p>
          </div>
          <Button asChild className="w-full">
            <a href={`https://${APP_HOSTS.panel}/auth`}>Painel do estabelecimento</a>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <a href={`https://${APP_HOSTS.admin}/auth`}>Administração da plataforma</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
