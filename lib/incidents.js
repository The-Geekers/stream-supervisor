import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const SEVERITIES = new Set(["info", "warning", "critical"]);
const EVENT_KINDS = new Set([
  "incident_open",
  "incident_resolved",
  "operator_action",
  "watchdog_candidate",
  "watchdog_action",
  "watchdog_result"
]);

function cleanText(value, fallback = "", max = 180) {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return clean.slice(0, max) || fallback;
}

function safeIso(value, fallback = new Date().toISOString()) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function safeSeverity(value) {
  return SEVERITIES.has(value) ? value : "info";
}

function safeKind(value) {
  return EVENT_KINDS.has(value) ? value : "operator_action";
}

export function normalizeJournalEvent(raw = {}) {
  return {
    id: cleanText(raw.id, randomUUID(), 80),
    timestamp: safeIso(raw.timestamp),
    kind: safeKind(raw.kind),
    severity: safeSeverity(raw.severity),
    source: cleanText(raw.source, "supervisor", 80),
    title: cleanText(raw.title, "Event", 160),
    detail: cleanText(raw.detail, "", 240),
    incidentId: cleanText(raw.incidentId, "", 180),
    channel: cleanText(raw.channel, "", 120),
    output: cleanText(raw.output, "", 120),
    actor: cleanText(raw.actor, "", 120),
    action: cleanText(raw.action, "", 40),
    status: cleanText(raw.status, "", 40)
  };
}

function normalizeIncident(raw = {}) {
  const now = new Date().toISOString();
  return {
    id: cleanText(raw.id, "", 180),
    severity: safeSeverity(raw.severity),
    source: cleanText(raw.source, "supervisor", 80),
    title: cleanText(raw.title, "Incident", 160),
    detail: cleanText(raw.detail, "", 240),
    channel: cleanText(raw.channel, "", 120),
    output: cleanText(raw.output, "", 120),
    openedAt: safeIso(raw.openedAt, now),
    updatedAt: safeIso(raw.updatedAt, now)
  };
}

export class EventJournal {
  constructor({ filePath = "/data/events.jsonl", maxMemory = 5000 } = {}) {
    this.filePath = filePath;
    this.maxMemory = Math.max(50, Math.min(5000, Number(maxMemory) || 500));
    this.events = [];
    this.persistent = true;
  }

  async init() {
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      const raw = await readFile(this.filePath, "utf8");
      this.events = raw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try { return normalizeJournalEvent(JSON.parse(line)); } catch { return null; }
        })
        .filter(Boolean)
        .slice(-this.maxMemory);
    } catch (error) {
      if (error?.code !== "ENOENT") this.persistent = false;
    }
  }

  async append(event) {
    const normalized = normalizeJournalEvent({
      ...event,
      id: randomUUID(),
      timestamp: new Date().toISOString()
    });
    try {
      await appendFile(this.filePath, JSON.stringify(normalized) + "\n", "utf8");
    } catch {
      this.persistent = false;
    }
    this.events.push(normalized);
    if (this.events.length > this.maxMemory) {
      this.events.splice(0, this.events.length - this.maxMemory);
    }
    return normalized;
  }

  list(limit = 100) {
    const safeLimit = Math.max(1, Math.min(this.maxMemory, Number(limit) || 100));
    return this.events.slice(-safeLimit).reverse();
  }
}

function incident(id, severity, source, title, detail = "", extra = {}, openAfterMs = 0) {
  return {
    id,
    severity,
    source,
    title,
    detail,
    channel: extra.channel || "",
    output: extra.output || "",
    openAfterMs
  };
}

export function deriveIncidentCandidates(status = {}) {
  const items = [];
  const restreamer = status.restreamer || {};
  const core = restreamer.core || {};
  const ui = restreamer.ui || {};
  const docker = status.docker || {};

  if (core.configured === false) {
    items.push(incident(
      "restreamer:core:not-configured",
      "warning",
      "restreamer-core",
      "Restreamer non configuré",
      "Supervisor ne dispose pas d'une configuration Restreamer exploitable."
    ));
  } else if (!core.online) {
    items.push(incident(
      "restreamer:core:offline",
      "critical",
      "restreamer-core",
      "Restreamer Core offline",
      "L'API Core ne répond pas."
    ));
  } else if (!core.authenticated) {
    items.push(incident(
      "restreamer:core:auth",
      "critical",
      "restreamer-core",
      "Authentification Restreamer en échec",
      "Core répond, mais Supervisor ne peut pas authentifier l'accès API."
    ));
  }

  if (ui.configured !== false && !ui.online) {
    const detail = ui.reachable
      ? `La Web UI répond mais n'est pas opérationnelle${ui.httpStatus ? ` (HTTP ${ui.httpStatus})` : ""}.`
      : "La Web UI Restreamer ne répond pas.";
    items.push(incident(
      "restreamer:web-ui",
      "warning",
      "restreamer-web-ui",
      ui.reachable ? "Restreamer Web UI dégradée" : "Restreamer Web UI offline",
      detail,
      {},
      5000
    ));
  }

  if (!docker.connected) {
    items.push(incident(
      "docker:observer:disconnected",
      "warning",
      "docker",
      "Docker observer indisponible",
      "Supervisor ne reçoit plus d'état Docker.",
      {},
      5000
    ));
  } else if (!docker.observerFresh) {
    items.push(incident(
      "docker:observer:stale",
      "warning",
      "docker",
      "Docker observer en retard",
      "Le snapshot Docker n'est plus suffisamment récent.",
      {},
      5000
    ));
  }

  for (const container of docker.containers || []) {
    const name = cleanText(container?.name, "container", 120);
    if (container?.state && container.state !== "running") {
      items.push(incident(
        `docker:container:${name}:stopped`,
        name === "restreamer" ? "critical" : "warning",
        "docker",
        `Service Docker arrêté : ${name}`,
        `État Docker : ${cleanText(container.state, "unknown", 40)}.`,
        {},
        3000
      ));
    }
    if (container?.health === "unhealthy") {
      items.push(incident(
        `docker:container:${name}:unhealthy`,
        "warning",
        "docker",
        `Service Docker unhealthy : ${name}`,
        "Le healthcheck Docker signale un état unhealthy.",
        {},
        3000
      ));
    }
  }

  for (const channel of restreamer.channels || []) {
    const channelId = cleanText(channel?.id, "", 120);
    const channelName = cleanText(channel?.name, "Canal sans nom", 120);

    if (channel?.status === "waiting") {
      items.push(incident(
        `channel:${channelId}:waiting`,
        "warning",
        "restreamer-ingest",
        "Signal ingest absent",
        `Aucune source active pour ${channelName}.`,
        { channel: channelName },
        5000
      ));
    } else if (channel?.status === "connecting") {
      items.push(incident(
        `channel:${channelId}:connecting`,
        "warning",
        "restreamer-ingest",
        "Ingest en connexion prolongée",
        `Le signal de ${channelName} reste en cours de connexion.`,
        { channel: channelName },
        15000
      ));
    }

    for (const output of channel?.outputs || []) {
      if (output?.status !== "error") continue;
      const outputId = cleanText(output?.id, "", 160);
      const outputName = cleanText(output?.name || output?.provider, "Destination", 120);
      items.push(incident(
        `output:${outputId}:error`,
        "critical",
        "restreamer-egress",
        "Erreur destination",
        `${outputName} est en erreur sur ${channelName}.`,
        { channel: channelName, output: outputName },
        3000
      ));
    }
  }

  return items;
}

