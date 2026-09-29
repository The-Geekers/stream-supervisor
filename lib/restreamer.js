import { buildChannels, sanitizeProcess, summarizeChannels } from "./model.js";

const DEFAULT_TIMEOUT_MS = 4500;
const SERVICE_PROBE_INTERVAL_MS = 5000;

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function uiCandidates(baseUrl, uiUrl) {
  const candidates = [];
  const push = (value) => {
    const clean = String(value || "").replace(/\/+$/, "");
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };

  // Restreamer UI is served from the HTTP Core listener in this deployment.
  // Prefer the known-good Core base URL, then try any explicit override.
  push(baseUrl);
  push(uiUrl);
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

  async authenticatedGet(path) {
    let token = await this.login();

    let result = await fetchJson(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (result.status === 401) {
      this.clearToken();
      token = await this.login();
      result = await fetchJson(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    return result;
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
