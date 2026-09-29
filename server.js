import http from "node:http";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { RestreamerAdapter } from "./lib/restreamer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8090);
const VERSION = "0.1.0-alpha.3";
const startedAt = Date.now();

const restreamer = new RestreamerAdapter({
  baseUrl: process.env.RESTREAMER_BASE_URL,
  username: process.env.RESTREAMER_USERNAME,
  password: process.env.RESTREAMER_PASSWORD
});

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  res.end(JSON.stringify(body));
}

function systemStatus() {
  return {
    platform: os.platform(),
    architecture: os.arch(),
    cpuCount: os.cpus().length,
    loadAverage: os.loadavg(),
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    uptimeSeconds: Math.floor(os.uptime())
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

  if (req.method === "GET" && url.pathname === "/api/status") {
    const restreamerStatus = await restreamer.overview();

    return sendJson(res, 200, {
      supervisor: {
        status: "online",
        mode: "read-only",
        version: VERSION,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
      },
      system: systemStatus(),
      restreamer: restreamerStatus,
      docker: {
        connected: false
      }
    });
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      const content = await readFile(join(__dirname, "public", "index.html"));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:;"
      });
      return res.end(content);
    } catch {
      return sendJson(res, 500, { status: "error", message: "UI unavailable" });
    }
  }

  return sendJson(res, 404, { status: "not_found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[stream-supervisor] ${VERSION} listening on ${HOST}:${PORT}`);
});
