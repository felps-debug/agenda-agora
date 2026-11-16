import { createFileRoute } from "@tanstack/react-router";
import {
  handleIncomingWhatsapp,
  resolveBusinessByInstanceToken,
} from "@/lib/whatsapp-greeting.server";
import { getWhatsAppWebhookSecret } from "@/lib/env-security.server";
import { timingSafeEqual } from "node:crypto";

const MAX_INCOMING_BODY_BYTES = 1024 * 1024;

async function readBoundedJson(
  request: Request,
): Promise<{ payload: unknown } | { errorStatus: 400 | 413 }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) return { errorStatus: 400 };
    if (declaredLength > MAX_INCOMING_BODY_BYTES) return { errorStatus: 413 };
  }

  if (!request.body) return { errorStatus: 400 };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_INCOMING_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { errorStatus: 413 };
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
  try {
    return { payload: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { errorStatus: 400 };
  }
}

export const Route = createFileRoute("/api/public/whatsapp-incoming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readBoundedJson(request);
        if ("errorStatus" in body) {
          if (body.errorStatus === 413)
            return Response.json({ error: "Payload too large" }, { status: 413 });
        }
        let expected: string | null = null;
        try {
          expected = getWhatsAppWebhookSecret();
        } catch {
          /* UazAPI autentica com token de instância. */
        }
        const actual = request.headers.get("x-webhook-secret") ?? "";
        const expectedBuffer = Buffer.from(expected ?? "");
        const actualBuffer = Buffer.from(actual);
        const validSharedSecret =
          expectedBuffer.length > 0 &&
          expectedBuffer.length === actualBuffer.length &&
          timingSafeEqual(expectedBuffer, actualBuffer);
        let payload: unknown = null;
        if (!("payload" in body)) {
          return validSharedSecret
            ? Response.json({ received: false }, { status: 200 })
            : Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        payload = body.payload;
        if (!validSharedSecret) {
          const root =
            payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
          const instanceToken =
            root["EventType"] === "messages" && typeof root["token"] === "string"
              ? root["token"]
              : null;
          if (!instanceToken) return Response.json({ error: "Unauthorized" }, { status: 401 });
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const business = await resolveBusinessByInstanceToken(supabaseAdmin, instanceToken);
            if (!business) return Response.json({ error: "Unauthorized" }, { status: 401 });
          } catch {
            return Response.json({ error: "Webhook authentication unavailable" }, { status: 503 });
          }
        }
        try {
          const outcome = await handleIncomingWhatsapp(payload);
          return Response.json({ received: true, ...outcome });
        } catch (error) {
          console.error(
            "Falha ao processar mensagem recebida:",
            error instanceof Error ? error.message : error,
          );
          return Response.json(
            { error: "Could not durably register webhook event" },
            { status: 503 },
          );
        }
      },
    },
  },
});
