import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const MODES = new Set(["off", "observe", "recover"]);

function cleanText(value, fallback = "", max = 180) {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return clean.slice(0, max) || fallback;
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function outputErrorCandidates(status = {}) {
  const activeIncidentIds = new Set(
    (status?.incidents?.active || [])
      .map((item) => cleanText(item?.id, "", 180))
      .filter(Boolean)
  );
  const candidates = [];

  if (!status?.restreamer?.core?.online || !status?.restreamer?.core?.authenticated) {
    return candidates;
  }

  for (const channel of status?.restreamer?.channels || []) {
    if (channel?.status !== "live") continue;

    for (const output of channel?.outputs || []) {
      if (output?.status !== "error") continue;
      const id = cleanText(output?.id, "", 180);
      if (!id) continue;
      if (!activeIncidentIds.has(`output:${id}:error`)) continue;

      candidates.push({
        id,
        channel: cleanText(channel?.name, "Canal sans nom", 120),
        output: cleanText(output?.name || output?.provider, "Destination", 120),
        provider: cleanText(output?.provider, "", 80)
      });
    }
  }

  return candidates;
}

function findOutput(status, id) {
  for (const channel of status?.restreamer?.channels || []) {
    for (const output of channel?.outputs || []) {
      if (output?.id === id) {
        return {
          channelStatus: channel.status,
          channel: cleanText(channel?.name, "Canal sans nom", 120),
          output: cleanText(output?.name || output?.provider, "Destination", 120),
          outputStatus: output.status
        };
      }
    }
  }
  return null;
}

export class Watchdog {
  constructor({
    journal,
    restreamer,
    actionLocks,
    stateFile = "/data/watchdog-state.json",
    mode = "observe",
    outputRecoveryEnabled = false,
    errorThresholdMs = 20_000,
    verifyAfterMs = 10_000,
    cooldownMs = 300_000,
    maxAttempts = 1,
    attemptWindowMs = 900_000
  } = {}) {
    this.journal = journal;
    this.restreamer = restreamer;
    this.actionLocks = actionLocks || new Set();
    this.stateFile = stateFile;
    this.mode = MODES.has(mode) ? mode : "observe";
    this.outputRecoveryEnabled = outputRecoveryEnabled === true;
    this.errorThresholdMs = clamp(errorThresholdMs, 5_000, 300_000, 20_000);
    this.verifyAfterMs = clamp(verifyAfterMs, 5_000, 120_000, 10_000);
    this.cooldownMs = clamp(cooldownMs, 30_000, 3_600_000, 300_000);
    this.maxAttempts = clamp(maxAttempts, 1, 5, 1);
    this.attemptWindowMs = clamp(attemptWindowMs, 60_000, 86_400_000, 900_000);
    this.firstSeen = new Map();
    this.announced = new Set();
    this.pending = new Map();
    this.attempts = new Map();
    this.lastResult = new Map();
  }

  async init() {
    try {
      await mkdir(dirname(this.stateFile), { recursive: true });
      const raw = JSON.parse(await readFile(this.stateFile, "utf8"));
      for (const entry of Array.isArray(raw?.attempts) ? raw.attempts : []) {
        const id = cleanText(entry?.id, "", 180);
        const values = Array.isArray(entry?.timestamps)
          ? entry.timestamps.map((value) => finite(value)).filter((value) => value > 0)
          : [];
        if (id && values.length) this.attempts.set(id, values);
      }
    } catch {
      this.attempts.clear();
    }
  }

  async persist() {
    const tmp = `${this.stateFile}.tmp-${process.pid}`;
    const body = JSON.stringify({
      attempts: [...this.attempts.entries()].map(([id, timestamps]) => ({ id, timestamps }))
    }, null, 2) + "\n";

    try {
      await writeFile(tmp, body, { encoding:"utf8", mode:0o600 });
      await rename(tmp, this.stateFile);
      return true;
    } catch {
      return false;
    }
  }

  pruneAttempts(nowMs) {
    for (const [id, timestamps] of this.attempts.entries()) {
      const kept = timestamps.filter((value) => nowMs - value < this.attemptWindowMs);
      if (kept.length) this.attempts.set(id, kept);
      else this.attempts.delete(id);
    }
  }

  async journalEvent(event) {
    if (!this.journal) return;
    await this.journal.append({
      source: "watchdog",
      ...event
    });
  }

  async resolvePending(status, nowMs) {
    for (const [id, pending] of [...this.pending.entries()]) {
      const current = findOutput(status, id);

      if (current?.outputStatus === "live") {
        this.pending.delete(id);
        this.lastResult.set(id, {
          status:"success",
          at:new Date(nowMs).toISOString(),
          channel:pending.channel,
          output:pending.output
        });
        await this.journalEvent({
          kind:"watchdog_result",
          severity:"info",
          title:"Recovery réussie",
          detail:`${pending.output} est de nouveau LIVE sur ${pending.channel}.`,
          channel:pending.channel,
          output:pending.output,
          action:"start",
          status:"success"
        });
        continue;
      }

      if (nowMs - pending.attemptedAt < this.verifyAfterMs) continue;

      this.pending.delete(id);
      this.lastResult.set(id, {
        status:"failed",
        at:new Date(nowMs).toISOString(),
        channel:pending.channel,
        output:pending.output
      });
      await this.journalEvent({
        kind:"watchdog_result",
        severity:"warning",
        title:"Recovery non confirmée",
        detail:`${pending.output} n'est pas revenu LIVE après la tentative automatique.`,
        channel:pending.channel,
        output:pending.output,
        action:"start",
        status:"failed"
      });
    }
  }

  async evaluate(status = {}) {
    const nowMs = Date.now();
    this.pruneAttempts(nowMs);
    await this.resolvePending(status, nowMs);

    if (this.mode === "off") {
      this.firstSeen.clear();
      this.announced.clear();
      return this.snapshot(status);
    }

    const candidates = outputErrorCandidates(status);
    const candidateIds = new Set(candidates.map((item) => item.id));

    for (const id of [...this.firstSeen.keys()]) {
      if (!candidateIds.has(id)) this.firstSeen.delete(id);
    }
    for (const id of [...this.announced]) {
      if (!candidateIds.has(id)) this.announced.delete(id);
    }

    for (const candidate of candidates) {
      if (this.pending.has(candidate.id)) continue;

      const firstSeenAt = this.firstSeen.get(candidate.id) ?? nowMs;
      this.firstSeen.set(candidate.id, firstSeenAt);
      const ageMs = nowMs - firstSeenAt;
      if (ageMs < this.errorThresholdMs) continue;

      if (!this.announced.has(candidate.id)) {
        this.announced.add(candidate.id);
        await this.journalEvent({
          kind:"watchdog_candidate",
          severity:"warning",
          title:"Recovery candidate",
          detail:`${candidate.output} reste en erreur alors que l'ingest est LIVE.`,
          channel:candidate.channel,
          output:candidate.output,
          action:"start",
          status:this.mode === "recover" && this.outputRecoveryEnabled ? "eligible" : "observe"
        });
      }

      if (this.mode !== "recover" || !this.outputRecoveryEnabled) continue;
      if (this.actionLocks.has(candidate.id)) continue;

      const attempts = this.attempts.get(candidate.id) || [];
      const lastAttemptAt = attempts.length ? attempts[attempts.length - 1] : 0;
      if (lastAttemptAt && nowMs - lastAttemptAt < this.cooldownMs) continue;
      if (attempts.length >= this.maxAttempts) continue;

      this.actionLocks.add(candidate.id);
      try {
        await this.journalEvent({
          kind:"watchdog_action",
          severity:"warning",
          title:"Recovery automatique",
          detail:`Tentative START ciblée sur ${candidate.output} · ${candidate.channel}.`,
          channel:candidate.channel,
          output:candidate.output,
          action:"start",
          status:"attempt"
        });

        await this.restreamer.commandOutput(candidate.id, "start");
        const updatedAttempts = [...attempts, nowMs];
        this.attempts.set(candidate.id, updatedAttempts);
        this.pending.set(candidate.id, {
          attemptedAt:nowMs,
          channel:candidate.channel,
          output:candidate.output
        });
        await this.persist();
      } catch {
        const updatedAttempts = [...attempts, nowMs];
        this.attempts.set(candidate.id, updatedAttempts);
        this.lastResult.set(candidate.id, {
          status:"failed",
          at:new Date(nowMs).toISOString(),
          channel:candidate.channel,
          output:candidate.output
        });
        await this.persist();
        await this.journalEvent({
          kind:"watchdog_result",
          severity:"warning",
          title:"Recovery refusée ou échouée",
          detail:`La commande START ciblée n'a pas pu être appliquée à ${candidate.output}.`,
          channel:candidate.channel,
          output:candidate.output,
          action:"start",
          status:"failed"
        });
      } finally {
        this.actionLocks.delete(candidate.id);
      }
    }

    return this.snapshot(status);
  }

  snapshot(status = {}) {
    const nowMs = Date.now();
    const candidates = outputErrorCandidates(status).map((candidate) => {
      const firstSeenAt = this.firstSeen.get(candidate.id) ?? nowMs;
      const attempts = this.attempts.get(candidate.id) || [];
      const lastAttemptAt = attempts.length ? attempts[attempts.length - 1] : 0;
      const pending = this.pending.get(candidate.id);

      let state = "observing";
      if (pending) state = "verifying";
      else if (attempts.length >= this.maxAttempts) state = "manual";
      else if (lastAttemptAt && nowMs - lastAttemptAt < this.cooldownMs) state = "cooldown";
      else if (nowMs - firstSeenAt >= this.errorThresholdMs) state = "eligible";

      return {
        channel:candidate.channel,
        output:candidate.output,
        provider:candidate.provider,
        state,
        errorAgeSeconds:Math.max(0, Math.floor((nowMs - firstSeenAt) / 1000)),
        attemptsInWindow:attempts.length,
        nextAction:this.mode === "recover" && this.outputRecoveryEnabled ? "targeted-start" : "observe-only"
      };
    });

    const recentResults = [...this.lastResult.values()]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 10);

    return {
      mode:this.mode,
      outputRecoveryEnabled:this.outputRecoveryEnabled,
      globalRestartEnabled:false,
      coreReloadEnabled:false,
      policy:{
        outputErrorThresholdSeconds:Math.round(this.errorThresholdMs / 1000),
        verifyAfterSeconds:Math.round(this.verifyAfterMs / 1000),
        cooldownSeconds:Math.round(this.cooldownMs / 1000),
        maxAttempts:this.maxAttempts,
        attemptWindowSeconds:Math.round(this.attemptWindowMs / 1000)
      },
      candidates,
      pending:candidates.filter((item) => item.state === "verifying").length,
      recentResults
    };
  }
}
