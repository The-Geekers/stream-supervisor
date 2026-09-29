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
      scope: "container",
      platform: "linux",
      architecture: "x64",
      cpuCount: 4,
      loadAverage: [0.22, 0.31, 0.28],
      totalMemoryBytes: 8589934592,
      freeMemoryBytes: 6442450944,
      uptimeSeconds: 302400
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
            { id:"demo-youtube", name:"YouTube — Agora", provider:"youtube", status:"live", runtimeSeconds:9280, fps:50, bitrateKbit:6100, drop:0, dup:0 },
            { id:"demo-twitch", name:"Twitch — Agora", provider:"twitch", status:"live", runtimeSeconds:9272, fps:50, bitrateKbit:6080, drop:0, dup:0 }
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
            { id:"demo-yt2", name:"YouTube — Sommet", provider:"youtube", status:"live", runtimeSeconds:4680, fps:50, bitrateKbit:5960, drop:0, dup:0 },
            { id:"demo-fb", name:"Facebook — Sommet", provider:"facebook", status:"error", runtimeSeconds:0, fps:0, bitrateKbit:0, drop:0, dup:0 }
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
            { id:"demo-yt3", name:"YouTube — Évènement", provider:"youtube", status:"stopped", runtimeSeconds:0, fps:0, bitrateKbit:0, drop:0, dup:0 },
            { id:"demo-tw3", name:"Twitch — Évènement", provider:"twitch", status:"stopped", runtimeSeconds:0, fps:0, bitrateKbit:0, drop:0, dup:0 },
            { id:"demo-fb3", name:"Facebook — Évènement", provider:"facebook", status:"stopped", runtimeSeconds:0, fps:0, bitrateKbit:0, drop:0, dup:0 }
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
    docker: { connected: false },
    generatedAt: new Date().toISOString()
  };
}
