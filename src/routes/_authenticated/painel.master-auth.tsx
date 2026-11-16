import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMasterStatus } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  findMasterTotpFactors,
  issueMasterTotpEnrollment,
  verifyMasterTotpCode,
} from "@/lib/auth/master-mfa";

type Screen = "loading" | "setup" | "pending" | "verify" | "error";

export const Route = createFileRoute("/_authenticated/painel/master-auth")({
  head: () => ({
    meta: [{ title: "Verificação de segurança — Agenda Agora" }],
  }),
  component: MasterMfaPage,
});

function MasterMfaPage() {
  const navigate = useNavigate();
  const getStatus = useServerFn(getMasterStatus);
  const [screen, setScreen] = useState<Screen>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadMfaState = async () => {
    setScreen("loading");
    setErrorMessage("");
    try {
      const status = await getStatus();
      if (!status.isMaster) {
        await navigate({ to: "/painel", replace: true });
        return;
      }
      if (status.aal2) {
        await navigate({ to: "/painel/master", replace: true });
        return;
      }

      const factors = await findMasterTotpFactors(supabase.auth.mfa);
      if (factors.verifiedFactorId) {
        setFactorId(factors.verifiedFactorId);
        setPendingFactorId(factors.pendingFactorId);
        setScreen("verify");
        return;
      }
      if (factors.pendingFactorId) {
        setPendingFactorId(factors.pendingFactorId);
        setFactorId(null);
        setScreen("pending");
        return;
      }
      setFactorId(null);
      setPendingFactorId(null);
      setScreen("setup");
    } catch {
      setErrorMessage("Não foi possível carregar a verificação de segurança. Tente novamente.");
      setScreen("error");
    }
  };

  useEffect(() => {
    void loadMfaState();
    // The route intentionally checks the current server role and assurance level on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginEnrollment = async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const enrollment = await issueMasterTotpEnrollment(supabase.auth.mfa);
      setFactorId(enrollment.factorId);
      setPendingFactorId(null);
      setQrCode(enrollment.qrCode);
      setSecret(enrollment.secret);
      setScreen("setup");
    } catch {
      setErrorMessage("Não foi possível iniciar a configuração do autenticador.");
    } finally {
      setBusy(false);
    }
  };

  const restartEnrollment = async () => {
    if (!pendingFactorId) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
      if (error) throw error;
      setPendingFactorId(null);
      await beginEnrollment();
    } catch {
      setErrorMessage("Não foi possível reiniciar a configuração. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setErrorMessage("");
    try {
      await verifyMasterTotpCode(supabase.auth.mfa, factorId, code);
      await navigate({ to: "/painel/master", replace: true });
    } catch {
      setCode("");
      setErrorMessage("Código inválido ou expirado. Confira o autenticador e tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0e] p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-lg font-semibold">Verificação do Painel Master</h1>
            <p className="text-sm text-white/60">Use um autenticador TOTP para continuar.</p>
          </div>
        </div>

        {screen === "loading" ? (
          <p role="status" className="flex items-center gap-2 text-sm text-white/70">
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            Verificando acesso…
          </p>
        ) : null}

        {screen === "error" ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-red-300">
              {errorMessage}
            </p>
            <Button type="button" onClick={() => void loadMfaState()} disabled={busy}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {screen === "setup" && !qrCode ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-white/75">
              Configure um aplicativo autenticador para proteger as operações administrativas.
            </p>
            {errorMessage ? (
              <p role="alert" className="text-sm text-red-300">
                {errorMessage}
              </p>
            ) : null}
            <Button type="button" onClick={() => void beginEnrollment()} disabled={busy}>
              {busy ? "Preparando…" : "Configurar autenticador"}
            </Button>
          </div>
        ) : null}

        {screen === "pending" ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-white/75">
              Há uma configuração TOTP iniciada, mas ainda não verificada. Reinicie para gerar um
              novo QR code.
            </p>
            {errorMessage ? (
              <p role="alert" className="text-sm text-red-300">
                {errorMessage}
              </p>
            ) : null}
            <Button type="button" onClick={() => void restartEnrollment()} disabled={busy}>
              {busy ? "Preparando…" : "Reiniciar configuração"}
            </Button>
          </div>
        ) : null}

        {screen === "verify" || (screen === "setup" && qrCode) ? (
          <div className="space-y-4">
            {screen === "setup" && qrCode ? (
              <div className="space-y-3 text-sm text-white/75">
                <p>Escaneie este QR code no aplicativo autenticador:</p>
                <img
                  className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
                  src={qrCode}
                  alt="QR code para configurar o TOTP"
                />
                {secret ? (
                  <p className="break-all rounded-lg bg-white/5 p-3">
                    Se não puder escanear, informe este código manualmente:{" "}
                    <strong>{secret}</strong>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-6 text-white/75">
                Digite o código atual do seu aplicativo autenticador.
              </p>
            )}

            {errorMessage ? (
              <p role="alert" className="text-sm text-red-300">
                {errorMessage}
              </p>
            ) : null}
            <form onSubmit={(event) => void verifyCode(event)} className="space-y-3">
              <label htmlFor="master-totp-code" className="block text-sm font-medium">
                Código de 6 dígitos
              </label>
              <input
                id="master-totp-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-lg tracking-[0.3em] text-white outline-none focus:border-blue-400"
                required
              />
              <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
                {busy ? "Verificando…" : "Verificar e abrir o Master"}
              </Button>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}
