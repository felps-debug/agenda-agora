import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  assertSuperAdmin,
  hasSuperAdminRole,
  type SuperAdminSession,
} from "@/lib/auth/require-super-admin";

const bizSchema = z.object({ businessId: z.string().uuid() });

const connectSchema = z
  .object({
    businessId: z.string().uuid(),
    method: z.enum(["qr", "pairing_code"]).default("qr"),
    phone: z.string().max(24).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method === "pairing_code" && !value.phone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Informe o telefone.",
      });
    }
  });

type BizRow = Pick<
  Database["public"]["Tables"]["businesses"]["Row"],
  | "id"
  | "name"
  | "whatsapp_instance"
  | "whatsapp_status"
  | "whatsapp_instance_id"
  | "whatsapp_instance_token"
>;

async function loadOwnedBusiness(
  supabase: SupabaseClient<Database>,
  session: SuperAdminSession,
  businessId: string,
): Promise<BizRow> {
  const { data: allowed, error: permError } = await supabase.rpc("has_business_permission", {
    _business_id: businessId,
    _permission: "generate_qrcode",
  });
  if (permError) throw new Error(permError.message);
  // has_business_permission só considera owner_id/professional; o Master
  // (super_admin) enxerga qualquer negócio via businesses_super_admin mas essa
  // RPC não sabe disso, então precisa da checagem à parte aqui — pela guarda
  // central.
  if (!allowed) {
    if (!(await hasSuperAdminRole(session.userId)))
      throw new Error("Você não tem permissão para gerenciar o WhatsApp deste negócio.");
    await assertSuperAdmin(session);
  }

  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, name, whatsapp_instance, whatsapp_status, whatsapp_instance_id, whatsapp_instance_token",
    )
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Negócio não encontrado.");
  return data;
}

async function updateBusinessWhatsapp(
  businessId: string,
  patch: Database["public"]["Tables"]["businesses"]["Update"],
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("businesses").update(patch).eq("id", businessId);
  if (error) throw new Error("Não foi possível atualizar a conexão do WhatsApp.");
}

async function resolveWhatsappCredential(business: BizRow) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isWhatsappCredentialStoreUnavailable, readWhatsappCredential } =
    await import("./whatsapp-credentials.server");
  try {
    const privateCredential = await readWhatsappCredential(supabaseAdmin, business.id);
    if (privateCredential) return privateCredential;
  } catch (error) {
    if (!isWhatsappCredentialStoreUnavailable(error)) throw error;
  }
  return business.whatsapp_instance_id && business.whatsapp_instance_token
    ? { instanceId: business.whatsapp_instance_id, instanceToken: business.whatsapp_instance_token }
    : null;
}

async function persistWhatsappCredential(
  businessId: string,
  instance: { instanceId: string; instanceToken: string },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isWhatsappCredentialStoreUnavailable, writeWhatsappCredential } =
    await import("./whatsapp-credentials.server");
  try {
    await writeWhatsappCredential(supabaseAdmin, businessId, instance);
  } catch (error) {
    if (!isWhatsappCredentialStoreUnavailable(error)) throw error;
  }
}

