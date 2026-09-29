import { readFile } from "node:fs/promises";

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clean(value, max = 160) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function safeContainer(raw) {
  return {
    id: clean(raw?.id, 12),
    name: clean(raw?.name, 120),
    image: clean(raw?.image, 160),
    state: clean(raw?.state, 32),
    status: clean(raw?.status, 160),
    health: ["healthy","unhealthy","starting"].includes(raw?.health) ? raw.health : null,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt.slice(0, 40) : null,
    uptimeSeconds: finite(raw?.uptimeSeconds),
    cpuPercent: finite(raw?.cpuPercent),
    memory: {
      usageBytes: finite(raw?.memory?.usageBytes),
      limitBytes: finite(raw?.memory?.limitBytes),
      usagePercent: finite(raw?.memory?.usagePercent)
    }
  };
}

export class DockerAdapter {
  constructor({ snapshotPath = "/runtime/docker-status/status.json", staleAfterMs = 7000 } = {}) {
    this.snapshotPath = snapshotPath;
    this.staleAfterMs = staleAfterMs;
  }

  async snapshot() {
    try {
      const raw = JSON.parse(await readFile(this.snapshotPath, "utf8"));
      const observedAtMs = Date.parse(raw?.observedAt || "");
      const ageMs = Number.isFinite(observedAtMs) ? Math.max(0, Date.now() - observedAtMs) : Infinity;
      const containers = Array.isArray(raw?.containers) ? raw.containers.map(safeContainer) : [];

      return {
        connected: Boolean(raw?.connected) && ageMs <= this.staleAfterMs,
        observerFresh: ageMs <= this.staleAfterMs,
        observedAt: Number.isFinite(observedAtMs) ? new Date(observedAtMs).toISOString() : null,
        ageMs: Number.isFinite(ageMs) ? ageMs : null,
        engineVersion: clean(raw?.engineVersion, 40) || null,
        summary: {
          configured: containers.length,
          running: containers.filter((c) => c.state === "running").length,
          stopped: containers.filter((c) => c.state !== "running").length,
          unhealthy: containers.filter((c) => c.health === "unhealthy").length
        },
        containers
      };
    } catch {
      return {
        connected: false,
        observerFresh: false,
        observedAt: null,
        ageMs: null,
        engineVersion: null,
        summary: { configured: 0, running: 0, stopped: 0, unhealthy: 0 },
        containers: []
      };
    }
  }
}
