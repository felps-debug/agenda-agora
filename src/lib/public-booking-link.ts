/** Caminho público de agendamento do negócio, ou null quando não há slug utilizável. */
export function publicBookingPath(slug: string | null | undefined): string | null {
  const value = slug?.trim();
  if (!value) return null;
  return `/agendar/${encodeURIComponent(value)}`;
}

/**
 * Domínio curto do link do cliente final (ex.: "agendas.link"). Definido por
 * `VITE_PUBLIC_LINK_HOST`; sem ele, o link continua em `/agendar/<nome>` no host do app.
 */
export function publicLinkHost(
  host: string | null | undefined = import.meta.env["VITE_PUBLIC_LINK_HOST"],
): string | null {
  const value = host
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return value || null;
}

/**
 * URL absoluta do agendamento. Com domínio curto configurado, devolve
 * `https://<domínio>/<nome>`. Sem origem (SSR ou primeira renderização da
 * hidratação) devolve só o caminho, para o HTML do servidor e do cliente coincidirem.
 */
export function publicBookingUrl(
  origin: string | null | undefined,
  slug: string | null | undefined,
  linkHost: string | null | undefined = publicLinkHost(),
): string | null {
  const path = publicBookingPath(slug);
  if (!path) return null;
  const short = publicLinkHost(linkHost);
  if (short) return `https://${short}/${encodeURIComponent(slug!.trim())}`;
  const base = origin?.trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}
