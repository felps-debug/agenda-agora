/**
 * Notificações broadcast do painel master para o painel 2 do dono:
 * público-alvo (quem recebe) e dias de exibição na caixa de notificações
 * do painel 2 — depois do prazo, sai automaticamente da caixa.
 */

const DAY_MS = 86_400_000;

export const BROADCAST_AUDIENCES = ["todos", "teste", "expirados", "assinantes"] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

/** Tag do negócio que recebe (derivada do plano do dono no painel 2). */
export type BroadcastAudienceTag = Exclude<BroadcastAudience, "todos">;

/** Janela máxima de exibição na caixa do painel 2 (em dias). */
export const BROADCAST_MAX_DAYS = 7;
export const BROADCAST_DEFAULT_DAYS = 7;

export const broadcastAudienceLabel: Record<BroadcastAudience, string> = {
  todos: "Todos os usuários",
  teste: "Usuários em teste",
  expirados: "Usuários expirados",
  assinantes: "Somente assinantes",
};

export const broadcastAudienceDescription: Record<BroadcastAudience, string> = {
  todos: "Assinantes, contas em teste e expiradas",
  teste: "Negócios no período de teste grátis",
  expirados: "Acesso vencido, teste encerrado ou suspenso",
  assinantes: "Assinatura ativa e paga",
};

export type BroadcastRow = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  audiences?: string[] | null;
  displayDays?: number | null;
  /** Cor de destaque do pop-up (hex). Ausente = rosa padrão. */
  accent?: string | null;
  /** Chave do ícone escolhido no painel 3. Ausente = sino. */
  icon?: string | null;
};

/** Chave do ícone padrão do broadcast (sino). */
export const BROADCAST_DEFAULT_ICON_KEY = "sino";

/* ---------- Cor de destaque ---------- */

export const BROADCAST_ACCENT_OPTIONS = [
  "#ff1764",
  "#2979ff",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#f43f5e",
  "#eab308",
] as const;

export const BROADCAST_DEFAULT_ACCENT = "#ff1764";

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string | null | undefined): Rgb | null {
  const value = (hex ?? "").trim().replace("#", "");
  const short =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(short)) return null;
  return {
    r: parseInt(short.slice(0, 2), 16),
    g: parseInt(short.slice(2, 4), 16),
    b: parseInt(short.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function rgba({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
/** Base escura do painel do toast (primeiro stop do gradiente). */
const PANEL_BASE: Rgb = { r: 47, g: 10, b: 31 };

/**
 * Deriva TODAS as variações da cor de destaque escolhida — só a cor e os
 * efeitos do rosa mudam; a estrutura/proporções do pop-up permanecem iguais.
 * Retorna variáveis CSS já resolvidas (rgba/hex) para o estilo inline.
 */
export function broadcastAccentVars(accent: string | null | undefined): Record<string, string> {
  const rgb = hexToRgb(accent) ?? hexToRgb(BROADCAST_DEFAULT_ACCENT);
  if (!rgb) return {};
  const light = mix(rgb, WHITE, 0.28);
  const deep = mix(rgb, BLACK, 0.27);
  const pale = mix(rgb, WHITE, 0.62);
  return {
    "--pop-accent": rgbToHex(rgb),
    "--pop-light": rgbToHex(light),
    "--pop-deep": rgbToHex(deep),
    "--pop-pale": rgbToHex(pale),
    "--pop-x-hover": rgbToHex(mix(rgb, WHITE, 0.44)),
    "--pop-border": rgba(mix(rgb, WHITE, 0.22), 0.38),
    "--pop-inner": rgba(rgb, 0.12),
    "--pop-inset": rgba(rgb, 0.06),
    "--pop-glow": rgba(rgb, 0.1),
    "--pop-icon-shadow": rgba(rgb, 0.34),
    "--pop-bar-shadow": rgba(deep, 0.28),
    "--pop-progress-shadow": rgba(rgb, 0.62),
    "--pop-panel": rgba(mix(PANEL_BASE, rgb, 0.24), 0.98),
  };
}

export function isBroadcastAccent(accent: string | null | undefined): boolean {
  return hexToRgb(accent) !== null;
}

/** Linhas antigas de versões anteriores à audiência: tratadas como "todos". */
export function broadcastAudiences(row: BroadcastRow): BroadcastAudience[] {
  const list = (row.audiences ?? []).filter((a): a is BroadcastAudience =>
    (BROADCAST_AUDIENCES as readonly string[]).includes(a),
  );
  return list.length ? list : ["todos"];
}

/** Rótulo compacto para a tabela do painel master. */
export function broadcastAudiencesCompact(row: BroadcastRow): string {
  const audiences = broadcastAudiences(row);
  if (audiences.includes("todos")) return broadcastAudienceLabel.todos;
  return audiences.map((a) => broadcastAudienceLabel[a]).join(" + ");
}

/**
 * A notificação fica na caixa de notificações do painel 2 por `displayDays`
 * dias (1 a 7) a partir do envio; depois expira e é removida automaticamente.
 */
export function isBroadcastExpired(row: BroadcastRow, now: number = Date.now()): boolean {
  const days = Math.min(Math.max(row.displayDays ?? BROADCAST_DEFAULT_DAYS, 1), BROADCAST_MAX_DAYS);
  return now >= new Date(row.createdAt).getTime() + days * DAY_MS;
}

/** A notificação aparece para o negócio cujo plano corresponde a `tag`. */
export function broadcastVisibleTo(
  row: BroadcastRow,
  tag: BroadcastAudienceTag | "todos",
  now: number = Date.now(),
): boolean {
  if (isBroadcastExpired(row, now)) return false;
  if (tag === "todos") return true;
  const audiences = broadcastAudiences(row);
  return audiences.includes("todos") || audiences.includes(tag);
}

/* ---------- Pop-up de aviso (US3): regra "já vi / dispensei" ---------- */
/**
 * Lógica pura de exibição do pop-up de aviso (US3).
 *
 * Um aviso só deve aparecer como pop-up quando:
 *  - é mais novo que o último "tudo visto" (abrir o sino): `createdAt > seenAt`, E
 *  - o seu id ainda não foi dispensado individualmente (fechar no X): `id ∉ dismissedIds`.
 *
 * O controle é por aviso (id), não global — um aviso novo e distinto ainda aparece
 * mesmo que outro tenha sido dispensado.
 */

export type Broadcast = {
  id: string;
  title: string;
  message: string;
  /** ISO string. */
  createdAt: string;
};

export type BroadcastSeenState = {
  /** Timestamp (ms) do último "tudo visto" via sino. */
  seenAt: number;
  /** Ids dispensados individualmente via X do popup. */
  dismissedIds: ReadonlySet<string> | readonly string[];
};

export function shouldShowPopup(
  broadcast: Broadcast | null | undefined,
  { seenAt, dismissedIds }: BroadcastSeenState,
): boolean {
  if (!broadcast) return false;
  const dismissed =
    dismissedIds instanceof Set ? dismissedIds : new Set<string>(dismissedIds as readonly string[]);
  if (dismissed.has(broadcast.id)) return false;
  const created = new Date(broadcast.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return created > seenAt;
}
