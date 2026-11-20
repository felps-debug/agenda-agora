/**
 * Slug do link público do estabelecimento (ex.: agendas.link/leticia-nails).
 * Sai do nome informado na criação e não muda quando o nome é editado depois.
 */
const MAX_BASE_LENGTH = 40;
const MAX_ATTEMPTS = 50;
// Nomes que colidem com rotas do app ou do domínio curto.
const RESERVED_SLUGS = new Set([
  "painel",
  "agendar",
  "api",
  "admin",
  "master",
  "login",
  "entrar",
  "cadastro",
  "app",
  "www",
]);

export function baseSlugFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-$/, "");
  return base || "negocio";
}

/**
 * Devolve o slug limpo do nome; só se já estiver em uso (ou reservado) acrescenta
 * `-2`, `-3`... em vez de letras aleatórias.
 */
export async function uniqueBusinessSlug(
  name: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = baseSlugFromName(name);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
