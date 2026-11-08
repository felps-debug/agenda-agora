export const APP_HOSTS = {
  public: "app.agendagora.company",
  panel: "painel.agendagora.company",
  admin: "admin.agendagora.company",
} as const;

export type AppSurface = keyof typeof APP_HOSTS;

export const SPLIT_PANELS_ENABLED = import.meta.env["VITE_SPLIT_PANELS"] === "true";

type LocationLike = {
  hostname: string;
  protocol: string;
  port?: string;
};

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

// Faixas privadas (RFC 1918) + nomes .local/.lan: no dev, acessar pelo IP da
// rede local (ex.: 192.168.1.15) deve se comportar como localhost.
function isPrivateLanHostname(hostname: string) {
  const host = hostname.trim().toLowerCase();
  if (host.endsWith(".local") || host.endsWith(".lan")) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  const m172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function appSurfaceForHostname(
  hostname: string,
  enabled = SPLIT_PANELS_ENABLED,
): AppSurface | null {
  if (!enabled) return null;
  const normalized = hostname.trim().toLowerCase();
  return (
    (Object.entries(APP_HOSTS).find(([, host]) => host === normalized)?.[0] as AppSurface) ?? null
  );
}

export function isLocalAppHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return localHosts.has(normalized) || isPrivateLanHostname(normalized);
}

/** Mantém preview/local na mesma origem; em produção separa cada painel por host. */
export function appSurfaceHref(
  surface: AppSurface,
  path: string,
  location: LocationLike,
  enabled = SPLIT_PANELS_ENABLED,
): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (!appSurfaceForHostname(location.hostname, enabled)) return safePath;
  return `https://${APP_HOSTS[surface]}${safePath}`;
}

// Páginas da barra lateral do master (platformNav em painel.tsx): vivem no host admin,
// senão o clique leva ao host do painel, onde o master não tem sessão (sessão é por host).
const MASTER_PANEL_PATHS = [
  "/painel/master",
  "/painel/recebiveis",
  "/painel/em-teste",
  "/painel/assinantes",
  "/painel/precisa-de-atencao",
  "/painel/pix-aprovacao",
  "/painel/carteira-desempenho",
  "/painel/notificacoes-alertas",
  "/painel/equipe-geral",
  "/painel/suporte",
  "/painel/erros",
] as const;

export function surfaceForPanelPath(pathname: string): AppSurface {
  return MASTER_PANEL_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`))
    ? "admin"
    : "panel";
}

export function panelPathHref(
  pathname: string,
  location: LocationLike,
  enabled = SPLIT_PANELS_ENABLED,
): string {
  return appSurfaceHref(surfaceForPanelPath(pathname), pathname, location, enabled);
}

/** A sessão de suporte pertence à origem em que o master iniciou o acesso. */
export function masterPanelRedirectHref(
  pathname: string,
  location: LocationLike,
  state: { isMaster: boolean; supportState: "checking" | "off" | "on" },
  enabled = SPLIT_PANELS_ENABLED,
): string | null {
  if (!state.isMaster || state.supportState !== "off") return null;
  const href = panelPathHref(pathname, location, enabled);
  if (href.startsWith("/")) return null;
  const currentOrigin = new URL(
    `${location.protocol}//${location.hostname}${location.port ? `:${location.port}` : ""}`,
  ).origin;
  return new URL(href).origin === currentOrigin ? null : href;
}

export function publicBookingOrigin(
  currentOrigin: string | null | undefined,
  enabled = SPLIT_PANELS_ENABLED,
): string | null {
  if (!currentOrigin) return null;
  try {
    const url = new URL(currentOrigin);
    return appSurfaceForHostname(url.hostname, enabled)
      ? `https://${APP_HOSTS.public}`
      : currentOrigin.replace(/\/+$/, "");
  } catch {
    return currentOrigin.replace(/\/+$/, "");
  }
}
