import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bizSchema = z.object({ businessId: z.string().uuid() });

type BizRow = {
  id: string;
  name: string;
  whatsapp_instance: string | null;
  whatsapp_status: string;
};

async function loadOwnedBusiness(
  supabase: any,
  businessId: string,
): Promise<BizRow> {
  const { data: allowed, error: permError } = await supabase.rpc(
    "has_business_permission",
    { _business_id: businessId, _permission: "generate_qrcode" },
  );
  if (permError) throw new Error(permError.message);
  if (!allowed) throw new Error("Você não tem permissão para gerenciar o WhatsApp deste negócio.");

  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, whatsapp_instance, whatsapp_status")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Negócio não encontrado.");
  return data as BizRow;
}

/** Inicia a conexão: marca o negócio como conectando e devolve o QR Code. */
export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const uazapi = await import("./uazapi.server");
    const business = await loadOwnedBusiness(context.supabase, data.businessId);

    const connected = await uazapi.isConnected();
    if (connected) {
      await context.supabase
        .from("businesses")
        .update({ whatsapp_instance: "uazapi", whatsapp_status: "conectado" })
        .eq("id", business.id);
      return { qrCode: null, alreadyConnected: true };
    }

    const qrCode = await uazapi.getQrCode();
    await context.supabase
      .from("businesses")
      .update({ whatsapp_instance: "uazapi", whatsapp_status: "conectando" })
      .eq("id", business.id);

    return { qrCode, alreadyConnected: false };
  });

/** Gera um novo QR Code. */
export const refreshWhatsappQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    await loadOwnedBusiness(context.supabase, data.businessId);
    const uazapi = await import("./uazapi.server");
    const qrCode = await uazapi.getQrCode();
    return { qrCode };
  });

/** Consulta o estado atual da conexão e sincroniza no banco. */
export const getWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const business = await loadOwnedBusiness(context.supabase, data.businessId);
    if (!business.whatsapp_instance) {
      return { status: "desconectado" as const, connected: false };
    }
    const uazapi = await import("./uazapi.server");
    const online = await uazapi.isConnected();
    const status =
      online || business.whatsapp_status === "conectando"
        ? online
          ? ("conectado" as const)
          : ("conectando" as const)
        : ("desconectado" as const);
    if (status !== business.whatsapp_status) {
      await context.supabase
        .from("businesses")
        .update({ whatsapp_status: status })
        .eq("id", business.id);
    }
    return { status, connected: status === "conectado" };
  });

/** Desconecta o WhatsApp do negócio. */
export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const business = await loadOwnedBusiness(context.supabase, data.businessId);
    if (business.whatsapp_instance) {
      const uazapi = await import("./uazapi.server");
      await uazapi.disconnect();
    }
    await context.supabase
      .from("businesses")
      .update({ whatsapp_instance: null, whatsapp_status: "desconectado" })
      .eq("id", business.id);
    return { ok: true };
  });
