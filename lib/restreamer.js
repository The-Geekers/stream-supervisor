import { buildChannels, sanitizeProcess, summarizeChannels } from "./model.js";

const DEFAULT_TIMEOUT_MS = 4500;
const SERVICE_PROBE_INTERVAL_MS = 5000;

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uiCandidates(baseUrl, uiUrl) {
  const candidates = [];
  const base = String(baseUrl || "").replace(/\/+$/, "");
  if (base) candidates.push(`${base}/ui/`);

  const override = String(uiUrl || "").trim();
  if (override && !candidates.includes(override)) candidates.push(override);

  return candidates;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      latencyMs: Math.max(0, Math.round(performance.now() - started))
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeHttp(url) {
  if (!configured(url)) {
    return { configured:false, reachable:false, online:false, httpStatus:null, latencyMs:null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "text/html,*/*;q=0.8" }
    });

    const status = response.status;
    return {
      configured: true,
      reachable: true,
      online: status >= 200 && status < 400,
      httpStatus: status,
      latencyMs: Math.max(0, Math.round(performance.now() - started))
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      online: false,
      httpStatus: null,
      latencyMs: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export class RestreamerAdapter {
  constructor({ baseUrl, uiUrl, username, password }) {
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
    this.uiUrls = uiCandidates(this.baseUrl, uiUrl);
    this.username = String(username || "");
    this.password = String(password || "");
    this.token = null;
    this.tokenExpiresAt = 0;
    this.aboutCache = null;
    this.aboutCheckedAt = 0;
    this.uiCache = null;
    this.uiCheckedAt = 0;
  }

  isConfigured() {
    return configured(this.baseUrl) && configured(this.username) && configured(this.password);
  }

  clearToken() {
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  clearServiceCache() {
    this.aboutCache = null;
    this.aboutCheckedAt = 0;
    this.uiCache = null;
    this.uiCheckedAt = 0;
  }

  async verifyAfterRestart({ timeoutMs = 30000, intervalMs = 1000 } = {}) {
    const startedAt = Date.now();
    const deadline = startedAt + Math.max(5000, Math.min(60000, Number(timeoutMs) || 30000));
    const waitMs = Math.max(250, Math.min(5000, Number(intervalMs) || 1000));
    let coreOnline = false;
    let uiOnline = false;
    let uiHttpStatus = null;

    this.clearToken();
    this.clearServiceCache();

    while (Date.now() < deadline) {
      const about = await fetchJson(`${this.baseUrl}/api`).catch(() => ({ ok:false }));
      coreOnline = Boolean(about?.ok);

      let ui = { online:false, httpStatus:null };
      for (const candidate of this.uiUrls) {
        ui = await probeHttp(candidate);
        if (ui.online) break;
      }
      uiOnline = Boolean(ui.online);
      uiHttpStatus = ui.httpStatus ?? null;

      if (coreOnline && uiOnline) {
        this.aboutCache = about;
        this.aboutCheckedAt = Date.now();
        this.uiCache = ui;
        this.uiCheckedAt = Date.now();
        return {
          coreOnline:true,
          uiOnline:true,
          uiHttpStatus,
          waitedMs:Date.now() - startedAt
        };
      }

      await delay(waitMs);
    }

    this.clearServiceCache();
    return {
      coreOnline,
      uiOnline,
      uiHttpStatus,
      waitedMs:Date.now() - startedAt
    };
  }

  async login() {
    if (!this.isConfigured()) throw new Error("restreamer_not_configured");
    if (this.token && this.tokenExpiresAt > Date.now() + 30_000) return this.token;

    const result = await fetchJson(`${this.baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password
      })
    });

    if (!result.ok || typeof result.data?.access_token !== "string") {
      throw new Error(`restreamer_auth_${result.status}`);
    }

    // JWT remains in memory only. It is never logged or returned by Supervisor.
    this.token = result.data.access_token;
    this.tokenExpiresAt = Date.now() + 8 * 60 * 1000;
    return this.token;
  }

  async authenticatedRequest(path, options = {}) {
    let token = await this.login();

    let result = await fetchJson(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    if (result.status === 401) {
      this.clearToken();
      token = await this.login();
      result = await fetchJson(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {})
        }
      });
    }

    return result;
  }

  async authenticatedGet(path) {
    return this.authenticatedRequest(path);
  }

  async commandOutput(id, command) {
    const outputId = String(id || "");
    const action = String(command || "").toLowerCase();
    const validId = /^restreamer-ui:egress:[a-z0-9._-]+:[0-9a-f-]{36}$/i.test(outputId);

    if (!validId) throw new Error("invalid_output_id");
    if (!["start", "stop"].includes(action)) throw new Error("invalid_output_command");

    const result = await this.authenticatedRequest(
      `/api/v3/process/${outputId}/command`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: action })
      }
    );

    if (!result.ok) {
      throw new Error(`restreamer_output_command_${result.status}`);
    }

    return { ok:true, command:action };
  }

  async serviceStatus() {
    const now = Date.now();

    if (!this.aboutCache || now - this.aboutCheckedAt >= SERVICE_PROBE_INTERVAL_MS) {
      this.aboutCache = await fetchJson(`${this.baseUrl}/api`).catch(() => ({
        ok: false,
        status: 0,
        data: null,
        latencyMs: null
      }));
      this.aboutCheckedAt = now;
    }

    if (!this.uiCache || now - this.uiCheckedAt >= SERVICE_PROBE_INTERVAL_MS) {
      let probe = { configured:false, reachable:false, online:false, httpStatus:null, latencyMs:null };
      for (const candidate of this.uiUrls) {
        probe = await probeHttp(candidate);
        if (probe.online) break;
      }
      this.uiCache = probe;
      this.uiCheckedAt = now;
    }

    return {
      about: this.aboutCache,
      ui: this.uiCache
    };
  }

  async overview() {
    const { about, ui } = await this.serviceStatus();

    const empty = {
      core: {
        configured: this.isConfigured(),
        online: false,
        authenticated: false,
        version: null,
        latencyMs: null
      },
      ui,
      summary: summarizeChannels([]),
      channels: []
    };

    if (!this.isConfigured()) return empty;

    const base = {
      ...empty,
      core: {
        configured: true,
        online: Boolean(about?.ok),
        authenticated: false,
        version: about?.data?.version?.number || null,
        latencyMs: about?.latencyMs ?? null
      }
    };

    if (!about?.ok) return base;

    try {
      // Core state contains sensitive fields (command/address). Request only
      // state + metadata, keep the raw payload in memory, then immediately map
      // it through the allow-list sanitizer before anything leaves this adapter.
      const result = await this.authenticatedGet("/api/v3/process?filter=state,metadata");
      if (!result.ok || !Array.isArray(result.data)) return base;

      const safeProcesses = result.data.map(sanitizeProcess);
      const channels = buildChannels(safeProcesses);

      return {
        ...base,
        core: {
          ...base.core,
          authenticated: true
        },
        summary: summarizeChannels(channels),
        channels
      };
    } catch {
      return base;
    }
  }
}
