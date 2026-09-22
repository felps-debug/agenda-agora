/** Garante que o usuário autenticado é super_admin; retorna o client admin do Supabase para uso subsequente. */
export async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito ao painel master.");
  return supabaseAdmin;
}
