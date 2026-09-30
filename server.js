import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createBasicAuth } from "./lib/auth.js";
import { buildDemoStatus } from "./lib/demo.js";
import { DockerAdapter } from "./lib/docker.js";
import { buildDiagnostics } from "./lib/diagnostics.js";
import { EventJournal, IncidentTracker } from "./lib/incidents.js";
import { RestreamerAdapter } from "./lib/restreamer.js";
import { SystemAdapter } from "./lib/system.js";
import { Watchdog } from "./lib/watchdog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8090);
const VERSION = "0.1.0-alpha.11";
const DEMO_MODE = process.env.DEMO_MODE === "true";
const requestedMonitorInterval = Number(process.env.MONITOR_INTERVAL_MS || 1000);
const MONITOR_INTERVAL_MS = Math.min(
  10000,
  Math.max(500, Number.isFinite(requestedMonitorInterval) ? requestedMonitorInterval : 1000)
);
const startedAt = Date.now();

const auth = createBasicAuth({
  username: process.env.SUPERVISOR_USERNAME,
  password: process.env.SUPERVISOR_PASSWORD,
  technicianUsername: process.env.SUPERVISOR_TECH_USERNAME,
  technicianPassword: process.env.SUPERVISOR_TECH_PASSWORD
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

const journal = new EventJournal({
  filePath: process.env.EVENTS_FILE || "/data/events.jsonl"
});
const incidentTracker = new IncidentTracker({
  journal,
  stateFile: process.env.INCIDENT_STATE_FILE || "/data/incidents-state.json"
});
const outputActionsInFlight = new Set();
const watchdog = new Watchdog({
  journal,
  restreamer,
  actionLocks: outputActionsInFlight,
  stateFile: process.env.WATCHDOG_STATE_FILE || "/data/watchdog-state.json",
  mode: String(process.env.WATCHDOG_MODE || "observe").toLowerCase(),
  outputRecoveryEnabled: String(process.env.WATCHDOG_OUTPUT_RECOVERY || "").toLowerCase() === "true",
  errorThresholdMs: Number(process.env.WATCHDOG_OUTPUT_ERROR_THRESHOLD_MS || 20000),
  verifyAfterMs: Number(process.env.WATCHDOG_VERIFY_AFTER_MS || 10000),
  cooldownMs: Number(process.env.WATCHDOG_COOLDOWN_MS || 300000),
  maxAttempts: Number(process.env.WATCHDOG_MAX_ATTEMPTS || 1),
  attemptWindowMs: Number(process.env.WATCHDOG_ATTEMPT_WINDOW_MS || 900000)
});
await journal.init();
await incidentTracker.init();
await watchdog.init();

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

function forbidden(res, code = "forbidden") {
  return sendJson(res, 403, { status:"forbidden", code });
}

async function readJsonBody(req, maxBytes = 2048) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > maxBytes) {
        reject(new Error("body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function findOutput(status, outputId) {
  for (const channel of status?.restreamer?.channels || []) {
    for (const output of channel.outputs || []) {
      if (output.id === outputId) {
        return {
          channel: { id:channel.id, name:channel.name },
          output
        };
      }
    }
  }
  return null;
}

function supervisorInfo(pollDurationMs = null) {
  return {
    status: "online",
    mode: auth.enabled ? "output-control" : "read-only",
    version: VERSION,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    security: {
      authEnabled: auth.enabled,
      actionsAvailable: auth.enabled
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
    status.incidents = await incidentTracker.update(status);
    status.watchdog = await watchdog.evaluate(status);
    return status;
  }

  const [restreamerStatus, systemStatus, dockerStatus] = await Promise.all([
    restreamer.overview(),
    system.snapshot(),
    docker.snapshot()
  ]);
  const pollDurationMs = Math.max(0, Math.round(performance.now() - started));

  const status = {
    supervisor: supervisorInfo(pollDurationMs),
    system: systemStatus,
    restreamer: restreamerStatus,
    docker: dockerStatus,
    generatedAt: new Date().toISOString()
  };
  status.incidents = await incidentTracker.update(status);
  status.watchdog = await watchdog.evaluate(status);
  return status;
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

  const session = auth.authenticate(req.headers.authorization);

  if (req.method === "GET" && url.pathname === "/api/session") {
    return sendJson(res, 200, {
      authenticated: session.authenticated,
      role: session.role,
      username: session.username,
      actionsEnabled: auth.enabled && session.actionsEnabled
    });
  }

  if (req.method === "GET" && url.pathname === "/api/incidents") {
    const limit = Number(url.searchParams.get("limit") || 100);
    return sendJson(res, 200, {
      ...incidentTracker.snapshot(),
      events: journal.list(limit),
      storage: {
        persistent: journal.persistent
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/watchdog") {
    let status = latestStatus;
    if (!status) {
      try { status = await refreshStatus(); } catch {}
    }
    return sendJson(res, 200, status?.watchdog || watchdog.snapshot(status || {}));
  }

  if (req.method === "GET" && url.pathname === "/api/diagnostics") {
    let status = latestStatus;
    if (!status) {
      try { status = await refreshStatus(); } catch {}
    }
    if (!status) {
      return sendJson(res, 503, { status:"unavailable", code:"diagnostics_status_unavailable" });
    }

    const report = buildDiagnostics(status, {
      events: journal.list(50),
      journalPersistent: journal.persistent
    });
    const download = url.searchParams.get("download") === "1";
    return sendJson(
      res,
      200,
      report,
      download ? { "Content-Disposition": 'attachment; filename="stream-supervisor-diagnostics.json"' } : {}
    );
  }

  if (req.method === "POST" && url.pathname === "/api/restreamer/output-command") {
    if (!auth.enabled) return forbidden(res, "actions_locked");
    if (!session.actionsEnabled) return forbidden(res, "insufficient_role");
    if (req.headers["x-supervisor-action"] !== "1") return forbidden(res, "action_header_required");
    if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      return sendJson(res, 415, { status:"unsupported_media_type" });
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { status:"bad_request" });
    }

    const outputId = typeof body?.outputId === "string" ? body.outputId : "";
    const command = typeof body?.command === "string" ? body.command.toLowerCase() : "";

    if (!["start","stop"].includes(command)) {
      return sendJson(res, 400, { status:"bad_request", code:"invalid_command" });
    }

    let status = latestStatus;
    if (!status) {
      try { status = await refreshStatus(); } catch {}
    }

    const match = findOutput(status, outputId);
    if (!match) {
      return sendJson(res, 404, { status:"not_found", code:"unknown_output" });
    }

    if (outputActionsInFlight.has(outputId)) {
      return sendJson(res, 409, { status:"conflict", code:"output_action_in_progress" });
    }

    outputActionsInFlight.add(outputId);
    try {
      await restreamer.commandOutput(outputId, command);
      await journal.append({
        kind: "operator_action",
        severity: "info",
        source: "restreamer-egress",
        title: command === "start" ? "Destination démarrée" : "Destination arrêtée",
        detail: `${match.channel.name} · ${match.output.name}`,
        channel: match.channel.name,
        output: match.output.name,
        actor: session.username || session.role,
        action: command,
        status: "accepted"
      });
      setTimeout(() => refreshStatus().catch(() => {}), 250);
      return sendJson(res, 200, {
        status:"accepted",
        command,
        output: {
          name: match.output.name,
          provider: match.output.provider
        },
        channel: {
          name: match.channel.name
        }
      });
    } catch {
      await journal.append({
        kind: "operator_action",
        severity: "warning",
        source: "restreamer-egress",
        title: "Commande destination échouée",
        detail: `${match.channel.name} · ${match.output.name}`,
        channel: match.channel.name,
        output: match.output.name,
        actor: session.username || session.role,
        action: command,
        status: "failed"
      });
      return sendJson(res, 502, {
        status:"error",
        code:"restreamer_command_failed"
      });
    } finally {
      outputActionsInFlight.delete(outputId);
    }
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
