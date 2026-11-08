import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, readFileSync, createWriteStream } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { request as forwardRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { chromium } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const origins =
  "https://app.agendagora.company,https://painel.agendagora.company,https://admin.agendagora.company";
const build = spawnSync(
  process.execPath,
  ["--max-old-space-size=768", "node_modules/vite/bin/vite.js", "build"],
  {
    env: {
      ...process.env,
      VITE_SPLIT_PANELS: "true",
      PUBLIC_APP_URL: "https://app.agendagora.company",
      ALLOWED_APP_ORIGINS: origins,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=768`,
    },
    windowsHide: true,
    stdio: "inherit",
  },
);
assert.equal(build.status, 0, "Split-host production build failed");
mkdirSync("test-results/qa", { recursive: true });
const log = createWriteStream("test-results/qa/split-preview-server.log");
const server = spawn(process.execPath, ["--max-old-space-size=512", ".output/server/index.mjs"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: "0",
    PUBLIC_APP_URL: "https://app.agendagora.company",
    ALLOWED_APP_ORIGINS: origins,
  },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
const serverClosed = new Promise((resolve) => server.once("close", resolve));
let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk;
  log.write(chunk);
});
server.stderr.on("data", (chunk) => log.write(chunk));
let browser;
let proxy;
let failure;
try {
  const preview = await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      clearInterval(timer);
      reject(Error("Production preview did not start in 20s"));
    }, 20000);
    const timer = setInterval(() => {
      const url = output.match(/http:\/\/127\.0\.0\.1:(\d+)/)?.[0];
      if (url) {
        clearTimeout(deadline);
        clearInterval(timer);
        resolve(url);
      } else if (server.exitCode !== null || server.signalCode !== null) {
        clearTimeout(deadline);
        clearInterval(timer);
        reject(Error("Production preview exited during startup"));
      }
    }, 100);
    server.once("error", (error) => {
      clearTimeout(deadline);
      clearInterval(timer);
      reject(error);
    });
  });
  const key = "test-results/qa/split-preview.key.pem";
  const cert = "test-results/qa/split-preview.cert.pem";
  if (!existsSync(key) || !existsSync(cert)) {
    const bundled = "C:/Program Files/Git/usr/bin/openssl.exe";
    const generated = spawnSync(
      existsSync(bundled) ? bundled : "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-keyout",
        key,
        "-out",
        cert,
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:app.agendagora.company,DNS:painel.agendagora.company,DNS:admin.agendagora.company",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    assert.equal(generated.status, 0, "OpenSSL is required for the local HTTPS fixture");
  }
  proxy = createHttpsServer(
    { key: readFileSync(key), cert: readFileSync(cert) },
    (request, response) => {
      const upstream = forwardRequest(
        preview + request.url,
        {
          method: request.method,
          headers: {
            ...request.headers,
            "x-forwarded-proto": "https",
            "x-forwarded-host": request.headers.host,
          },
        },
        (result) => {
          response.writeHead(result.statusCode, result.headers);
          result.pipe(response);
        },
      );
      upstream.on("error", () => {
        if (!response.headersSent) response.writeHead(502);
        response.end();
      });
      request.pipe(upstream);
    },
  );
  await new Promise((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(443, "127.0.0.1", resolve);
  });
  process.env.QA_BASE_URL = "https://admin.agendagora.company";
  process.env.QA_LOCAL_SPLIT_HTTPS = "1";
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-proxy-server",
      "--host-resolver-rules=MAP app.agendagora.company 127.0.0.1,MAP painel.agendagora.company 127.0.0.1,MAP admin.agendagora.company 127.0.0.1",
    ],
  });
  const { impersonacao } = await import("./scenarios/impersonacao.mjs");
  await impersonacao(browser);
  console.log(
    "PASS compiled production build: split hosts, support navigation/F5, PIN return and forced logout",
  );
} catch (error) {
  failure = error;
  throw error;
} finally {
  await browser?.close();
  if (proxy?.listening) await new Promise((resolve) => proxy.close(resolve));
  server.kill();
  await serverClosed;
  log.end();
  writeFileSync(
    "test-results/qa/split-panels.json",
    JSON.stringify(
      { at: new Date().toISOString(), ok: !failure, error: failure?.message },
      null,
      2,
    ),
  );
}
