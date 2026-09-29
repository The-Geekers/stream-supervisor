import http from "node:http";
import { writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const OUTPUT = process.env.OUTPUT_FILE || "/output/status.json";
const INTERVAL_MS = Math.min(10000, Math.max(1000, Number(process.env.OBSERVER_INTERVAL_MS || 2000)));
const WATCH = new Set(
  String(process.env.DOCKER_MONITOR_CONTAINERS || "restreamer,stream-supervisor")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);

function requestJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath: SOCKET,
      path,
      method: "GET",
      headers: { Accept: "application/json" }
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error("docker_http_error"));
          return;
        }
        try {
          resolve(raw ? JSON.parse(raw) : null);
        } catch {
          reject(new Error("docker_invalid_json"));
        }
      });
    });
    req.setTimeout(4000, () => req.destroy(new Error("docker_timeout")));
    req.on("error", reject);
    req.end();
  });
}

function safeName(item) {
  const names = Array.isArray(item?.Names) ? item.Names : [];
  return String(names[0] || "").replace(/^\//, "").slice(0, 120);
}

function healthFromStatus(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("(healthy)")) return "healthy";
  if (text.includes("(unhealthy)")) return "unhealthy";
  if (text.includes("(health: starting)")) return "starting";
  return null;
}

function cpuPercent(stats) {
  const current = Number(stats?.cpu_stats?.cpu_usage?.total_usage || 0);
  const previous = Number(stats?.precpu_stats?.cpu_usage?.total_usage || 0);
  const currentSystem = Number(stats?.cpu_stats?.system_cpu_usage || 0);
  const previousSystem = Number(stats?.precpu_stats?.system_cpu_usage || 0);
  const cpuDelta = current - previous;
  const systemDelta = currentSystem - previousSystem;
  const cpus = Number(stats?.cpu_stats?.online_cpus)
    || stats?.cpu_stats?.cpu_usage?.percpu_usage?.length
    || 1;

  if (cpuDelta <= 0 || systemDelta <= 0) return 0;
  return Math.max(0, (cpuDelta / systemDelta) * cpus * 100);
}

function memoryStats(stats) {
  const rawUsage = Number(stats?.memory_stats?.usage || 0);
  const values = stats?.memory_stats?.stats || {};
  const cache = Number(values.inactive_file ?? values.total_inactive_file ?? values.cache ?? 0);
  const usageBytes = Math.max(0, rawUsage - cache);
  const limitBytes = Number(stats?.memory_stats?.limit || 0);
  return {
    usageBytes,
    limitBytes,
    usagePercent: limitBytes > 0 ? (usageBytes / limitBytes) * 100 : 0
  };
}

async function safeStats(id) {
  try {
    const stats = await requestJson(`/containers/${encodeURIComponent(id)}/stats?stream=false`);
    return {
      cpuPercent: cpuPercent(stats),
      memory: memoryStats(stats)
    };
  } catch {
    return {
      cpuPercent: 0,
      memory: { usageBytes: 0, limitBytes: 0, usagePercent: 0 }
    };
  }
}

async function collect() {
  const [containers, version] = await Promise.all([
    requestJson("/containers/json?all=1"),
    requestJson("/version").catch(() => null)
  ]);

  const selected = (Array.isArray(containers) ? containers : [])
    .map((item) => ({ item, name: safeName(item) }))
    .filter(({ name }) => WATCH.size === 0 || WATCH.has(name));

  const result = [];
  for (const { item, name } of selected) {
    const state = String(item?.State || "unknown").slice(0, 32);
    const stats = state === "running" ? await safeStats(item.Id) : {
      cpuPercent: 0,
      memory: { usageBytes: 0, limitBytes: 0, usagePercent: 0 }
    };
    const created = Number(item?.Created || 0);

    result.push({
      id: String(item?.Id || "").slice(0, 12),
      name,
      image: String(item?.Image || "").slice(0, 160),
      state,
      status: String(item?.Status || "").slice(0, 160),
      health: healthFromStatus(item?.Status),
      createdAt: created > 0 ? new Date(created * 1000).toISOString() : null,
      uptimeSeconds: state === "running" && created > 0
        ? Math.max(0, Math.floor(Date.now() / 1000) - created)
        : 0,
      cpuPercent: stats.cpuPercent,
      memory: stats.memory
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }));

  return {
    schemaVersion: 1,
    connected: true,
    observedAt: new Date().toISOString(),
    engineVersion: typeof version?.Version === "string" ? version.Version.slice(0, 40) : null,
    containers: result
  };
}

async function writeSnapshot(snapshot) {
  await mkdir(dirname(OUTPUT), { recursive: true });
  const temp = `${OUTPUT}.tmp`;
  await writeFile(temp, JSON.stringify(snapshot), { encoding: "utf8", mode: 0o644 });
  await rename(temp, OUTPUT);
}

async function cycle() {
  try {
    await writeSnapshot(await collect());
  } catch {
    await writeSnapshot({
      schemaVersion: 1,
      connected: false,
      observedAt: new Date().toISOString(),
      engineVersion: null,
      containers: []
    }).catch(() => {});
  }
}

async function loop() {
  await cycle();
  setTimeout(loop, INTERVAL_MS);
}

loop();
