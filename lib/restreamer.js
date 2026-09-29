import { buildChannels, sanitizeProcess, summarizeChannels } from "./model.js";

const DEFAULT_TIMEOUT_MS = 4500;

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function deriveUiUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (!url.port || url.port === "8080") {
      url.port = "8181";
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    return "";
  }
  return "";
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
    this.uiUrl = String(uiUrl || deriveUiUrl(this.baseUrl) || "").replace(/\/+$/, "");
    this.username = String(username || "");
    this.password = String(password || "");
    this.token = null;
    this.tokenExpiresAt = 0;
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

  async overview() {
    const empty = {
      core: {
        configured: this.isConfigured(),
        online: false,
        authenticated: false,
        version: null,
        latencyMs: null
      },
      ui: await probeHttp(this.uiUrl),
      summary: summarizeChannels([]),
      channels: []
    };

    if (!this.isConfigured()) return empty;

    const about = await fetchJson(`${this.baseUrl}/api`).catch(() => ({
      ok: false,
      status: 0,
      data: null,
      latencyMs: null
    }));

    const base = {
      ...empty,
      core: {
        configured: true,
        online: Boolean(about.ok),
        authenticated: false,
        version: about.data?.version?.number || null,
        latencyMs: about.latencyMs
      }
    };

    if (!about.ok) return base;

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
