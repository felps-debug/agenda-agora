import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type WhatsappCredential = { instanceId: string; instanceToken: string };

/**
 * O deploy é compatível com bancos que ainda não receberam a migration da tabela
 * privada. Outros erros continuam sendo erros reais e não devem ser mascarados.
 */
export function isWhatsappCredentialStoreUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("business_whatsapp_credentials") &&
    /does not exist|relation|schema cache|not find/i.test(message)
  );
}

/** Server-only credential access. Never return this type from a server function. */
export async function readWhatsappCredential(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<WhatsappCredential | null> {
  const { data, error } = await supabase
    .from("business_whatsapp_credentials")
    .select("instance_id, instance_token")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) {
    const credentialError = new Error(
      `Não foi possível consultar a credencial do WhatsApp. ${error.message}`,
    );
    throw credentialError;
  }
  return data ? { instanceId: data.instance_id, instanceToken: data.instance_token } : null;
}

export async function writeWhatsappCredential(
  supabase: SupabaseClient<Database>,
  businessId: string,
  credential: WhatsappCredential,
): Promise<void> {
  const { error } = await supabase.from("business_whatsapp_credentials").upsert({
    business_id: businessId,
    instance_id: credential.instanceId,
    instance_token: credential.instanceToken,
  });
  if (error) {
    throw new Error(`Não foi possível salvar a credencial do WhatsApp. ${error.message}`);
  }
}
