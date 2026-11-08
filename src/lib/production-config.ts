export type ProductionConfig = Partial<
  Record<
    "PUBLIC_APP_URL" | "ALLOWED_APP_ORIGINS" | "MASTER_SECURITY_PIN" | "MASTER_RETURN_PIN",
    string
  >
>;
export function validateProductionConfig(env: ProductionConfig): {
  ok: boolean;
  problems: string[];
} {
  const problems: string[] = [];
  for (const key of ["MASTER_SECURITY_PIN", "MASTER_RETURN_PIN"] as const) {
    if (!/^\d{6,12}$/.test(env[key] ?? "")) problems.push(key + " deve conter de 6 a 12 dígitos.");
  }
  let publicOrigin: string | undefined;
  try {
    const url = new URL(env.PUBLIC_APP_URL ?? "");
    if (!["https:", "http:"].includes(url.protocol)) throw Error();
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
      if (!["https:", "http:"].includes(url.protocol)) throw Error();
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
