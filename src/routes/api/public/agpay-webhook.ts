import { createFileRoute } from "@tanstack/react-router";
import { verifyAgpayWebhookSignature } from "@/lib/agpay.server";
import { persistAgpayWebhookEvent } from "@/lib/agpay-events.server";

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

async function readBoundedBody(request: Request): Promise<string | null> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) throw new Error("Invalid Content-Length");
    if (Number(declaredLength) > MAX_WEBHOOK_BODY_BYTES) return null;
  }

  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export const Route = createFileRoute("/api/public/agpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let rawBody: string | null;
        try {
          rawBody = await readBoundedBody(request);
        } catch {
          return Response.json({ error: "Invalid Content-Length" }, { status: 400 });
        }
        if (rawBody === null) {
          return Response.json({ error: "Payload too large" }, { status: 413 });
        }
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
