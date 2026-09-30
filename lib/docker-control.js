const DEFAULT_TIMEOUT_MS = 25000;

function configured(value) {
  return typeof value === "string" && /^https?:\/\//.test(value.trim());
}

export class DockerControlAdapter {
  constructor({ baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
    this.timeoutMs = Math.max(1000, Math.min(60000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  }

  isConfigured() {
    return configured(this.baseUrl);
  }

  async restartRestreamer() {
    if (!this.isConfigured()) throw new Error("docker_control_not_configured");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/v1/restart-restreamer`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Supervisor-Control": "restart-restreamer"
        }
      });

      let data = null;
      try { data = await response.json(); } catch {}

      if (!response.ok || data?.status !== "restarted" || data?.container !== "restreamer") {
        const code = typeof data?.code === "string" ? data.code : `http_${response.status}`;
        throw new Error(`docker_control_${code}`);
      }

      return { restarted:true, container:"restreamer" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
