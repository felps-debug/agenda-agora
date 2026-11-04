import { createFileRoute } from "@tanstack/react-router";
import { handleIncomingWhatsapp } from "@/lib/whatsapp-greeting.server";
import { getWhatsAppWebhookSecret } from "@/lib/env-security.server";
import { timingSafeEqual } from "node:crypto";

export const Route = createFileRoute("/api/public/whatsapp-incoming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let expected: string;
        try { expected = getWhatsAppWebhookSecret(); } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const actual = request.headers.get("x-webhook-secret") ?? "";
        const expectedBuffer = Buffer.from(expected);
        const actualBuffer = Buffer.from(actual);
        if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        let payload: unknown = null;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ received: false }, { status: 200 });
        }
        try {
          const outcome = await handleIncomingWhatsapp(payload);
          return Response.json({ received: true, ...outcome });
        } catch (error) {
          console.error(
            "Falha ao processar mensagem recebida:",
            error instanceof Error ? error.message : error,
          );
          return Response.json({ received: true });
        }
      },
    },
  },
});
