import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";

/** Master cria um aviso para todos. */
export const createBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ title: z.string().min(1), message: z.string().min(1) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin
      .from("broadcasts")
      .insert({ title: data.title, message: data.message });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Qualquer usuário autenticado lê os avisos. */
export const listBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("broadcasts")
      .select("id, title, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      message: b.message,
      createdAt: b.created_at,
    }));
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
