function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value, max = 180) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function state(checks) {
  if (checks.some((item) => item.status === "critical")) return "critical";
  if (checks.some((item) => item.status === "warning")) return "warning";
  return "ok";
}

function check(id, label, status, detail, advice = "") {
  return {
    id: text(id, 80),
    label: text(label, 120),
    status: ["ok", "warning", "critical"].includes(status) ? status : "warning",
    detail: text(detail, 240),
    advice: text(advice, 280)
  };
}

function safeEvent(raw = {}) {
  return {
    timestamp: text(raw.timestamp, 40),
    kind: text(raw.kind, 40),
    severity: text(raw.severity, 20),
    source: text(raw.source, 80),
    title: text(raw.title, 160),
    detail: text(raw.detail, 240),
    channel: text(raw.channel, 120),
    output: text(raw.output, 120),
    actor: text(raw.actor, 120),
    action: text(raw.action, 40),
    status: text(raw.status, 40)
  };
}

function safeContainer(raw = {}) {
  return {
    name: text(raw.name, 120),
    image: text(raw.image, 160),
    state: text(raw.state, 32),
    health: text(raw.health, 32) || null,
    uptimeSeconds: finite(raw.uptimeSeconds),
    cpuCores: finite(raw.cpuCores),
    memoryUsageBytes: finite(raw.memory?.usageBytes)
  };
}

