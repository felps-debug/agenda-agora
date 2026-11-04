import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getLedgerStatement } from "@/lib/ledger.functions";
import { getWhatsappStatus } from "@/lib/whatsapp.functions";
import { getLatestPixKeyApproval } from "@/lib/pix-approvals.functions";
import { getSidebarMasterStats } from "@/lib/sidebar-master.functions";
import { LOGO_ACCEPT } from "@/lib/logo";
import { PLATFORM_AVATAR_SPACE } from "@/lib/panel-avatar";
import {
  panelAvatarPathFromMetadata,
  panelAvatarTrimmedFromMetadata,
  repairPanelAvatarOnce,
  uploadPanelAvatar,
  usePanelAvatarUrl,
} from "@/lib/panel-avatar";

const SIGNAL_MENU_ID = "sidebar-signal-history";
const WHATSAPP_MASK = "url('/sidebar-whatsapp-mask.png')";

export type SidebarProfileWidgetProps = {
  businessId: string | null;
  name: string;
  initial: string;
  role: string;
  statusLabel: string;
  /** Tom da pílula de status (is-active / is-trial / is-renew). */
  statusTone?: string | undefined;
  profileOpen: boolean;
  onProfileClick: () => void;
  onLogout: () => void;
  platformMode?: boolean;
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isSameLocalDay(isoDate: string, reference: Date) {
  const date = new Date(isoDate);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

/**
 * Perfil da sidebar — card com avatar/nome/sair, status da conta e as linhas de canais
 * (WhatsApp/OFF) e Carteira com o histórico de sinais recebidos hoje (ledger).
 */
export function SidebarProfileWidget({
  businessId,
  name,
  initial,
  role,
  statusLabel,
  statusTone,
  profileOpen,
  onProfileClick,
  onLogout,
  platformMode,
}: SidebarProfileWidgetProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [repairForgiven, setRepairForgiven] = useState(false);
  const navigate = useNavigate();
  // O Painel master também pode ter foto: usa o espaço de plataforma.
  const avatarSpaceId = platformMode
    ? PLATFORM_AVATAR_SPACE
    : businessId;
  const noticeTimer = useRef<number | null>(null);
  const payRowRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const whatsappStatusFn = useServerFn(getWhatsappStatus);
  const { data: whatsappStatus } = useQuery({
    queryKey: ["sidebar-whatsapp-status", businessId],
    enabled: !!businessId,
    queryFn: () => whatsappStatusFn({ data: { businessId: businessId! } }),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const whatsappOn = whatsappStatus?.status === "conectado";

  const pixApprovalFn = useServerFn(getLatestPixKeyApproval);
  const { data: pixApproval } = useQuery({
    queryKey: ["sidebar-pix-approval", businessId],
    enabled: !!businessId,
    queryFn: () => pixApprovalFn({ data: { businessId: businessId! } }),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const agpayOn = pixApproval?.status === "aprovado";

  const { user } = useAuth();
  const avatarPath = panelAvatarPathFromMetadata(user);
  const avatarTrimmed = panelAvatarTrimmedFromMetadata(user);
  const { data: avatarUrl } = usePanelAvatarUrl(avatarPath);
  // Enquanto o arquivo antigo ainda não foi corrigido (e o fallback não venceu),
  // exibe a inicial padrão em vez da foto com as bordas serrilhadas.
  const needsRepair = !avatarTrimmed && !!avatarPath;
  const showPhoto = !!avatarUrl && (repairForgiven || !needsRepair);

  const getLedgerStatementFn = useServerFn(getLedgerStatement);
  const { data: statement, isFetching } = useQuery({
    queryKey: ["sidebar-signals", businessId],
    enabled: historyOpen && !!businessId,
    queryFn: () => getLedgerStatementFn({ data: { businessId: businessId! } }),
  });

  const signals = useMemo(() => {
    const reference = new Date();
    return (statement?.entries ?? []).filter(
      (entry) => entry.type === "payment_credit" && isSameLocalDay(entry.date, reference),
    );
  }, [statement]);

  function announce(message: string) {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2200);
  }

  function openAvatarPicker() {
    if (!avatarSpaceId) {
      announce("Selecione um estabelecimento para alterar a foto.");
      return;
    }
    avatarInputRef.current?.click();
  }

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    if (!avatarSpaceId) {
      announce("Selecione um estabelecimento para alterar a foto.");
      return;
    }
    setAvatarBusy(true);
    try {
      await uploadPanelAvatar({ businessId: avatarSpaceId, file, previousPath: avatarPath });
      announce("Foto de perfil atualizada.");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível alterar a foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  // Correção única da foto antiga (bordas brancas gravadas no arquivo). Enquanto
  // ela não estiver corrigida, o avatar mostra a inicial padrão em vez de exibir
  // a foto com o serrilhado. Roda na hora, em background; se falhar nesta sessão,
  // volta a mostrar a foto como está após alguns segundos (fallback) e tenta de
  // novo na próxima abertura — nunca em loop, e nunca com processamento na
  // exibição depois que o arquivo é corrigido.
  useEffect(() => {
    if (!businessId || !avatarPath || avatarTrimmed) return;
    if (avatarPath && avatarSpaceId) {
      void repairPanelAvatarOnce({
        businessId: avatarSpaceId,
        path: avatarPath,
        alreadyTrimmed: avatarTrimmed,
      });
    }
    const forgiveness = window.setTimeout(() => setRepairForgiven(true), 8000);
    return () => window.clearTimeout(forgiveness);
  }, [businessId, avatarPath, avatarTrimmed]);

  useEffect(() => {
    if (!historyOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (payRowRef.current && !payRowRef.current.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setHistoryOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [historyOpen]);

  return (
    <>
      <div className="sbp-card">
        <div className="sbp-profile">
          <span className="sbp-avatar-wrap">
            <button
              type="button"
              className={`sbp-avatar${avatarBusy ? " is-busy" : ""}${showPhoto ? " has-photo" : ""}`}
              onClick={openAvatarPicker}
              aria-label={avatarUrl ? "Alterar foto de perfil" : "Adicionar foto de perfil"}
              aria-busy={avatarBusy}
              title="Alterar foto"
            >
              {showPhoto ? (
                <img className="sbp-avatar-img" src={avatarUrl} alt="" />
              ) : (
                <span className="sbp-avatar-initial">{initial}</span>
              )}
            </button>
            {!avatarUrl && (
              <span className="sbp-avatar-badge" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="M5.2 4.2 6 3h4l.8 1.2H13a1.4 1.4 0 0 1 1.4 1.4v5.1A1.4 1.4 0 0 1 13 12.1H3A1.4 1.4 0 0 1 1.6 10.7V5.6A1.4 1.4 0 0 1 3 4.2h2.2Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
            )}
          </span>
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
          <div className="sbp-profile-copy">
            <div className="sbp-profile-topline">
              <button
                type="button"
                className="sbp-profile-name"
                onClick={onProfileClick}
                aria-haspopup="dialog"
                aria-expanded={profileOpen}
                title={name}
              >
                {name}
              </button>
              <button
                type="button"
                className="sbp-logout"
                onClick={onLogout}
                aria-label="Sair da conta"
                title="Sair"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M10 17l5-5-5-5M15 12H3m9-8h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="sbp-profile-subline">
              <span className="sbp-role">{role}</span>
              <span
                className={`sbp-status${
                  statusTone === "renovar"
                    ? " is-renew"
                    : statusTone === "teste"
                      ? " is-trial"
                      : statusTone === "ativo"
                        ? " is-active"
                        : statusLabel === "Ativo"
                          ? " is-active"
                          : statusLabel === "Teste Grátis"
                            ? " is-trial"
                            : ""
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {platformMode && <MasterSidebarRows />}

        {!platformMode && (
        <>
        <div className="sbp-social-row" role="group" aria-label="WhatsApp">
          <button
            type="button"
            className="sbp-social-button sbp-whatsapp is-active"
            aria-label="Abrir integração do WhatsApp"
            onClick={() => void navigate({ to: "/painel/integracoes" })}
          >
            <span
              className="sbp-whatsapp-icon"
              aria-hidden="true"
              style={{ "--sbp-whatsapp-mask": WHATSAPP_MASK } as CSSProperties}
            />
            <span className="sbp-plat-nome">WhatsApp</span>
          </button>
          <span
            className={`sbp-status-pill${whatsappOn ? " is-on" : ""}`}
            aria-label={whatsappOn ? "Online" : "Offline"}
          >
            {whatsappOn ? "ON" : "OFF"}
          </span>
        </div>

        <div
          className="sbp-social-row sbp-agpay-row"
          role="group"
          aria-label="Carteira"
          ref={payRowRef}
        >
          <div
            className={`sbp-social-button sbp-agpay-button${agpayOn ? " is-active" : ""}`}
            aria-label={agpayOn ? "Carteira ativo" : "Carteira inativo"}
          >
            <span className="sbp-agpay-brand-lockup">
              <img className="sbp-agpay-brand-icon" src="/sidebar-agpay-icon.png" alt="" />
              <span className="sbp-agpay-name">
                <span className="sbp-agpay-title">Carteira</span>
              </span>
            </span>
          </div>
          <button
            type="button"
            className="sbp-signal-history-toggle"
            aria-label="Ver sinais recebidos hoje"
            aria-expanded={historyOpen}
            aria-controls={SIGNAL_MENU_ID}
            onClick={() => setHistoryOpen((value) => !value)}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="m3 6 5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div
            className="sbp-signal-history-menu"
            id={SIGNAL_MENU_ID}
            role="region"
            aria-label="Sinais recebidos hoje"
            hidden={!historyOpen}
          >
            <div className="sbp-signal-history-heading">
              <span>Sinais recebidos hoje</span>
              <span className="sbp-signal-history-count">{signals.length}</span>
            </div>
            <div className="sbp-signal-history-list">
              {signals.length === 0 ? (
                <div className="sbp-signal-history-empty">
                  {isFetching ? "Carregando sinais…" : "Nenhum sinal recebido hoje."}
                </div>
              ) : (
                signals.map((signal) => (
                  <div className="sbp-signal-history-item" key={signal.id}>
                    <div>
                      <div className="sbp-signal-history-client">
                        {signal.description || "Cliente"}
                      </div>
                      <div className="sbp-signal-history-meta">
                        Pago às{" "}
                        {new Date(signal.date).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span className="sbp-signal-history-amount">
                      {formatBRL(signal.amountCents)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <span
            className={`sbp-status-pill${agpayOn ? " is-on" : ""}`}
            aria-label={agpayOn ? "Carteira ativo" : "Carteira inativo"}
          >
            {agpayOn ? "ON" : "OFF"}
          </span>
        </div>
        </>
        )}
      </div>
      <div className={`sbp-notice${notice ? " is-visible" : ""}`} role="status" aria-live="polite">
        {notice}
      </div>
    </>
  );
}

function signupDayLabel(isoDate: string) {
  const date = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function MasterSidebarRows() {
  const fn = useServerFn(getSidebarMasterStats);
  const { data, isFetching } = useQuery({
    queryKey: ["sidebar-master-stats"],
    queryFn: () => fn(),
    refetchInterval: 60000,
  });
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const [pagosOpen, setPagosOpen] = useState(false);
  const cadastrosRowRef = useRef<HTMLDivElement | null>(null);
  const pagosRowRef = useRef<HTMLDivElement | null>(null);
  const signupsToday = data?.signupsToday ?? 0;
  const recentSignups = data?.recentSignups ?? [];
  const recentPayments = data?.recentPayments ?? [];

  // Fecha os popups ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!cadastrosOpen && !pagosOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (cadastrosOpen && cadastrosRowRef.current && !cadastrosRowRef.current.contains(target)) {
        setCadastrosOpen(false);
      }
      if (pagosOpen && pagosRowRef.current && !pagosRowRef.current.contains(target)) {
        setPagosOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCadastrosOpen(false);
        setPagosOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [cadastrosOpen, pagosOpen]);

  return (
    <>
      <div
        ref={cadastrosRowRef}
        className="sbp-social-row sbp-signup-row"
        role="group"
        aria-label={`Cadastros Hoje — ${signupsToday} cadastros hoje`}
        title={`${signupsToday} cadastros hoje`}
      >
        <div className="sbp-social-button sbp-signup-button">
          <span className="sbp-signup-icon" aria-hidden="true" />
          <span className="sbp-plat-nome">Cadastros Hoje</span>
        </div>
        <button
          type="button"
          className="sbp-signal-history-toggle"
          aria-label="Ver cadastros dos últimos 3 dias"
          aria-expanded={cadastrosOpen}
          onClick={() => setCadastrosOpen((value) => !value)}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m3 6 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="sbp-signal-history-menu" hidden={!cadastrosOpen}>
          <div className="sbp-signal-history-heading">
            <span>Últimos 3 dias</span>
            <span className="sbp-signal-history-count">{recentSignups.length}</span>
          </div>
          <div className="sbp-signal-history-list">
            {recentSignups.length === 0 ? (
              <div className="sbp-signal-history-empty">
                {isFetching ? "Carregando…" : "Nenhum cadastro nos últimos 3 dias."}
              </div>
            ) : (
              recentSignups.map((signup) => (
                <div className="sbp-signal-history-item" key={signup.id}>
                  <div>
                    <div className="sbp-signal-history-client">{signup.name}</div>
                    <div className="sbp-signal-history-meta">
                      {new Date(signup.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span className="sbp-signal-history-amount">{signupDayLabel(signup.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div
        ref={pagosRowRef}
        className="sbp-social-row sbp-payments-row"
        role="group"
        aria-label="Últimos Pagos"
      >
        <div className="sbp-social-button sbp-payments-button">
          <span className="sbp-payments-icon" aria-hidden="true" />
          <span className="sbp-plat-nome">Últimos Pagos</span>
        </div>
        <button
          type="button"
          className="sbp-signal-history-toggle"
          aria-label="Ver últimos pagos"
          aria-expanded={pagosOpen}
          onClick={() => setPagosOpen((v) => !v)}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m3 6 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="sbp-signal-history-menu" hidden={!pagosOpen}>
          <div className="sbp-signal-history-heading">
            <span>Últimos 7 dias</span>
            <span className="sbp-signal-history-count">{recentPayments.length}</span>
          </div>
          <div className="sbp-signal-history-list">
            {recentPayments.length === 0 ? (
              <div className="sbp-signal-history-empty">
                {isFetching ? "Carregando…" : "Nenhum pagamento nos últimos 7 dias."}
              </div>
            ) : (
              recentPayments.map((p) => (
                <div className="sbp-signal-history-item" key={p.id}>
                  <div>
                    <div className="sbp-signal-history-client">{p.businessName}</div>
                    <div className="sbp-signal-history-meta">
                      {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <span className="sbp-signal-history-amount">
                    {(p.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
