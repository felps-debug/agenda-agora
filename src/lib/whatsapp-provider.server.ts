// Seleciona o provedor de WhatsApp pela variável WHATSAPP_PROVIDER ("uazapi" | "evolution").
// O padrão continua UazAPI: a troca para a Evolution (hospedada na VPS) só vale depois de
// definir WHATSAPP_PROVIDER=evolution, e os negócios já conectados precisam reconectar.

export type WhatsappProvider = typeof import("./uazapi.server");

export function whatsappProviderName(): "uazapi" | "evolution" {
  return process.env["WHATSAPP_PROVIDER"]?.trim().toLowerCase() === "evolution"
    ? "evolution"
    : "uazapi";
}

export async function loadWhatsappProvider(): Promise<WhatsappProvider> {
  return whatsappProviderName() === "evolution"
    ? await import("./evolution.server")
    : await import("./uazapi.server");
}
