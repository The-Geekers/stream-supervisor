import http from "node:http";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createBasicAuth } from "./lib/auth.js";
import { buildDemoStatus } from "./lib/demo.js";
import { RestreamerAdapter } from "./lib/restreamer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8090);
const VERSION = "0.1.0-alpha.4";
const DEMO_MODE = process.env.DEMO_MODE === "true";
const startedAt = Date.now();

const auth = createBasicAuth({
  username: process.env.SUPERVISOR_USERNAME,
  password: process.env.SUPERVISOR_PASSWORD
});

const restreamer = new RestreamerAdapter({
  baseUrl: process.env.RESTREAMER_BASE_URL,
  uiUrl: process.env.RESTREAMER_UI_URL,
  username: process.env.RESTREAMER_USERNAME,
  password: process.env.RESTREAMER_PASSWORD
});

function securityHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    ...extra
  };
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, securityHeaders({
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  }));
  res.end(JSON.stringify(body));
}

function unauthorized(res) {
  return sendJson(
    res,
    401,
    { status: "unauthorized" },
    { "WWW-Authenticate": 'Basic realm="Stream Supervisor", charset="UTF-8"' }
  );
}

function systemStatus() {
  return {
    scope: "container",
    platform: os.platform(),
    architecture: os.arch(),
    cpuCount: os.cpus().length,
    loadAverage: os.loadavg(),
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    uptimeSeconds: Math.floor(os.uptime())
  };
}

function supervisorInfo() {
  return {
    status: "online",
    mode: "read-only",
    version: VERSION,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    security: {
      authEnabled: auth.enabled
    }
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      status: "ok",
      service: "stream-supervisor",
      version: VERSION,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
    });
  }

  if (!auth.isAuthorized(req.headers.authorization)) {
    return unauthorized(res);
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    if (DEMO_MODE) {
      return sendJson(res, 200, buildDemoStatus({
        version: VERSION,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        authEnabled: auth.enabled
      }));
    }

    const restreamerStatus = await restreamer.overview();

    return sendJson(res, 200, {
      supervisor: supervisorInfo(),
      system: systemStatus(),
      restreamer: restreamerStatus,
      docker: {
        connected: false
      },
      generatedAt: new Date().toISOString()
    });
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      const content = await readFile(join(__dirname, "public", "index.html"));
      res.writeHead(200, securityHeaders({
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:;"
      }));
      return res.end(content);
    } catch {
      return sendJson(res, 500, { status: "error", message: "UI unavailable" });
    }
  }

  return sendJson(res, 404, { status: "not_found" });
});

server.listen(PORT, HOST, () => {
  // Fixed application metadata only. Never log requests, credentials, tokens,
  // Restreamer payloads, command lines or stream URLs.
  console.log(`[stream-supervisor] ${VERSION} listening on ${HOST}:${PORT}`);
});
