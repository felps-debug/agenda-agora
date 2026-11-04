import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sdrLogin } from "@/lib/sdr.functions";

export const Route = createFileRoute("/sdr")({
  head: () => ({
    meta: [
      { title: "Painel do SDR — Agenda Agora" },
      { name: "description", content: "Acesso exclusivo da equipe de SDRs." },
    ],
  }),
  component: SdrLoginPage,
});

const SESSION_KEY = "agenda-agora:sdr-session";

export function saveSdrSession(token: string, name: string) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ token, name }));
  } catch {
    // Ignora armazenamento indisponível.
  }
}

export function readSdrSession(): { token: string; name: string } | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: unknown; name?: unknown };
    if (typeof parsed.token !== "string" || typeof parsed.name !== "string") return null;
    return { token: parsed.token, name: parsed.name };
  } catch {
    return null;
  }
}

export function clearSdrSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignora.
  }
}

function SdrLoginPage() {
  const navigate = useNavigate();
  const loginFn = useServerFn(sdrLogin);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Digite sua senha de 4 dígitos.");
      return;
    }
    setPending(true);
    try {
      const result = await loginFn({ data: { email: email.trim(), pin } });
      saveSdrSession(result.token, result.name);
      try {
        // Marca a sessão: o painel abre o modal de boas-vindas uma única vez.
        window.sessionStorage.setItem("agenda-agora:sdr-welcome", "1");
      } catch {
        // Ignora armazenamento indisponível.
      }
      toast.success(`Bem-vindo(a), ${result.name.split(" ")[0]}!`);
      await navigate({ to: "/painel-sdr" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="grid min-h-screen place-items-center p-4"
      style={{
        background:
          "radial-gradient(ellipse 90% 46% at 50% -12%, rgba(22,119,255,0.16) 0%, transparent 70%), #050607",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img
            src="/favicon-256.png"
            alt="Agenda Agora"
            decoding="async"
            className="size-11 object-contain"
          />
          <div>
            <p className="text-lg font-extrabold leading-none tracking-tight text-white">AGENDA AGORA</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#626872]">
              Painel do SDR
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="rounded-2xl border border-[#2a2f37] bg-[#0d1015] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.7)]"
        >
          <div className="mb-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-[var(--c-1677ff)]/30 bg-[var(--c-1677ff)]/10 text-[var(--c-69a2ff)]">
              <LockKeyhole className="size-5" />
            </span>
            <h1 className="mt-3 text-lg font-bold text-white">Entrar no seu painel</h1>
            <p className="mt-1 text-sm text-[#777d87]">
              Use o e-mail e a senha de 4 dígitos que você recebeu.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#9aa1ab]">E-mail</Label>
              <Input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="h-11 border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#9aa1ab]">Senha (4 dígitos)</Label>
              <Input
                type="password"
                inputMode="numeric"
                required
                maxLength={4}
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="h-11 border-white/10 bg-black/40 text-center text-lg tracking-[0.5em] text-[var(--c-e6e9ee)]"
              />
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-xl bg-[var(--c-1677ff)] font-bold text-white shadow-[0_8px_24px_rgba(22,119,255,0.35)] hover:bg-[var(--c-3b82f6)]"
            >
              {pending ? "Entrando…" : "Entrar"}
            </Button>
          </div>
        </form>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-[#5c6470]">
          <ShieldCheck className="size-3.5" /> Área exclusiva da equipe Agenda Agora
        </p>
      </div>
    </div>
  );
}
