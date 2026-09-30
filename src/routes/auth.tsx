import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, UserRound } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/error-page";

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

  const passwordMode = loginInputMode(identifier);
  const emailMode = passwordMode.email;

  const goTo = (destination: PostLoginDestination) =>
    void navigate({ to: destination as "/painel" });

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const destination = await destinationFor(user.id).catch(() => null);
      if (destination) goTo(destination);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

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
      toast.success("Bem-vindo de volta!");
      goTo(destination);
    } catch (error) {
      toast.error(friendlyError(error, "entrar"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center hero-wash px-6 py-12">
      <div className="w-full max-w-md">
        <img
          src="/agenda-agora-logo.svg"
          alt="Agenda Agora"
          decoding="async"
          className="mx-auto mb-6 block h-auto w-full max-w-[10rem]"
        />
        <div className="surface p-7">
          <h1 className="text-2xl font-bold">Entrar no painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estabelecimentos entram com telefone e senha de 4 dígitos; administradores, com e-mail e
            senha.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Telefone ou e-mail</Label>
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  inputMode={emailMode ? "email" : "text"}
                  value={identifier}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Só formata como telefone enquanto não houver letras ou "@".
                    setIdentifier(/[a-z@]/i.test(value) ? value : formatPhone(value));
                  }}
                  placeholder="(11) 93935-4416"
                  required
                  className="pr-10"
                />
                <UserRound className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{passwordMode.label}</Label>
              <div className="relative">
                <Input
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
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Aguarde..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
