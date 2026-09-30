function ms(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value, max = 240) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function bounds(from, to, nowMs = Date.now()) {
  const end = ms(to) ?? nowMs;
  const start = ms(from) ?? Math.max(0, end - 60 * 60 * 1000);
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

function clippedInterval(item, start, end) {
  const itemStart = ms(item.startedAt);
  const itemEnd = item.endedAt ? ms(item.endedAt) : end;
  if (itemStart === null || itemEnd === null || itemEnd <= start || itemStart >= end) return null;
  const clippedStartMs = Math.max(itemStart, start);
  const clippedEndMs = Math.min(itemEnd, end);
  if (clippedEndMs <= clippedStartMs) return null;
  return {
    ...item,
    periodDurationMs: clippedEndMs - clippedStartMs,
    _startMs: clippedStartMs,
    _endMs: clippedEndMs
  };
}

function unionDuration(items = []) {
  const intervals = items
    .map((item) => [item._startMs, item._endMs])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);

  if (!intervals.length) return 0;

  let total = 0;
  let [currentStart, currentEnd] = intervals[0];
  for (const [start, end] of intervals.slice(1)) {
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
      continue;
    }
    total += currentEnd - currentStart;
    currentStart = start;
    currentEnd = end;
  }
  return total + (currentEnd - currentStart);
}

function classifyOperatorRows(rows = []) {
  const ingests = rows.filter((item) => item.source === "restreamer-ingest" && item.channel);
  const childCounts = new Map();
  const secondary = new Set();

  for (const item of rows) {
    if (item.source !== "restreamer-egress" || !item.channel) continue;

    const parent = ingests.find((ingest) =>
      ingest.channel === item.channel &&
      ingest._startMs <= item._startMs &&
      ingest._endMs >= item._endMs
    );

    if (!parent) continue;
    secondary.add(item);
    childCounts.set(parent, (childCounts.get(parent) || 0) + 1);
  }

  const primary = rows
    .filter((item) => !secondary.has(item))
    .map((item) => ({
      ...item,
      groupedDownstream: childCounts.get(item) || 0
    }));

  return {
    primary,
    secondaryCount: secondary.size
  };
}

function publicRow(item) {
  const {
    _startMs,
    _endMs,
    ...safe
  } = item;
  return safe;
}

export function buildIncidentHistory({
  events = [],
  active = [],
  from,
  to,
  nowMs = Date.now(),
  limit = 20
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

  const rawRows = [...completed, ...activeRows]
    .map((item) => clippedInterval(item, start, end))
    .filter(Boolean);

  const affectedMs = unionDuration(rawRows);
  const { primary, secondaryCount } = classifyOperatorRows(rawRows);
  const orderedPrimary = primary.sort((a, b) => b._startMs - a._startMs);

  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const longestMs = orderedPrimary.reduce(
    (longest, item) => Math.max(longest, item.periodDurationMs),
    0
  );

  return {
    period: {
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString()
    },
    summary: {
      incidents: orderedPrimary.length,
      resolved: orderedPrimary.filter((item) => !item.active).length,
      active: orderedPrimary.filter((item) => item.active).length,
      affectedMs,
      longestMs,
      groupedDownstream: secondaryCount,
      rawIncidents: rawRows.length,
      displayed: Math.min(orderedPrimary.length, safeLimit)
    },
    incidents: orderedPrimary.slice(0, safeLimit).map(publicRow)
  };
}
