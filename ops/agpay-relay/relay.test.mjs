import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, test } from "node:test";
import { createRelayServer } from "./server.mjs";

const secret = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
const openServers = [];
after(async () => {
  await Promise.all(openServers.map((server) => new Promise((resolve) => server.close(resolve))));
});

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  openServers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

function envelope(overrides = {}) {
  return {
    url: "https://agpay.services/api/v1/payments/pix?limit=1",
    method: "POST",
    headers: {
      Authorization: "Bearer token-de-teste",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: '{"amount":1}',
    ...overrides,
  };
}

function call(base, payload = envelope(), options = {}) {
  return fetch(`${base}${options.path ?? "/api/v1/relay"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Proxy-Secret": options.secret ?? secret },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

test("health não exige segredo; segredo errado é recusado", async () => {
  const base = await listen(createRelayServer({ secret, logger() {} }));
  assert.equal(await (await fetch(`${base}/health`)).text(), "ok");
  assert.equal((await call(base, envelope(), { secret: "errado" })).status, 401);
});

test("recusa caminho externo e destino com outro host, porta ou protocolo", async () => {
  const base = await listen(createRelayServer({ secret, logger() {} }));
  assert.equal((await call(base, envelope(), { path: "/outro" })).status, 404);
  for (const url of [
    "https://outro.example/api/v1/payments/pix",
    "https://agpay.services:8443/api/v1/payments/pix",
    "http://agpay.services/api/v1/payments/pix",
    "https://agpay.services/other",
  ]) {
    assert.equal((await call(base, envelope({ url }))).status, 400);
  }
});

test("recusa corpo acima de 64 KB", async () => {
  const base = await listen(createRelayServer({ secret, logger() {} }));
  assert.equal((await call(base, "x".repeat(65 * 1024))).status, 413);
});

test("repassa método, corpo e apenas headers permitidos e devolve resposta", async () => {
  let received;
  const fakeBase = await listen(
    createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      received = {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks).toString(),
      };
      response.writeHead(201, { "Content-Type": "application/json" });
      response.end('{"status":"pending"}');
    }),
  );
  const base = await listen(
    createRelayServer({
      secret,
      logger() {},
      fetchImpl(url, options) {
        assert.equal(url, envelope().url);
        return fetch(`${fakeBase}/api/v1/payments/pix?limit=1`, options);
      },
    }),
  );
  const response = await call(base);
  assert.equal(response.status, 201);
  assert.match(response.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await response.json(), { status: "pending" });
  assert.equal(received.method, "POST");
  assert.equal(received.body, '{"amount":1}');
  assert.equal(received.headers.authorization, "Bearer token-de-teste");
  assert.equal(received.headers["x-client-id"], undefined);
  assert.equal(received.headers["x-proxy-secret"], undefined);
});

test("respeita timeout do serviço externo", async () => {
  const base = await listen(
    createRelayServer({
      secret,
      timeoutMs: 25,
      logger() {},
      fetchImpl(_url, { signal }) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    }),
  );
  assert.equal((await call(base)).status, 504);
});
