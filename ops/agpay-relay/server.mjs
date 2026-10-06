import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const RELAY_PATH = "/api/v1/relay";
const ALLOWED_HEADERS = new Map([
  ["authorization", "Authorization"],
  ["accept", "Accept"],
  ["content-type", "Content-Type"],
]);

function isValidTarget(value) {
  if (typeof value !== "string" || /[\\\u0000-\u001f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "agpay.services" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      url.pathname.startsWith("/api/v1/") &&
      !/%(?:2e|2f|5c)/i.test(value)
    );
  } catch {
    return false;
  }
}

function safeHeaders(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = {};
  for (const [name, headerValue] of Object.entries(value)) {
    const allowedName = ALLOWED_HEADERS.get(name.toLowerCase());
    if (!allowedName || typeof headerValue !== "string" || /[\r\n]/.test(headerValue)) return null;
    result[allowedName] = headerValue;
  }
  if (!/^Bearer \S+$/.test(result.Authorization ?? "")) return null;
  return result;
}

function equalSecret(received, expected) {
  const actual = typeof received === "string" ? received : "";
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash) && actual.length === expected.length;
}

async function readBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) {
      const error = new Error("Body too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createRelayServer({
  secret,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logger = console.log,
} = {}) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("AGPAY_EGRESS_PROXY_SECRET precisa ter pelo menos 32 caracteres.");
  }

  return createServer(async (request, response) => {
    const path = (request.url ?? "").split("?", 1)[0];
    const finish = (status, body, contentType = "text/plain; charset=utf-8") => {
      response.writeHead(status, { "Content-Type": contentType });
      response.end(body);
      logger(`${request.method} ${path} ${status}`);
    };

    if (request.method === "GET" && request.url === "/health") {
      finish(200, "ok");
      return;
    }
    if (request.method !== "POST" || request.url !== RELAY_PATH) {
      finish(404, "Rota inexistente.");
      return;
    }
    if (!equalSecret(request.headers["x-proxy-secret"], secret)) {
      finish(401, "Não autorizado.");
      return;
    }
    if (Number(request.headers["content-length"] ?? 0) > MAX_BODY_BYTES) {
      finish(413, "Corpo excede 64 KB.");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(await readBody(request));
    } catch (error) {
      finish(
        error?.status === 413 ? 413 : 400,
        error?.status === 413 ? "Corpo excede 64 KB." : "JSON inválido.",
      );
      return;
    }
    const headers = safeHeaders(payload?.headers);
    const method = payload?.method;
    const body = payload?.body;
    if (
      !isValidTarget(payload?.url) ||
      !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) ||
      !headers ||
      (body !== null && typeof body !== "string") ||
      ((method === "GET" || method === "DELETE") && body !== null) ||
      (typeof body === "string" && Buffer.byteLength(body) > MAX_BODY_BYTES)
    ) {
      finish(400, "Requisição inválida.");
      return;
    }

    try {
      const upstream = await fetchImpl(payload.url, {
        method,
        headers,
        body: body ?? undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const bytes = Buffer.from(await upstream.arrayBuffer());
      finish(
        upstream.status,
        bytes,
        upstream.headers.get("content-type") ?? "application/octet-stream",
      );
    } catch {
      finish(504, "Serviço temporariamente indisponível.");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.AGPAY_RELAY_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("AGPAY_RELAY_PORT inválida.");
  }
  const server = createRelayServer({ secret: process.env.AGPAY_EGRESS_PROXY_SECRET });
  server.listen(port, "127.0.0.1", () => console.log(`Relay ouvindo em 127.0.0.1:${port}`));
}
