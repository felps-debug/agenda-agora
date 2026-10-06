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
  return localHosts.has(hostname.trim().toLowerCase());
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

export function surfaceForPanelPath(pathname: string): AppSurface {
  return pathname === "/painel/master" || pathname.startsWith("/painel/master/")
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
