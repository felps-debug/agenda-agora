import { createFileRoute } from "@tanstack/react-router";
import { verifyAgpayWebhookSignature } from "@/lib/agpay.server";
import { persistAgpayWebhookEvent } from "@/lib/agpay-events.server";

export const Route = createFileRoute("/api/public/agpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");

        let authorized: boolean;
        try {
          authorized = verifyAgpayWebhookSignature(rawBody, signature);
        } catch (error) {
          console.error("Webhook AgPay sem configuração segura:", error);
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }
        if (!authorized) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (
          !payload ||
          typeof payload !== "object" ||
          !("event" in payload) ||
          typeof payload.event !== "string" ||
          !("data" in payload) ||
          !payload.data ||
          typeof payload.data !== "object"
        ) {
          return Response.json({ error: "Invalid event" }, { status: 400 });
        }

        try {
          await persistAgpayWebhookEvent(rawBody, payload);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Falha ao persistir evento AgPay:", error);
          return Response.json({ error: "Persistence failed" }, { status: 500 });
        }
      },
    },
  },
});
