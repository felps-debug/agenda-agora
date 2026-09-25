/** Caminho público de agendamento do negócio, ou null quando não há slug utilizável. */
export function publicBookingPath(slug: string | null | undefined): string | null {
  const value = slug?.trim();
  if (!value) return null;
  return `/agendar/${encodeURIComponent(value)}`;
}

/**
 * URL absoluta do agendamento. Sem origem (SSR ou primeira renderização da
 * hidratação) devolve só o caminho, para o HTML do servidor e do cliente coincidirem.
 */
export function publicBookingUrl(
  origin: string | null | undefined,
  slug: string | null | undefined,
): string | null {
  const path = publicBookingPath(slug);
  if (!path) return null;
  const base = origin?.trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}
