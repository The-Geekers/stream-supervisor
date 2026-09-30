export function buildDemoStatus({ version, uptimeSeconds, authEnabled }) {
  return {
    supervisor: {
      status: "online",
      mode: "read-only",
      version,
      uptimeSeconds,
      security: { authEnabled }
    },
    system: {
      available: true,
      scope: "host",
      cpu: { usagePercent: 18.4 },
      memory: {
        totalBytes: 8589934592,
        availableBytes: 5368709120,
        usedBytes: 3221225472,
        usedPercent: 37.5
      },
      load: { one: 0.42, five: 0.35, fifteen: 0.31 },
      uptimeSeconds: 302400,
      disk: {
        path: "/",
        totalBytes: 85899345920,
        usedBytes: 32212254720,
        availableBytes: 53687091200,
        usedPercent: 37.5
      },
      network: {
        interface: "eth0",
        rxBytes: 9876543210,
        txBytes: 4567890123,
        rxBytesPerSecond: 4200000,
        txBytesPerSecond: 2500000
      }
    },
    restreamer: {
      core: { online: true, authenticated: true, version: "16.0.0", latencyMs: 8 },
      ui: { configured: true, reachable: true, online: true, httpStatus: 200, latencyMs: 11 },
      summary: {
        channels: 4,
        live: 2,
        waiting: 1,
        connecting: 0,
        stopped: 1,
        outputs: 7,
        outputsLive: 4,
        outputsStopped: 3,
        outputErrors: 1,
        alerts: 2,
        ingestBitrateKbit: 12100,
        egressBitrateKbit: 18140,
        processCpuUsage: 9.3,
        processMemoryBytes: 325058560
      },
      channels: [
        {
          id: "demo-agora",
          name: "Agora — Journée",
          status: "live",
          runtimeSeconds: 9320,
          reconnectSeconds: -1,
          cpuUsage: 4.2,
          memoryBytes: 158334976,
          fps: 50,
          bitrateKbit: 6120,
          drop: 0,
          dup: 0,
          video: { codec: "h264", width: 1920, height: 1080, fps: 50 },
          audio: { codec: "aac", samplingHz: 48000, channels: 2, bitrateKbit: 192 },
          outputs: [
            { id:"demo-youtube", name:"YouTube — Agora", provider:"youtube", status:"live", desiredState:"start", reconnectSeconds:-1, runtimeSeconds:9280, fps:50, bitrateKbit:6100, drop:0, dup:0 },
            { id:"demo-twitch", name:"Twitch — Agora", provider:"twitch", status:"live", desiredState:"start", reconnectSeconds:-1, runtimeSeconds:9272, fps:50, bitrateKbit:6080, drop:0, dup:0 }
          ]
        },
        {
          id: "demo-sommet",
          name: "Sommet — Plénière",
          status: "live",
          runtimeSeconds: 4715,
          reconnectSeconds: -1,
          cpuUsage: 5.1,
          memoryBytes: 166723584,
          fps: 50,
          bitrateKbit: 5980,
          drop: 2,
          dup: 0,
          video: { codec: "hevc", width: 1920, height: 1080, fps: 50 },
          audio: { codec: "aac", samplingHz: 48000, channels: 2, bitrateKbit: 192 },
          outputs: [
            { id:"demo-yt2", name:"YouTube — Sommet", provider:"youtube", status:"live", desiredState:"start", reconnectSeconds:-1, runtimeSeconds:4680, fps:50, bitrateKbit:5960, drop:0, dup:0 },
            { id:"demo-fb", name:"Facebook — Sommet", provider:"facebook", status:"error", desiredState:"start", reconnectSeconds:9, runtimeSeconds:0, fps:0, bitrateKbit:0, drop:0, dup:0 }
          ]
        },
        {
          id: "demo-site-b",
          name: "Site B — Évènement 16h",
          status: "waiting",
          runtimeSeconds: 0,
          reconnectSeconds: 12,
          cpuUsage: 0,
          memoryBytes: 0,
          fps: 0,
          bitrateKbit: 0,
          drop: 0,
          dup: 0,
          video: null,
          audio: null,
          outputs: [
            { id:"demo-yt3", name:"YouTube — Évènement", provider:"youtube", status:"stopped", desiredState:"stop", reconnectSeconds:-1, runtimeSeconds:0, fps:0, bitrateKbit:0, drop:0, dup:0 },
            { id:"demo-tw3", name:"Twitch — Évènement", provider:"twitch", status:"stopped", desiredState:"stop", reconnectSeconds:-1, runtimeSeconds:0, fps:0, bitrateKbit:0, drop:0, dup:0 },
            { id:"demo-fb3", name:"Facebook — Évènement", provider:"facebook", status:"stopped", desiredState:"stop", reconnectSeconds:-1, runtimeSeconds:0, fps:0, bitrateKbit:0, drop:0, dup:0 }
          ]
        },
        {
          id: "demo-backup",
          name: "Backup",
          status: "stopped",
          runtimeSeconds: 0,
          reconnectSeconds: -1,
          cpuUsage: 0,
          memoryBytes: 0,
          fps: 0,
          bitrateKbit: 0,
          drop: 0,
          dup: 0,
          video: null,
          audio: null,
          outputs: []
        }
      ]
    },
    docker: {
      connected: true,
      observerFresh: true,
      observedAt: new Date().toISOString(),
      ageMs: 250,
      engineVersion: "27.5.1",
      summary: { configured: 2, running: 2, stopped: 0, unhealthy: 0 },
      containers: [
        {
          id: "demo-restrea",
          name: "restreamer",
          image: "datarhei/restreamer:latest",
          state: "running",
          status: "Up 2 hours",
          health: null,
          createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
          uptimeSeconds: 7200,
          cpuCores: 0.171,
          memory: { usageBytes: 701497344, limitBytes: 24500000000, usagePercent: 2.9 }
        },
        {
          id: "demo-superv",
          name: "stream-supervisor",
          image: "stream-supervisor-supervisor",
          state: "running",
          status: "Up 35 minutes",
          health: null,
          createdAt: new Date(Date.now() - 2100 * 1000).toISOString(),
          uptimeSeconds: 2100,
          cpuCores: 0.006,
          memory: { usageBytes: 71270400, limitBytes: 24500000000, usagePercent: 0.3 }
        }
      ]
    },
    generatedAt: new Date().toISOString()
  };
}
