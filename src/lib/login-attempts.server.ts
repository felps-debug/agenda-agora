import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin;

export async function checkLock(key: string) {
  const { data, error } = await db
    .from("auth_attempts")
    .select("locked_until")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar o limite de tentativas.");
  const lockedUntil = data?.locked_until ? new Date(data.locked_until).getTime() : 0;
  return {
    locked: lockedUntil > Date.now(),
    retryAfterSeconds: Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)),
  };
}

export async function registerFailure(
  key: string,
  options: { limit: number; windowMs: number; lockMs: number },
) {
  const { data, error } = await db.rpc("register_auth_failure", {
    p_key: key,
    p_limit: options.limit,
    p_window_ms: options.windowMs,
    p_lock_ms: options.lockMs,
  });
  if (error) throw new Error("Não foi possível registrar a tentativa.");
  const retryAfterSeconds = Number(data ?? 0);
  return { locked: retryAfterSeconds > 0, retryAfterSeconds };
}

export async function registerSuccess(key: string) {
  const { error } = await db.from("auth_attempts").delete().eq("key", key);
  if (error) throw new Error("Não foi possível limpar o limite de tentativas.");
}
