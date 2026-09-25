/**
 * Sessão já validada por `requireSupabaseAuth` (claims vindas de `getClaims`).
 * Aceita o `context` do middleware diretamente.
 */
export type SuperAdminSession = {
  userId: string;
  claims: { aal?: unknown } | null | undefined;
};

export const MASTER_ACCESS_DENIED = "Acesso restrito ao painel master.";

/**
 * Role `super_admin` atual no banco. Consulta a cada chamada (revogação vale na
 * hora) e nunca confia em role declarada nas claims/metadados do JWT.
 */
export async function hasSuperAdminRole(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Estado de autorização atual do painel Master. */
export async function getSuperAdminStatus(session: SuperAdminSession) {
  const isMaster = await hasSuperAdminRole(session.userId);
  return { isMaster, hasMaster: true as const };
}

/**
 * Guarda central de toda leitura/escrita Master: exige a role `super_admin`
 * atual no banco. Retorna o client admin do Supabase para uso subsequente.
 */
export async function assertSuperAdmin(session: SuperAdminSession) {
  if (!(await hasSuperAdminRole(session.userId))) throw new Error(MASTER_ACCESS_DENIED);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
