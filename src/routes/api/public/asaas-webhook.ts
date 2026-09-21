import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { getRequiredWebhookToken } from "@/lib/asaas.server";
import { persistAsaasWebhookEvent } from "@/lib/asaas-events.server";

function validWebhookToken(request: Request, expected: string) {
  const received = request.headers.get("asaas-access-token") ?? "";
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(received), digest(expected));
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let expectedToken: string;
        try {
          expectedToken = getRequiredWebhookToken();
        } catch (error) {
          console.error("Webhook Asaas sem configuração segura:", error);
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        if (!validWebhookToken(request, expectedToken)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (
          !payload ||
          typeof payload !== "object" ||
          !("id" in payload) ||
          !("event" in payload)
        ) {
          return Response.json({ error: "Invalid event" }, { status: 400 });
        }

        try {
          await persistAsaasWebhookEvent(payload);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Falha ao persistir evento Asaas:", error);
          return Response.json({ error: "Persistence failed" }, { status: 500 });
        }
      },
    },
  },
});
