function ms(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value, max = 240) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function bounds(from, to, nowMs = Date.now()) {
  const end = ms(to) ?? nowMs;
  const start = ms(from) ?? Math.max(0, end - 24 * 60 * 60 * 1000);
  if (start >= end) throw new Error("invalid_history_range");
  if (end - start > 31 * 24 * 60 * 60 * 1000) throw new Error("history_range_too_large");
  return { start, end };
}

function row(open, endAt, periodEnd) {
  const startMs = ms(open.timestamp);
  if (startMs === null) return null;
  const endMs = endAt ? ms(endAt) : periodEnd;
  if (endMs === null || endMs < startMs) return null;

  return {
    incidentId: text(open.incidentId, 180),
    severity: ["info","warning","critical"].includes(open.severity) ? open.severity : "info",
    source: text(open.source, 80),
    title: text(open.title || "Incident", 160),
    detail: text(open.detail, 240),
    channel: text(open.channel, 120),
    output: text(open.output, 120),
    startedAt: new Date(startMs).toISOString(),
    endedAt: endAt ? new Date(endMs).toISOString() : null,
    active: !endAt,
    durationMs: Math.max(0, endMs - startMs)
  };
}

export function buildIncidentHistory({
  events = [],
  active = [],
  from,
  to,
  nowMs = Date.now(),
  limit = 100
} = {}) {
  const { start, end } = bounds(from, to, nowMs);
  const ordered = [...events]
    .filter((item) => item?.incidentId && ["incident_open","incident_resolved"].includes(item?.kind))
    .sort((a, b) => (ms(a.timestamp) ?? 0) - (ms(b.timestamp) ?? 0));

  const opened = new Map();
  const completed = [];

  for (const event of ordered) {
    if (event.kind === "incident_open") {
      opened.set(event.incidentId, event);
      continue;
    }

    const current = opened.get(event.incidentId);
    if (!current) continue;
    const item = row(current, event.timestamp, end);
    if (item) completed.push(item);
    opened.delete(event.incidentId);
  }

  const activeById = new Map(
    (Array.isArray(active) ? active : [])
      .filter((item) => item?.id)
      .map((item) => [item.id, item])
  );

  const activeRows = [];
  for (const [incidentId, incident] of activeById.entries()) {
    const matchingOpen = opened.get(incidentId);
    const syntheticOpen = matchingOpen || {
      incidentId,
      timestamp: incident.openedAt,
      severity: incident.severity,
      source: incident.source,
      title: incident.title,
      detail: incident.detail,
      channel: incident.channel,
      output: incident.output
    };
    const item = row(syntheticOpen, null, end);
    if (item) activeRows.push(item);
  }

  const overlaps = [...completed, ...activeRows]
    .filter((item) => {
      const itemStart = ms(item.startedAt);
      const itemEnd = item.endedAt ? ms(item.endedAt) : end;
      return itemStart !== null && itemEnd !== null && itemEnd > start && itemStart < end;
    })
    .map((item) => {
      const itemStart = ms(item.startedAt);
      const itemEnd = item.endedAt ? ms(item.endedAt) : end;
      const clippedMs = Math.max(0, Math.min(itemEnd, end) - Math.max(itemStart, start));
      return { ...item, periodDurationMs: clippedMs };
    })
    .sort((a, b) => (ms(b.startedAt) ?? 0) - (ms(a.startedAt) ?? 0));

  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const cumulativeMs = overlaps.reduce((sum, item) => sum + item.periodDurationMs, 0);
  const longestMs = overlaps.reduce((longest, item) => Math.max(longest, item.periodDurationMs), 0);

  return {
    period: {
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString()
    },
    summary: {
      incidents: overlaps.length,
      resolved: overlaps.filter((item) => !item.active).length,
      active: overlaps.filter((item) => item.active).length,
      cumulativeMs,
      longestMs
    },
    incidents: overlaps.slice(0, safeLimit)
  };
}
