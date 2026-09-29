import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createBasicAuth } from "./lib/auth.js";
import { buildDemoStatus } from "./lib/demo.js";
import { DockerAdapter } from "./lib/docker.js";
import { RestreamerAdapter } from "./lib/restreamer.js";
import { SystemAdapter } from "./lib/system.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8090);
const VERSION = "0.1.0-alpha.8";
const DEMO_MODE = process.env.DEMO_MODE === "true";
const requestedMonitorInterval = Number(process.env.MONITOR_INTERVAL_MS || 1000);
const MONITOR_INTERVAL_MS = Math.min(
  10000,
  Math.max(500, Number.isFinite(requestedMonitorInterval) ? requestedMonitorInterval : 1000)
);
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

const system = new SystemAdapter({
  procRoot: process.env.SYSTEM_PROC_ROOT || "/host/proc",
  diskPath: process.env.SYSTEM_DISK_PATH || "/host/disk",
  networkRoot: process.env.SYSTEM_NETWORK_ROOT || "/host/net",
  networkInterface: process.env.SYSTEM_NETWORK_INTERFACE || ""
});

const docker = new DockerAdapter({
  snapshotPath: process.env.DOCKER_STATUS_FILE || "/runtime/docker-status/status.json"
});

const sseClients = new Set();
let latestStatus = null;
let refreshPromise = null;
let monitorTimer = null;

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

function supervisorInfo(pollDurationMs = null) {
  return {
    status: "online",
    mode: "read-only",
    version: VERSION,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    security: {
      authEnabled: auth.enabled
    },
    monitoring: {
      transport: "sse",
      sourcePollMs: MONITOR_INTERVAL_MS,
      pollDurationMs
    }
  };
}

async function collectStatus() {
  const started = performance.now();

  if (DEMO_MODE) {
    const status = buildDemoStatus({
      version: VERSION,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      authEnabled: auth.enabled
    });
    const pollDurationMs = Math.max(0, Math.round(performance.now() - started));
    status.supervisor.monitoring = {
      transport: "sse",
      sourcePollMs: MONITOR_INTERVAL_MS,
      pollDurationMs
    };
    status.generatedAt = new Date().toISOString();
    return status;
  }

  const [restreamerStatus, systemStatus, dockerStatus] = await Promise.all([
    restreamer.overview(),
    system.snapshot(),
    docker.snapshot()
  ]);
  const pollDurationMs = Math.max(0, Math.round(performance.now() - started));

  return {
    supervisor: supervisorInfo(pollDurationMs),
    system: systemStatus,
    restreamer: restreamerStatus,
    docker: dockerStatus,
    generatedAt: new Date().toISOString()
  };
}

function sendSse(res, status) {
  res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
}

function broadcast(status) {
  for (const res of sseClients) {
    try {
      sendSse(res, status);
    } catch {
      sseClients.delete(res);
    }
  }
}

async function refreshStatus() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = collectStatus()
    .then((status) => {
      latestStatus = status;
      broadcast(status);
      return status;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function monitorLoop() {
  try {
    await refreshStatus();
  } catch {
    // Keep the monitor alive. No raw Restreamer/system payload is logged.
  } finally {
    monitorTimer = setTimeout(monitorLoop, MONITOR_INTERVAL_MS);
  }
}

function openEventStream(req, res) {
  res.writeHead(200, securityHeaders({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  }));
  res.write("retry: 2000\n\n");

  sseClients.add(res);
  if (latestStatus) sendSse(res, latestStatus);

  const keepalive = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(keepalive);
      sseClients.delete(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(keepalive);
    sseClients.delete(res);
  });
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

  if (req.method === "GET" && url.pathname === "/api/events") {
    openEventStream(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    try {
      const status = latestStatus || await refreshStatus();
      return sendJson(res, 200, status);
    } catch {
      return sendJson(res, 503, {
        status: "unavailable",
        message: "monitoring snapshot unavailable"
      });
    }
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
  console.log(`[stream-supervisor] ${VERSION} listening on ${HOST}:${PORT}`);
  monitorLoop();
});

process.on("SIGTERM", () => {
  if (monitorTimer) clearTimeout(monitorTimer);
  for (const res of sseClients) {
    try { res.end(); } catch {}
  }
  server.close(() => process.exit(0));
});
