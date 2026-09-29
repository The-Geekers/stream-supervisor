const INGEST_RE = /^restreamer-ui:ingest:([0-9a-f-]{36})$/i;
const EGRESS_RE = /^restreamer-ui:egress:([^:]+):([0-9a-f-]{36})$/i;

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanLabel(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return clean.slice(0, 120) || fallback;
}

function restreamerMetadata(rawMetadata) {
  const metadata = rawMetadata?.["restreamer-ui"];
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata;
}

function safeMediaStream(stream) {
  if (!stream || typeof stream !== "object") return null;
  return {
    type: cleanLabel(stream.type, "unknown"),
    format: cleanLabel(stream.format, ""),
    codec: cleanLabel(stream.codec, ""),
    coder: cleanLabel(stream.coder, ""),
    fps: finiteNumber(stream.fps),
    bitrateKbit: finiteNumber(stream.bitrate_kbit),
    width: finiteNumber(stream.width),
    height: finiteNumber(stream.height),
    samplingHz: finiteNumber(stream.sampling_hz),
    channels: finiteNumber(stream.channels)
  };
}

export function sanitizeProcess(raw) {
  const id = typeof raw?.id === "string" ? raw.id : "";
  const state = raw?.state && typeof raw.state === "object" ? raw.state : {};
  const progress = state.progress && typeof state.progress === "object" ? state.progress : {};
  const metadata = restreamerMetadata(raw?.metadata);

  let kind = "other";
  let provider = "";
  let channelId = typeof raw?.reference === "string" ? raw.reference : "";

  const ingest = id.match(INGEST_RE);
  const egress = id.match(EGRESS_RE);

  if (ingest) {
    kind = "ingest";
    channelId = raw?.reference || ingest[1];
  } else if (egress) {
    kind = "egress";
    provider = cleanLabel(egress[1], "output");
    channelId = typeof raw?.reference === "string" ? raw.reference : "";
  }

  return {
    id,
    channelId,
    kind,
    provider,
    name: cleanLabel(metadata.name, ""),
    order: cleanLabel(state.order, ""),
    exec: cleanLabel(state.exec, ""),
    runtimeSeconds: finiteNumber(state.runtime_seconds),
    reconnectSeconds: finiteNumber(state.reconnect_seconds, -1),
    cpuUsage: finiteNumber(state.cpu_usage),
    memoryBytes: finiteNumber(state.memory_bytes),
    metrics: {
      fps: finiteNumber(progress.fps),
      bitrateKbit: finiteNumber(progress.bitrate_kbit),
      speed: finiteNumber(progress.speed),
      drop: finiteNumber(progress.drop),
      dup: finiteNumber(progress.dup)
    },
    inputs: Array.isArray(progress.inputs) ? progress.inputs.map(safeMediaStream).filter(Boolean) : [],
    outputs: Array.isArray(progress.outputs) ? progress.outputs.map(safeMediaStream).filter(Boolean) : []
  };
}

function classifyIngest(p) {
  if (p.order === "stop") return "stopped";
  if (p.exec === "running") return p.metrics.fps > 0 ? "live" : "connecting";
  if (p.exec === "starting") return "connecting";
  if (p.order === "start" && ["failed", "killed", "finished"].includes(p.exec)) return "waiting";
  return "idle";
}

function classifyEgress(p) {
  if (p.order === "stop") return "stopped";
  if (p.exec === "running") return "live";
  if (["starting", "finishing"].includes(p.exec)) return "connecting";
  if (p.order === "start" && ["failed", "killed", "finished"].includes(p.exec)) return "error";
  return "idle";
}

function primaryVideo(process) {
  return process.inputs.find((s) => s.type === "video")
    || process.outputs.find((s) => s.type === "video")
    || null;
}

function primaryAudio(process) {
  return process.inputs.find((s) => s.type === "audio")
    || process.outputs.find((s) => s.type === "audio")
    || null;
}

function shortId(id) {
  return typeof id === "string" && id.length >= 8 ? id.slice(0, 8) : id;
}

export function buildChannels(safeProcesses) {
  const ingests = safeProcesses.filter((p) => p.kind === "ingest" && !p.id.endsWith("_snapshot"));
  const egresses = safeProcesses.filter((p) => p.kind === "egress");
  const channels = [];

  for (const ingest of ingests) {
    const outputs = egresses
      .filter((p) => p.channelId && p.channelId === ingest.channelId)
      .map((p) => ({
        id: p.id,
        name: p.name || p.provider.toUpperCase(),
        provider: p.provider,
        status: classifyEgress(p),
        runtimeSeconds: p.runtimeSeconds,
        fps: p.metrics.fps,
        bitrateKbit: p.metrics.bitrateKbit,
        drop: p.metrics.drop,
        dup: p.metrics.dup,
        cpuUsage: p.cpuUsage,
        memoryBytes: p.memoryBytes
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const video = primaryVideo(ingest);
    const audio = primaryAudio(ingest);

    channels.push({
      id: ingest.channelId,
      name: ingest.name || "Canal sans nom",
      status: classifyIngest(ingest),
      runtimeSeconds: ingest.runtimeSeconds,
      reconnectSeconds: ingest.reconnectSeconds,
      cpuUsage: ingest.cpuUsage,
      memoryBytes: ingest.memoryBytes,
      fps: ingest.metrics.fps,
      bitrateKbit: ingest.metrics.bitrateKbit,
      drop: ingest.metrics.drop,
      dup: ingest.metrics.dup,
      video: video ? {
        codec: video.codec,
        format: video.format,
        coder: video.coder,
        width: video.width,
        height: video.height,
        fps: video.fps
      } : null,
      audio: audio ? {
        codec: audio.codec,
        format: audio.format,
        coder: audio.coder,
        samplingHz: audio.samplingHz,
        channels: audio.channels,
        bitrateKbit: audio.bitrateKbit
      } : null,
      outputs
    });
  }

  channels.sort((a, b) =>
    a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true })
  );

  return channels;
}

export function summarizeChannels(channels) {
  const outputs = channels.flatMap((c) => c.outputs);
  const channelsWithIssues = channels.filter((c) =>
    ["waiting", "connecting"].includes(c.status)
    || c.outputs.some((o) => o.status === "error")
  ).length;

  const ingestBitrateKbit = channels.reduce((sum, c) => sum + finiteNumber(c.bitrateKbit), 0);
  const egressBitrateKbit = outputs.reduce((sum, o) => sum + finiteNumber(o.bitrateKbit), 0);
  const processCpuUsage = channels.reduce((sum, c) => sum + finiteNumber(c.cpuUsage), 0)
    + outputs.reduce((sum, o) => sum + finiteNumber(o.cpuUsage), 0);
  const processMemoryBytes = channels.reduce((sum, c) => sum + finiteNumber(c.memoryBytes), 0)
    + outputs.reduce((sum, o) => sum + finiteNumber(o.memoryBytes), 0);

  return {
    channels: channels.length,
    live: channels.filter((c) => c.status === "live").length,
    waiting: channels.filter((c) => c.status === "waiting").length,
    connecting: channels.filter((c) => c.status === "connecting").length,
    stopped: channels.filter((c) => c.status === "stopped").length,
    outputs: outputs.length,
    outputsLive: outputs.filter((o) => o.status === "live").length,
    outputsStopped: outputs.filter((o) => o.status === "stopped").length,
    outputErrors: outputs.filter((o) => o.status === "error").length,
    alerts: channelsWithIssues,
    ingestBitrateKbit,
    egressBitrateKbit,
    processCpuUsage,
    processMemoryBytes
  };
}
