import { readFile, statfs } from "node:fs/promises";

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseKeyValueLines(text) {
  const out = {};
  for (const line of String(text || "").split("\n")) {
    const match = line.match(/^([^:]+):\s*([0-9.]+)/);
    if (!match) continue;
    out[match[1].trim()] = Number(match[2]);
  }
  return out;
}

export function parseProcStat(text) {
  const line = String(text || "").split("\n").find((row) => row.startsWith("cpu "));
  if (!line) return null;

  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) return null;

  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((sum, n) => sum + n, 0);
  return { idle, total };
}

export function parseMeminfo(text) {
  const values = parseKeyValueLines(text);
  const totalBytes = finiteNumber(values.MemTotal) * 1024;
  const availableBytes = finiteNumber(values.MemAvailable ?? values.MemFree) * 1024;
  return {
    totalBytes,
    availableBytes,
    usedBytes: Math.max(0, totalBytes - availableBytes),
    usedPercent: totalBytes > 0 ? ((totalBytes - availableBytes) / totalBytes) * 100 : 0
  };
}

export function parseLoadavg(text) {
  const [one, five, fifteen] = String(text || "").trim().split(/\s+/).map(Number);
  return {
    one: finiteNumber(one),
    five: finiteNumber(five),
    fifteen: finiteNumber(fifteen)
  };
}

export function parseUptime(text) {
  const value = Number(String(text || "").trim().split(/\s+/)[0]);
  return Number.isFinite(value) ? Math.floor(value) : 0;
}

export function parseDefaultRouteInterface(text) {
  for (const line of String(text || "").split("\n").slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 4) continue;
    const [iface, destination, , flags] = cols;
    if (destination === "00000000" && (parseInt(flags, 16) & 0x2)) return iface;
  }
  return null;
}

export function parseNetDev(text) {
  const interfaces = {};
  for (const line of String(text || "").split("\n")) {
    if (!line.includes(":")) continue;
    const [left, right] = line.split(":", 2);
    const iface = left.trim();
    const cols = right.trim().split(/\s+/).map(Number);
    if (!iface || cols.length < 16) continue;
    interfaces[iface] = {
      rxBytes: finiteNumber(cols[0]),
      txBytes: finiteNumber(cols[8])
    };
  }
  return interfaces;
}

function percent(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

export class SystemAdapter {
  constructor({ procRoot = "/host/proc", diskPath = "/host/disk" } = {}) {
    this.procRoot = procRoot.replace(/\/$/, "");
    this.diskPath = diskPath;
    this.previousCpu = null;
    this.previousNetwork = null;
  }

  async read(name) {
    return readFile(`${this.procRoot}/${name}`, "utf8");
  }

  cpuUsage(current) {
    if (!current || !this.previousCpu) {
      this.previousCpu = current;
      return null;
    }

    const totalDelta = current.total - this.previousCpu.total;
    const idleDelta = current.idle - this.previousCpu.idle;
    this.previousCpu = current;

    if (totalDelta <= 0) return null;
    return Math.max(0, Math.min(100, percent(totalDelta - idleDelta, totalDelta)));
  }

  networkRates(iface, current, nowMs) {
    if (!iface || !current) {
      this.previousNetwork = null;
      return { rxBytesPerSecond: 0, txBytesPerSecond: 0 };
    }

    const previous = this.previousNetwork;
    this.previousNetwork = { iface, ...current, at: nowMs };

    if (!previous || previous.iface !== iface) {
      return { rxBytesPerSecond: 0, txBytesPerSecond: 0 };
    }

    const seconds = (nowMs - previous.at) / 1000;
    if (seconds <= 0) return { rxBytesPerSecond: 0, txBytesPerSecond: 0 };

    return {
      rxBytesPerSecond: Math.max(0, (current.rxBytes - previous.rxBytes) / seconds),
      txBytesPerSecond: Math.max(0, (current.txBytes - previous.txBytes) / seconds)
    };
  }

  async snapshot() {
    try {
      const [statText, memText, loadText, uptimeText, routeText, netText, disk] = await Promise.all([
        this.read("stat"),
        this.read("meminfo"),
        this.read("loadavg"),
        this.read("uptime"),
        this.read("net/route"),
        this.read("net/dev"),
        statfs(this.diskPath)
      ]);

      const cpu = parseProcStat(statText);
      const memory = parseMeminfo(memText);
      const load = parseLoadavg(loadText);
      const uptimeSeconds = parseUptime(uptimeText);
      const routeInterface = parseDefaultRouteInterface(routeText);
      const interfaces = parseNetDev(netText);
      const fallbackInterface = Object.keys(interfaces)
        .filter((name) => name !== "lo")
        .sort((a, b) => {
          const av = interfaces[a].rxBytes + interfaces[a].txBytes;
          const bv = interfaces[b].rxBytes + interfaces[b].txBytes;
          return bv - av;
        })[0] || null;
      const networkInterface = routeInterface && interfaces[routeInterface]
        ? routeInterface
        : fallbackInterface;
      const currentNetwork = networkInterface ? interfaces[networkInterface] : null;
      const rates = this.networkRates(networkInterface, currentNetwork, Date.now());

      const diskTotalBytes = Number(disk.blocks) * Number(disk.bsize);
      const diskAvailableBytes = Number(disk.bavail) * Number(disk.bsize);
      const diskUsedBytes = Math.max(0, diskTotalBytes - diskAvailableBytes);

      return {
        available: true,
        scope: "host",
        cpu: {
          usagePercent: this.cpuUsage(cpu)
        },
        memory,
        load,
        uptimeSeconds,
        disk: {
          path: "/",
          totalBytes: diskTotalBytes,
          usedBytes: diskUsedBytes,
          availableBytes: diskAvailableBytes,
          usedPercent: diskTotalBytes > 0 ? percent(diskUsedBytes, diskTotalBytes) : 0
        },
        network: {
          interface: networkInterface,
          rxBytes: currentNetwork?.rxBytes || 0,
          txBytes: currentNetwork?.txBytes || 0,
          ...rates
        }
      };
    } catch {
      return {
        available: false,
        scope: "host",
        cpu: { usagePercent: null },
        memory: { totalBytes: 0, availableBytes: 0, usedBytes: 0, usedPercent: 0 },
        load: { one: 0, five: 0, fifteen: 0 },
        uptimeSeconds: 0,
        disk: { path: "/", totalBytes: 0, usedBytes: 0, availableBytes: 0, usedPercent: 0 },
        network: { interface: null, rxBytes: 0, txBytes: 0, rxBytesPerSecond: 0, txBytesPerSecond: 0 }
      };
    }
  }
}