/** Inicia a conexão: marca o negócio como conectando e devolve o QR Code. */
export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => connectSchema.parse(d))
  .handler(async ({ context, data }) => {
    const uazapi = await (await import("./whatsapp-provider.server")).loadWhatsappProvider();
    const business = await loadOwnedBusiness(context.supabase, context, data.businessId);

    let instance = await resolveWhatsappCredential(business);
    if (!instance) {
      instance = await uazapi.createBusinessInstance(business.name);
      await persistWhatsappCredential(business.id, instance);
      await updateBusinessWhatsapp(business.id, {
        whatsapp_instance_id: instance.instanceId,
        whatsapp_instance_token: instance.instanceToken,
        whatsapp_instance: instance.instanceId,
        whatsapp_status: "conectando",
      });
    } else if (business.whatsapp_instance !== instance.instanceId) {
      // Backfill: negócios conectados antes de whatsapp_instance_id/token existirem
      // como colunas separadas podem ter ficado com whatsapp_instance vazio.
      await updateBusinessWhatsapp(business.id, { whatsapp_instance: instance.instanceId });
    }
    const connected = await uazapi.isConnected(instance.instanceToken);
    if (connected) {
      await updateBusinessWhatsapp(business.id, { whatsapp_status: "conectado" });
      return { qrCode: null, pairingCode: null, alreadyConnected: true };
    }

    const artifact = await uazapi.startWhatsappConnection(
      instance.instanceToken,
      data.method === "pairing_code"
        ? { method: "pairing_code", phone: data.phone! }
        : { method: "qr" },
    );
    await updateBusinessWhatsapp(business.id, { whatsapp_status: "conectando" });

    return {
      qrCode: artifact?.method === "qr" ? artifact.qrCode : null,
      pairingCode: artifact?.method === "pairing_code" ? artifact.pairingCode : null,
      alreadyConnected: false,
    };
  });

/** Gera um novo QR Code. */
export const refreshWhatsappQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const uazapi = await (await import("./whatsapp-provider.server")).loadWhatsappProvider();
    const business = await loadOwnedBusiness(context.supabase, context, data.businessId);
    const credential = await resolveWhatsappCredential(business);
    if (!credential) throw new Error("Conexão de WhatsApp não iniciada.");
    const qrCode = await uazapi.getQrCode(credential.instanceToken);
    return { qrCode };
  });

/** Consulta o estado atual da conexão e sincroniza no banco. */
export const getWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const business = await loadOwnedBusiness(context.supabase, context, data.businessId);
    const credential = await resolveWhatsappCredential(business);
    if (!business.whatsapp_instance || !credential) {
      return { status: "desconectado" as const, connected: false };
    }
    const uazapi = await (await import("./whatsapp-provider.server")).loadWhatsappProvider();
    const online = await uazapi.isConnected(credential.instanceToken);
    const status =
      online || business.whatsapp_status === "conectando"
        ? online
          ? ("conectado" as const)
          : ("conectando" as const)
        : ("desconectado" as const);
    if (status !== business.whatsapp_status) {
      await updateBusinessWhatsapp(business.id, { whatsapp_status: status });
    }
    return { status, connected: status === "conectado" };
  });

/** Desconecta o WhatsApp do negócio. */
export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const business = await loadOwnedBusiness(context.supabase, context, data.businessId);
    const credential = await resolveWhatsappCredential(business);
    if (credential) {
      const uazapi = await (await import("./whatsapp-provider.server")).loadWhatsappProvider();
      await uazapi.disconnect(credential.instanceToken);
    }
    await updateBusinessWhatsapp(business.id, {
      whatsapp_instance: null,
      whatsapp_status: "desconectado",
    });
    return { ok: true };
  });

const testMessageSchema = z.object({
  businessId: z.string().uuid(),
  phone: z.string().min(10).max(20),
  template: z.string().min(1).max(2000),
});

const TEST_SAMPLE_VARS = {
  nome: "Cliente Teste",
  servico: "Corte de Cabelo",
  data: "01/01",
  hora: "14:00",
};

/** Envia uma mensagem de teste com dados fictícios pro número informado. */
export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => testMessageSchema.parse(d))
  .handler(async ({ context, data }) => {
    const business = await loadOwnedBusiness(context.supabase, context, data.businessId);
    const credential = await resolveWhatsappCredential(business);
    if (!business.whatsapp_instance || !credential) {
      throw new Error("Conecte o WhatsApp em Integrações antes de testar.");
    }
    const { renderMessage } = await import("./whatsapp-notify.server");
    const uazapi = await (await import("./whatsapp-provider.server")).loadWhatsappProvider();
    const message = renderMessage(data.template, { ...TEST_SAMPLE_VARS, negocio: business.name });
    await uazapi.sendTextMessage(credential.instanceToken, data.phone, message);
    return { ok: true };
  });
