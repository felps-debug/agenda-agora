import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import {
  BROADCAST_AUDIENCES,
  BROADCAST_DEFAULT_ACCENT,
  BROADCAST_DEFAULT_DAYS,
  BROADCAST_DEFAULT_ICON_KEY,
  BROADCAST_MAX_DAYS,
  isBroadcastAccent,
  type BroadcastRow,
} from "@/lib/broadcast";

const DAY_MS = 86_400_000;

/** Colunas da versão atual; as antigas servem de fallback (migration pendente). */
const columnsCurrent =
  "id, title, message, created_at, audiences, display_days, accent_color, icon";
const columnsLegacy = "id, title, message, created_at";

type BroadcastRaw = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  audiences?: string[] | null;
  display_days?: number | null;
  accent_color?: string | null;
  icon?: string | null;
};

function normalize(row: BroadcastRaw): BroadcastRow {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    audiences: row.audiences ?? ["todos"],
    displayDays: row.display_days ?? BROADCAST_DEFAULT_DAYS,
    accent: row.accent_color ?? BROADCAST_DEFAULT_ACCENT,
    icon: row.icon ?? BROADCAST_DEFAULT_ICON_KEY,
  };
}

const isAudience = (value: string) => (BROADCAST_AUDIENCES as readonly string[]).includes(value);

/**
 * Público-alvo: "todos" engloba os demais — quando marcado, sai só ["todos"];
 * seleções específicas são deduplicadas.
 */
const audienceSchema = z
  .array(z.string().refine(isAudience))
  .min(1)
  .transform((values) =>
    values.includes("todos") ? (["todos"] as string[]) : [...new Set(values)],
  );

const createInputSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  audiences: audienceSchema,
  displayDays: z.number().int().min(1).max(BROADCAST_MAX_DAYS),
  accentColor: z.string().refine(isBroadcastAccent).default(BROADCAST_DEFAULT_ACCENT),
  icon: z.string().min(1).default(BROADCAST_DEFAULT_ICON_KEY),
});

/** Master cria um aviso para um público-alvo com prazo de exibição (1–7 dias). */
export const createBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const title = data.title.trim();
    const message = data.message.trim();

    const payload = {
      title,
      message,
      audiences: data.audiences,
      display_days: data.displayDays,
      accent_color: data.accentColor.toLowerCase(),
      icon: data.icon,
    };

    /* (best effort) Limpa avisos que já passaram da janela máxima de 7 dias.
       Sem `await` o builder do Supabase nem dispara a requisição. */
    try {
      await supabaseAdmin
        .from("broadcasts")
        .delete()
        .lt("created_at", new Date(Date.now() - BROADCAST_MAX_DAYS * DAY_MS).toISOString());
    } catch {
      // Falha na limpeza não impede o envio.
    }

    // Colunas novas podem não constar nos tipos gerados do Supabase até a
    // migration ser aplicada/`supabase gen types` rodar novamente.
    const minimal = payload as unknown as { title: string; message: string };
    let { error } = await supabaseAdmin.from("broadcasts").insert(minimal);
    // Fallback: base sem as colunas novas (migration pendente) envia sem
    // públicos/prazo/cor/ícone — a mensagem sempre chega.
    if (error && /audience|display_days|accent_color|icon/i.test(error.message)) {
      ({ error } = await supabaseAdmin
        .from("broadcasts")
        .insert({ title, message } as unknown as { title: string; message: string }));
    }
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Qualquer usuário autenticado lê os avisos (com público e prazo normalizados). */
export const listBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const current = await context.supabase
      .from("broadcasts")
      .select(columnsCurrent)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!current.error) {
      return ((current.data ?? []) as unknown as BroadcastRaw[]).map((row) => normalize(row));
    }

    if (/audience|display_days|accent_color|icon/i.test(current.error.message)) {
      // Migration de público/prazo ainda não aplicada — lê só as colunas originais.
      const legacy = await context.supabase
        .from("broadcasts")
        .select(columnsLegacy)
        .order("created_at", { ascending: false })
        .limit(50);
      if (legacy.error) throw new Error(legacy.error.message);
      return ((legacy.data ?? []) as unknown as BroadcastRaw[]).map((row) => normalize(row));
    }
    throw new Error(current.error.message);
  });

/** Master remove um aviso. */
export const deleteBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin.from("broadcasts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
