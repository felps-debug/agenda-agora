import { useState, type CSSProperties, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  LogOut,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import type { Panel1Appearance } from "@/lib/panel1-config";
import { formatPhoneBR } from "@/lib/format-phone";
import { maskPhoneBR } from "@/lib/input-masks";

const serifDisplay: CSSProperties = { fontFamily: "'Playfair Display', Georgia, serif" };

const sans: CSSProperties = {
  fontFamily:
    "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

/**
 * Aba "Conta" do painel público: login OU cadastro próprio.
 *
 * Entrar: telefone + senha de 4 números de uma conta existente.
 * Criar cadastro: nome + telefone + a senha que o cliente escolher — a senha
 * fica vinculada ao número, nunca uma senha genérica.
 * Logado: mostra o nome do dono da conta e o histórico é exclusivo dele.
 */
export function EleganceAccount({
  appearance,
  modalText,
  loggedIn,
  name,
  phone,
  bookingCount,
  pending,
  error,
  onLogin,
  onRegister,
  onLogout,
  onGoHistory,
}: {
  appearance: Panel1Appearance;
  modalText: string;
  loggedIn: boolean;
  name: string | null;
  phone: string | null;
  bookingCount: number;
  pending: boolean;
  error: string | null;
  onLogin: (phone: string, pin: string) => void;
  onRegister: (name: string, phone: string, pin: string) => void;
  onLogout: () => void;
  onGoHistory: () => void;
}) {
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPin, setRegPin] = useState("");
  const [regPinConfirm, setRegPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const accent = appearance.modal_active_background;
  const accentText = appearance.modal_active_text;
  const cardBackground = appearance.modal_background;
  const cardBorder = appearance.service_border;

  if (loggedIn) {
    const displayName = (name ?? "").trim() || "Cliente";
    return (
      <div className="mt-3" style={sans}>
        <div
          className="rounded-[22px] border p-5 text-center"
          style={{
            backgroundColor: cardBackground,
            borderColor: cardBorder,
            color: modalText,
            boxShadow: `0 12px 30px ${accent}14`,
          }}
        >
          <span
            aria-hidden="true"
            className="mx-auto grid size-16 place-items-center rounded-full"
            style={{ backgroundColor: `${accent}1F`, color: accent }}
          >
            <User className="size-8" strokeWidth={1.7} />
          </span>
          <p
            className="m-0 mt-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: accent }}
          >
            Conta ativa
          </p>
          <h2
            className="m-0 mt-1 truncate text-[24px] leading-tight font-normal"
            style={{ ...serifDisplay, color: appearance.service_name_text }}
          >
            {displayName}
          </h2>
          <p className="m-0 mt-1 text-[13px]" style={{ color: appearance.service_name_text, opacity: 0.65 }}>
            {formatPhoneBR(phone ?? "")}
          </p>
          <p className="m-0 mt-2 flex items-center justify-center gap-1.5 text-xs" style={{ opacity: 0.7 }}>
            <ShieldCheck className="size-3.5" style={{ color: accent }} />
            Histórico exclusivo da sua conta
          </p>

          <div
            className="mt-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left"
            style={{ borderColor: cardBorder, backgroundColor: appearance.service_background }}
          >
            <div className="min-w-0">
              <p className="m-0 text-[11px] uppercase tracking-wide" style={{ opacity: 0.6 }}>
                Agendamentos da conta
              </p>
              <p className="m-0 text-sm font-semibold" style={{ color: appearance.service_name_text }}>
                {bookingCount === 0
                  ? "Nenhum agendamento ainda"
                  : bookingCount === 1
                    ? "1 agendamento"
                    : `${bookingCount} agendamentos`}
              </p>
            </div>
            <CalendarDays className="size-5 shrink-0" style={{ color: accent }} />
          </div>

          <button
            type="button"
            onClick={onGoHistory}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold hover:opacity-95"
            style={{ backgroundColor: accent, color: accentText }}
          >
            Ver meus agendamentos
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border bg-transparent px-5 py-3 text-sm font-semibold hover:opacity-80"
            style={{ borderColor: cardBorder, color: modalText }}
          >
            <LogOut className="size-4" />
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  const switchMode = (next: "entrar" | "criar") => {
    setMode(next);
    setLocalError(null);
  };

  if (mode === "criar") {
    const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fullName = regName.trim().replace(/\s+/g, " ");
      if (fullName.length < 3) {
        setLocalError("Informe seu nome completo.");
        return;
      }
      const digits = regPhone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11) {
        setLocalError("Informe o telefone com DDD (10 ou 11 números).");
        return;
      }
      if (!/^\d{4}$/.test(regPin)) {
        setLocalError("A senha deve ter exatamente 4 números.");
        return;
      }
      if (regPin !== regPinConfirm) {
        setLocalError("As senhas não conferem.");
        return;
      }
      setLocalError(null);
      onRegister(fullName, digits, regPin);
    };

    const shownError = localError ?? error;

    return (
      <div className="mt-3" style={sans}>
        <div
          className="rounded-[22px] border p-5"
          style={{
            backgroundColor: cardBackground,
            borderColor: cardBorder,
            color: modalText,
            boxShadow: `0 12px 30px ${accent}14`,
          }}
        >
          <div className="text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid size-14 place-items-center rounded-full"
              style={{ backgroundColor: `${accent}1F`, color: accent }}
            >
              <UserPlus className="size-7" strokeWidth={1.7} />
            </span>
            <h2
              className="m-0 mt-3 text-[27px] leading-tight font-normal"
              style={{ ...serifDisplay, color: appearance.service_name_text }}
            >
              Criar cadastro
            </h2>
            <p className="m-0 mt-1.5 text-[13px] leading-snug" style={{ opacity: 0.72 }}>
              Sua senha de 4 números fica salva apenas no seu telefone.
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ opacity: 0.65 }}>
                Nome e sobrenome
              </span>
              <span
                className="flex items-center gap-2.5 rounded-2xl border px-3.5 py-3"
                style={{ backgroundColor: appearance.service_background, borderColor: cardBorder }}
              >
                <User className="size-[18px] shrink-0" style={{ color: accent }} />
                <input
                  type="text"
                  autoComplete="name"
                  aria-label="Nome e sobrenome"
                  placeholder="Seu nome completo"
                  maxLength={80}
                  value={regName}
                  onChange={(event) => {
                    setRegName(event.target.value);
                    setLocalError(null);
                  }}
                  className="w-full min-w-0 border-0 bg-transparent text-[15px] outline-none"
                  style={{ color: appearance.service_text }}
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ opacity: 0.65 }}>
                Telefone
              </span>
              <span
                className="flex items-center gap-2.5 rounded-2xl border px-3.5 py-3"
                style={{ backgroundColor: appearance.service_background, borderColor: cardBorder }}
              >
                <Phone className="size-[18px] shrink-0" style={{ color: accent }} />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  aria-label="Telefone"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  value={regPhone}
                  onChange={(event) => {
                    setRegPhone(maskPhoneBR(event.target.value));
                    setLocalError(null);
                  }}
                  className="w-full min-w-0 border-0 bg-transparent text-[15px] outline-none"
                  style={{ color: appearance.service_text }}
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ opacity: 0.65 }}>
                Senha de 4 dígitos
              </span>
              <span
                className="flex items-center gap-2.5 rounded-2xl border px-3.5 py-3"
                style={{ backgroundColor: appearance.service_background, borderColor: cardBorder }}
              >
                <Lock className="size-[18px] shrink-0" style={{ color: accent }} />
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="new-password"
                  aria-label="Senha de 4 dígitos"
                  placeholder="1234"
                  maxLength={4}
                  pattern="\d{4}"
                  value={regPin}
                  onChange={(event) => {
                    setRegPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                    setLocalError(null);
                  }}
                  className="w-full min-w-0 border-0 bg-transparent text-[15px] tracking-[0.25em] outline-none"
                  style={{ color: appearance.service_text }}
                />
                <button
                  type="button"
                  aria-label={showPin ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPin((value) => !value)}
                  className="shrink-0 border-0 bg-transparent p-0.5"
                  style={{ color: accent, opacity: 0.8 }}
                >
                  {showPin ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ opacity: 0.65 }}>
                Confirmar senha
              </span>
              <span
                className="flex items-center gap-2.5 rounded-2xl border px-3.5 py-3"
                style={{ backgroundColor: appearance.service_background, borderColor: cardBorder }}
              >
                <Lock className="size-[18px] shrink-0" style={{ color: accent }} />
                <input
                  type={showConfirm ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="new-password"
                  aria-label="Confirmar senha"
                  placeholder="1234"
                  maxLength={4}
                  pattern="\d{4}"
                  value={regPinConfirm}
                  onChange={(event) => {
                    setRegPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4));
                    setLocalError(null);
                  }}
                  className="w-full min-w-0 border-0 bg-transparent text-[15px] tracking-[0.25em] outline-none"
                  style={{ color: appearance.service_text }}
                />
                <button
                  type="button"
                  aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                  onClick={() => setShowConfirm((value) => !value)}
                  className="shrink-0 border-0 bg-transparent p-0.5"
                  style={{ color: accent, opacity: 0.8 }}
                >
                  {showConfirm ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </span>
            </label>

            {shownError ? (
              <p
                role="alert"
                className="m-0 rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: "rgba(220, 38, 38, 0.35)", color: "#dc2626" }}
              >
                {shownError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: accent, color: accentText }}
            >
              {pending ? (
                "Criando cadastro..."
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Criar cadastro
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => switchMode("entrar")}
            className="mt-3 w-full border-0 bg-transparent text-center text-[12px] underline underline-offset-2"
            style={{ color: modalText, opacity: 0.65 }}
          >
            Já tem cadastro? Entrar
          </button>
        </div>
      </div>
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = loginPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      setLocalError("Informe o telefone com DDD (10 ou 11 números).");
      return;
    }
    if (!/^\d{4}$/.test(loginPin)) {
      setLocalError("A senha deve ter exatamente 4 números.");
      return;
    }
    setLocalError(null);
    onLogin(digits, loginPin);
  };

  const shownError = localError ?? error;

  return (
    <div className="mt-3" style={sans}>
      <div
        className="rounded-[22px] border p-5"
        style={{
          backgroundColor: cardBackground,
          borderColor: cardBorder,
          color: modalText,
          boxShadow: `0 12px 30px ${accent}14`,
        }}
      >
        <div className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-full"
            style={{ backgroundColor: `${accent}1F`, color: accent }}
          >
            <User className="size-7" strokeWidth={1.7} />
          </span>
          <h2
            className="m-0 mt-3 text-[27px] leading-tight font-normal"
            style={{ ...serifDisplay, color: appearance.service_name_text }}
          >
            Acesse sua conta
          </h2>
          <p className="m-0 mt-1.5 text-[13px] leading-snug" style={{ opacity: 0.72 }}>
            Entre com o telefone e a senha do seu cadastro para ver seus agendamentos.
          </p>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ opacity: 0.65 }}>
              Telefone
            </span>
            <span
              className="flex items-center gap-2.5 rounded-2xl border px-3.5 py-3"
              style={{
                backgroundColor: appearance.service_background,
                borderColor: cardBorder,
              }}
            >
              <Phone className="size-[18px] shrink-0" style={{ color: accent }} />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                aria-label="Telefone"
                placeholder="(00) 00000-0000"
                maxLength={15}
                value={loginPhone}
                onChange={(event) => {
                  setLoginPhone(maskPhoneBR(event.target.value));
                  setLocalError(null);
                }}
                className="w-full min-w-0 border-0 bg-transparent text-[15px] outline-none"
                style={{ color: appearance.service_text }}
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ opacity: 0.65 }}>
              Senha de 4 dígitos
            </span>
            <span
              className="flex items-center gap-2.5 rounded-2xl border px-3.5 py-3"
              style={{
                backgroundColor: appearance.service_background,
                borderColor: cardBorder,
              }}
            >
              <Lock className="size-[18px] shrink-0" style={{ color: accent }} />
              <input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                autoComplete="current-password"
                aria-label="Senha de 4 dígitos"
                placeholder="1234"
                maxLength={4}
                pattern="\d{4}"
                value={loginPin}
                onChange={(event) => {
                  setLoginPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                  setLocalError(null);
                }}
                className="w-full min-w-0 border-0 bg-transparent text-[15px] tracking-[0.25em] outline-none"
                style={{ color: appearance.service_text }}
              />
              <button
                type="button"
                aria-label={showPin ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPin((value) => !value)}
                className="shrink-0 border-0 bg-transparent p-0.5"
                style={{ color: accent, opacity: 0.8 }}
              >
                {showPin ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </span>
          </label>

          {shownError ? (
            <p
              role="alert"
              className="m-0 rounded-xl border px-3 py-2 text-xs"
              style={{ borderColor: "rgba(220, 38, 38, 0.35)", color: "#dc2626" }}
            >
              {shownError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: accent, color: accentText }}
          >
            {pending ? (
              "Entrando..."
            ) : (
              <>
                <LogIn className="size-4" />
                Entrar
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => switchMode("criar")}
          className="mt-3 w-full border-0 bg-transparent text-center text-[12px] underline underline-offset-2"
          style={{ color: modalText, opacity: 0.65 }}
        >
          Não tem conta? Criar cadastro
        </button>
      </div>
    </div>
  );
}
