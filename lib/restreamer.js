import { buildChannels, sanitizeProcess, summarizeChannels } from "./model.js";

const DEFAULT_TIMEOUT_MS = 4500;

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
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
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

export class RestreamerAdapter {
  constructor({ baseUrl, username, password }) {
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
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
      body: JSON.stringify({ username: this.username, password: this.password })
    });

    if (!result.ok || typeof result.data?.access_token !== "string") {
      throw new Error(`restreamer_auth_${result.status}`);
    }

    this.token = result.data.access_token;
    this.tokenExpiresAt = Date.now() + 8 * 60 * 1000;
    return this.token;
  }

  async authenticatedGet(path) {
    let token = await this.login();
    let result = await fetchJson(`${this.baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });

    if (result.status === 401) {
      this.clearToken();
      token = await this.login();
      result = await fetchJson(`${this.baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    }
    return result;
  }

  async overview() {
    if (!this.isConfigured()) {
      return { configured:false, online:false, authenticated:false, version:null, summary:summarizeChannels([]), channels:[] };
    }

    const about = await fetchJson(`${this.baseUrl}/api`).catch(() => ({ ok:false, status:0, data:null }));
    const base = {
      configured: true,
      online: Boolean(about.ok),
      authenticated: false,
      version: about.data?.version?.number || null,
      summary: summarizeChannels([]),
      channels: []
    };
    if (!about.ok) return base;

    try {
      const result = await this.authenticatedGet("/api/v3/process?filter=state,metadata");
      if (!result.ok || !Array.isArray(result.data)) return base;

      const safeProcesses = result.data.map(sanitizeProcess);
      const channels = buildChannels(safeProcesses);
      return { ...base, authenticated:true, summary:summarizeChannels(channels), channels };
    } catch {
      return base;
    }
  }
}
