export type ProductionConfig = Partial<
  Record<
    | "NODE_ENV"
    | "PUBLIC_APP_URL"
    | "ALLOWED_APP_ORIGINS"
    | "MASTER_SECURITY_PIN"
    | "MASTER_RETURN_PIN"
    | "SDR_TOKEN_SECRET"
    | "WHATSAPP_WEBHOOK_SECRET"
    | "AGENDA_CRON_SECRET",
    string
  >
>;
export function validateProductionConfig(env: ProductionConfig): {
  ok: boolean;
  problems: string[];
} {
  const problems: string[] = [];
  const isProduction = env.NODE_ENV === "production";
  const isAllowedProtocol = (url: URL) =>
    url.protocol === "https:" ||
    (!isProduction &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  for (const key of ["MASTER_SECURITY_PIN", "MASTER_RETURN_PIN"] as const) {
    if (!/^\d{6,12}$/.test(env[key] ?? "")) problems.push(key + " deve conter de 6 a 12 dígitos.");
  }
  if (isProduction) {
    for (const key of [
      "SDR_TOKEN_SECRET",
      "WHATSAPP_WEBHOOK_SECRET",
      "AGENDA_CRON_SECRET",
    ] as const) {
      if (!env[key]?.trim()) problems.push(`${key} precisa ser configurada.`);
    }
    for (const key of ["SDR_TOKEN_SECRET", "WHATSAPP_WEBHOOK_SECRET"] as const) {
      const value = env[key];
      if (value !== undefined && value.length < 32)
        problems.push(`${key} deve conter ao menos 32 caracteres.`);
    }
  }
  let publicOrigin: string | undefined;
  try {
    const url = new URL(env.PUBLIC_APP_URL ?? "");
    if (!isAllowedProtocol(url)) throw Error();
    publicOrigin = url.origin;
  } catch {
    problems.push("PUBLIC_APP_URL deve ser uma URL HTTP válida.");
  }
  const allowed = new Set<string>();
  for (const entry of (env.ALLOWED_APP_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    try {
      const url = new URL(entry);
      if (!isAllowedProtocol(url)) throw Error();
      allowed.add(url.origin);
    } catch {
      problems.push("ALLOWED_APP_ORIGINS contém uma origem inválida.");
    }
  }
  if (!allowed.size) problems.push("ALLOWED_APP_ORIGINS deve conter ao menos uma origem.");
  if (publicOrigin && !allowed.has(publicOrigin))
    problems.push("ALLOWED_APP_ORIGINS deve incluir a origem de PUBLIC_APP_URL.");
  return { ok: problems.length === 0, problems };
}