export class IncidentTracker {
  constructor({ journal, stateFile = "/data/incidents-state.json" } = {}) {
    this.journal = journal;
    this.stateFile = stateFile;
    this.active = new Map();
    this.pending = new Map();
  }

  async init() {
    try {
      await mkdir(dirname(this.stateFile), { recursive: true });
      const raw = JSON.parse(await readFile(this.stateFile, "utf8"));
      for (const value of Array.isArray(raw?.active) ? raw.active : []) {
        const item = normalizeIncident(value);
        if (item.id) this.active.set(item.id, item);
      }
    } catch {
      this.active.clear();
    }
  }

  async persist() {
    const tmp = `${this.stateFile}.tmp-${process.pid}`;
    const body = JSON.stringify({ active: [...this.active.values()] }, null, 2) + "\n";
    try {
      await writeFile(tmp, body, { encoding: "utf8", mode: 0o600 });
      await rename(tmp, this.stateFile);
      return true;
    } catch {
      return false;
    }
  }

  async update(status, { holdResolutionIds = [] } = {}) {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const candidates = deriveIncidentCandidates(status);
    const desired = new Map(candidates.map((item) => [item.id, item]));
    const held = new Set(
      Array.from(holdResolutionIds || [])
        .filter((id) => typeof id === "string" && id.length <= 180)
    );
    let changed = false;

    for (const [id, current] of [...this.active.entries()]) {
      const candidate = desired.get(id);
      if (candidate) {
        this.active.set(id, normalizeIncident({
          ...current,
          ...candidate,
          openedAt: current.openedAt,
          updatedAt: nowIso
        }));
        this.pending.delete(id);
        continue;
      }

      if (held.has(id)) {
        this.active.set(id, normalizeIncident({
          ...current,
          openedAt: current.openedAt,
          updatedAt: nowIso
        }));
        this.pending.delete(id);
        continue;
      }

      this.active.delete(id);
      this.pending.delete(id);
      changed = true;
      if (this.journal) {
        await this.journal.append({
          kind: "incident_resolved",
          severity: "info",
          source: current.source,
          title: `Résolu — ${current.title}`,
          detail: current.detail,
          incidentId: current.id,
          channel: current.channel,
          output: current.output,
          status: "resolved"
        });
      }
    }

    for (const candidate of candidates) {
      if (this.active.has(candidate.id)) continue;

      const firstSeen = this.pending.get(candidate.id) ?? nowMs;
      this.pending.set(candidate.id, firstSeen);
      if (nowMs - firstSeen < candidate.openAfterMs) continue;

      const opened = normalizeIncident({
        ...candidate,
        openedAt: nowIso,
        updatedAt: nowIso
      });
      this.active.set(candidate.id, opened);
      this.pending.delete(candidate.id);
      changed = true;

      if (this.journal) {
        await this.journal.append({
          kind: "incident_open",
          severity: opened.severity,
          source: opened.source,
          title: opened.title,
          detail: opened.detail,
          incidentId: opened.id,
          channel: opened.channel,
          output: opened.output,
          status: "open"
        });
      }
    }

    for (const id of [...this.pending.keys()]) {
      if (!desired.has(id) && !held.has(id)) this.pending.delete(id);
    }

    if (changed) await this.persist();
    return this.snapshot();
  }

  snapshot() {
    const rank = { critical: 0, warning: 1, info: 2 };
    const active = [...this.active.values()].sort((a, b) => {
      const severity = (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
      if (severity) return severity;
      return Date.parse(a.openedAt) - Date.parse(b.openedAt);
    });

    return {
      active,
      summary: {
        active: active.length,
        critical: active.filter((item) => item.severity === "critical").length,
        warning: active.filter((item) => item.severity === "warning").length,
        info: active.filter((item) => item.severity === "info").length
      }
    };
  }
}