export function buildDiagnostics(status = {}, {
  events = [],
  journalPersistent = null,
  generatedAt = new Date().toISOString()
} = {}) {
  const supervisor = status.supervisor || {};
  const restreamer = status.restreamer || {};
  const core = restreamer.core || {};
  const ui = restreamer.ui || {};
  const system = status.system || {};
  const docker = status.docker || {};
  const incidentSummary = status.incidents?.summary || {};
  const watchdog = status.watchdog || {};
  const checks = [];

  if (core.configured === false) {
    checks.push(check(
      "restreamer-core",
      "Restreamer Core",
      "warning",
      "Restreamer n'est pas configuré dans Supervisor.",
      "Vérifier RESTREAMER_BASE_URL et les identifiants locaux du Supervisor."
    ));
  } else if (!core.online) {
    checks.push(check(
      "restreamer-core",
      "Restreamer Core",
      "critical",
      "L'API Core ne répond pas.",
      "Vérifier d'abord le conteneur Restreamer et le réseau web-proxy avant toute relance."
    ));
  } else if (!core.authenticated) {
    checks.push(check(
      "restreamer-core",
      "Restreamer Core",
      "critical",
      "Core répond mais l'authentification API échoue.",
      "Vérifier les identifiants Restreamer du .env Supervisor. Ne pas redémarrer Core pour ce seul symptôme."
    ));
  } else {
    checks.push(check(
      "restreamer-core",
      "Restreamer Core",
      "ok",
      `Core ${text(core.version, 40) || "version inconnue"} · ${finite(core.latencyMs)} ms.`,
      "Aucune action."
    ));
  }

  if (ui.configured === false) {
    checks.push(check(
      "restreamer-web-ui",
      "Restreamer Web UI",
      "warning",
      "La sonde Web UI n'est pas configurée.",
      "Vérifier RESTREAMER_BASE_URL ou RESTREAMER_UI_URL."
    ));
  } else if (!ui.online) {
    checks.push(check(
      "restreamer-web-ui",
      "Restreamer Web UI",
      core.authenticated ? "warning" : "critical",
      ui.reachable
        ? `La Web UI répond mais n'est pas opérationnelle${ui.httpStatus ? ` (HTTP ${ui.httpStatus})` : ""}.`
        : "La Web UI ne répond pas.",
      core.authenticated
        ? "Core reste opérationnel : continuer via Supervisor/API et ne pas redémarrer Core pour la seule UI."
        : "Corréler avec l'état Core avant toute action."
    ));
  } else {
    checks.push(check(
      "restreamer-web-ui",
      "Restreamer Web UI",
      "ok",
      `HTTP ${finite(ui.httpStatus)} · ${finite(ui.latencyMs)} ms.`,
      "Aucune action."
    ));
  }

  if (!docker.connected) {
    checks.push(check(
      "docker-observer",
      "Docker observer",
      "warning",
      "Supervisor ne reçoit plus un état Docker exploitable.",
      "Vérifier stream-supervisor-docker-observer et le volume de snapshot avant d'envisager une action sur les services observés."
    ));
  } else if (!docker.observerFresh) {
    checks.push(check(
      "docker-observer",
      "Docker observer",
      "warning",
      "Le snapshot Docker est trop ancien.",
      "Vérifier le helper Docker observer et son volume de sortie."
    ));
  } else {
    checks.push(check(
      "docker-observer",
      "Docker observer",
      "ok",
      `Snapshot récent · Docker ${text(docker.engineVersion, 40) || "version inconnue"}.`,
      "Aucune action."
    ));
  }

  if (!system.available) {
    checks.push(check(
      "system-adapter",
      "Host System Adapter",
      "warning",
      "Les métriques hôte ne sont pas disponibles.",
      "Vérifier les mounts read-only /host/proc, /host/net et /host/disk du conteneur Supervisor."
    ));
  } else {
    checks.push(check(
      "system-adapter",
      "Host System Adapter",
      "ok",
      `CPU ${finite(system.cpu?.usagePercent).toFixed(1)}% · RAM ${finite(system.memory?.usedPercent).toFixed(0)}% · Disk ${finite(system.disk?.usedPercent).toFixed(0)}%.`,
      "Aucune action."
    ));
  }

  if (journalPersistent === false) {
    checks.push(check(
      "journal-storage",
      "Incident journal storage",
      "warning",
      "Le journal fonctionne en mémoire seulement.",
      "Vérifier le volume supervisor_data et les droits d'écriture de /data."
    ));
  } else if (journalPersistent === true) {
    checks.push(check(
      "journal-storage",
      "Incident journal storage",
      "ok",
      "Le journal d'incidents est persistant.",
      "Aucune action."
    ));
  } else {
    checks.push(check(
      "journal-storage",
      "Incident journal storage",
      "warning",
      "État de persistance inconnu.",
      "Vérifier la configuration EVENTS_FILE et le volume supervisor_data."
    ));
  }

  checks.push(check(
    "watchdog",
    "Graduated Watchdog",
    "ok",
    watchdog.mode === "recover" && watchdog.outputRecoveryEnabled
      ? "Recovery ciblée egress armée ; restart global désactivé."
      : watchdog.mode === "off"
        ? "Watchdog désactivé."
        : "Mode observation ; aucune commande automatique.",
    "Les recovery automatiques restent limitées aux destinations egress en erreur avec ingest LIVE. Aucun restart Core/container."
  ));

  const critical = finite(incidentSummary.critical);
  const warnings = finite(incidentSummary.warning);
  checks.push(check(
    "active-incidents",
    "Active incidents",
    critical > 0 ? "critical" : warnings > 0 ? "warning" : "ok",
    `${finite(incidentSummary.active)} actif(s) · ${critical} critique(s) · ${warnings} warning(s).`,
    critical > 0 || warnings > 0 ? "Consulter la page INCIDENTS avant toute action corrective." : "Aucune action."
  ));

  const containers = Array.isArray(docker.containers) ? docker.containers.map(safeContainer) : [];
  const recentEvents = Array.isArray(events) ? events.slice(0, 50).map(safeEvent) : [];
  const summary = restreamer.summary || {};

  return {
    schemaVersion: 1,
    generatedAt: text(generatedAt, 40),
    overall: state(checks),
    supervisor: {
      version: text(supervisor.version, 40),
      mode: text(supervisor.mode, 40),
      uptimeSeconds: finite(supervisor.uptimeSeconds),
      monitorSourcePollMs: finite(supervisor.monitoring?.sourcePollMs),
      lastPollDurationMs: finite(supervisor.monitoring?.pollDurationMs)
    },
    checks,
    streaming: {
      channels: finite(summary.channels),
      channelsLive: finite(summary.live),
      channelsWaiting: finite(summary.waiting),
      channelsStopped: finite(summary.stopped),
      outputs: finite(summary.outputs),
      outputsLive: finite(summary.outputsLive),
      outputsStopped: finite(summary.outputsStopped),
      outputErrors: finite(summary.outputErrors),
      ingestBitrateKbit: finite(summary.ingestBitrateKbit),
      egressBitrateKbit: finite(summary.egressBitrateKbit)
    },
    host: {
      available: Boolean(system.available),
      cpuUsagePercent: system.cpu?.usagePercent == null ? null : finite(system.cpu.usagePercent),
      memoryUsedPercent: finite(system.memory?.usedPercent),
      diskUsedPercent: finite(system.disk?.usedPercent),
      loadOne: finite(system.load?.one),
      loadFive: finite(system.load?.five),
      loadFifteen: finite(system.load?.fifteen),
      uptimeSeconds: finite(system.uptimeSeconds),
      networkInterface: text(system.network?.interface, 40),
      rxBytesPerSecond: finite(system.network?.rxBytesPerSecond),
      txBytesPerSecond: finite(system.network?.txBytesPerSecond)
    },
    docker: {
      connected: Boolean(docker.connected),
      observerFresh: Boolean(docker.observerFresh),
      engineVersion: text(docker.engineVersion, 40),
      ageMs: docker.ageMs == null ? null : finite(docker.ageMs),
      summary: {
        configured: finite(docker.summary?.configured),
        running: finite(docker.summary?.running),
        stopped: finite(docker.summary?.stopped),
        unhealthy: finite(docker.summary?.unhealthy)
      },
      containers
    },
    incidents: {
      active: finite(incidentSummary.active),
      critical,
      warning: warnings,
      journalPersistent: journalPersistent === true,
      recentEvents
    },
    watchdog: {
      mode: text(watchdog.mode, 20),
      outputRecoveryEnabled: watchdog.outputRecoveryEnabled === true,
      globalRestartEnabled: watchdog.globalRestartEnabled === true,
      coreReloadEnabled: watchdog.coreReloadEnabled === true,
      candidates: Array.isArray(watchdog.candidates) ? watchdog.candidates.length : 0,
      pending: finite(watchdog.pending),
      policy: {
        outputErrorThresholdSeconds: finite(watchdog.policy?.outputErrorThresholdSeconds),
        verifyAfterSeconds: finite(watchdog.policy?.verifyAfterSeconds),
        cooldownSeconds: finite(watchdog.policy?.cooldownSeconds),
        maxAttempts: finite(watchdog.policy?.maxAttempts),
        attemptWindowSeconds: finite(watchdog.policy?.attemptWindowSeconds)
      }
    },
    security: {
      rawEnginePayloadIncluded: false,
      streamAddressesIncluded: false,
      streamKeysIncluded: false,
      credentialsIncluded: false,
      jwtIncluded: false,
      ffmpegCommandsIncluded: false,
      environmentIncluded: false,
      rawLogsIncluded: false
    }
  };
}
