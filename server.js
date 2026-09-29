import http from "node:http";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || "0.0.0.0";
const startedAt = Date.now();
const version = "0.1.0-alpha.1";

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    return json(res, 200, {
      status: "ok",
      service: "stream-supervisor",
      version,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
    });
  }

  if (url.pathname === "/api/status") {
    return json(res, 200, {
      supervisor: {
        status: "online",
        version,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
      },
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        architecture: os.arch(),
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg(),
        totalMemoryBytes: os.totalmem(),
        freeMemoryBytes: os.freemem(),
        osUptimeSeconds: Math.floor(os.uptime())
      },
      integrations: {
        restreamer: "not_connected",
        docker: "not_connected"
      }
    });
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const content = await readFile(join(__dirname, "public", "index.html"));
      res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
      return res.end(content);
    } catch {
      return json(res, 500, {status:"error", message:"UI unavailable"});
    }
  }

  return json(res, 404, {status:"not_found"});
});

server.listen(PORT, HOST, () => {
  console.log(`[stream-supervisor] ${version} listening on http://${HOST}:${PORT}`);
});
