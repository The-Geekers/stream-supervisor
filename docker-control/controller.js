import http from "node:http";
import { pathToFileURL } from "node:url";

const DEFAULT_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const DEFAULT_TARGET = "restreamer";
const DEFAULT_PORT = Number(process.env.CONTROL_PORT || 8181);
const CONTROL_HEADER = "restart-restreamer";

function safeTarget(value) {
  const target = String(value || DEFAULT_TARGET).trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/.test(target)) {
    throw new Error("invalid_restart_target");
  }
  return target;
}

export function createDockerRequester(socketPath = DEFAULT_SOCKET) {
  return function dockerRequest(path, { method = "GET", timeoutMs = 5000 } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        socketPath,
        path,
        method,
        headers: { Accept: "application/json" }
      }, (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
          if (raw.length > 65536) req.destroy(new Error("docker_response_too_large"));
        });
        res.on("end", () => resolve({
          status: Number(res.statusCode || 0),
          raw
        }));
      });
      req.setTimeout(timeoutMs, () => req.destroy(new Error("docker_timeout")));
      req.on("error", reject);
      req.end();
    });
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

export function createDockerControlServer({
  target = DEFAULT_TARGET,
  dockerRequest = createDockerRequester()
} = {}) {
  const restartTarget = safeTarget(target);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://docker-control.local");

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { status:"ok", service:"stream-supervisor-docker-control" });
    }

    if (req.method !== "POST" || url.pathname !== "/v1/restart-restreamer") {
      return sendJson(res, 404, { status:"not_found" });
    }

    if (req.headers["x-supervisor-control"] !== CONTROL_HEADER) {
      return sendJson(res, 403, { status:"forbidden" });
    }

    if (Number(req.headers["content-length"] || 0) > 0) {
      return sendJson(res, 400, { status:"bad_request" });
    }

    const encoded = encodeURIComponent(restartTarget);

    try {
      const inspect = await dockerRequest(`/containers/${encoded}/json`, { method:"GET", timeoutMs:5000 });
      if (inspect.status === 404) {
        return sendJson(res, 404, { status:"error", code:"container_not_found" });
      }
      if (inspect.status < 200 || inspect.status >= 300) {
        return sendJson(res, 502, { status:"error", code:"docker_inspect_failed" });
      }

      let state = null;
      try { state = inspect.raw ? JSON.parse(inspect.raw)?.State : null; } catch {}
      if (!state?.Running) {
        return sendJson(res, 409, { status:"error", code:"container_not_running" });
      }

      const restarted = await dockerRequest(
        `/containers/${encoded}/restart?t=10`,
        { method:"POST", timeoutMs:20000 }
      );
      if (restarted.status !== 204) {
        return sendJson(res, 502, { status:"error", code:"docker_restart_failed" });
      }

      return sendJson(res, 200, { status:"restarted", container:restartTarget });
    } catch {
      return sendJson(res, 502, { status:"error", code:"docker_control_unavailable" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = safeTarget(process.env.DOCKER_RESTART_CONTAINER || DEFAULT_TARGET);
  const server = createDockerControlServer({ target });
  server.listen(DEFAULT_PORT, "0.0.0.0", () => {
    console.log(`[docker-control] listening on :${DEFAULT_PORT}; restart target fixed to ${target}`);
  });
}
