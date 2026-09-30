import test from "node:test";
import assert from "node:assert/strict";
import { buildIncidentHistory } from "../lib/history.js";

const open = (id, at, extra = {}) => ({
  kind:"incident_open",
  incidentId:id,
  timestamp:at,
  severity:extra.severity || "warning",
  source:extra.source || "restreamer-egress",
  title:extra.title || "Erreur destination",
  detail:extra.detail || "Destination en erreur.",
  channel:extra.channel || "Channel 1",
  output:extra.output || "YouTube"
});

const resolved = (id, at) => ({
  kind:"incident_resolved",
  incidentId:id,
  timestamp:at,
  severity:"info",
  source:"restreamer-egress",
  title:"Résolu"
});

test("history pairs incident open/resolved and calculates cumulative duration", () => {
  const history = buildIncidentHistory({
    from:"2026-09-30T08:00:00.000Z",
    to:"2026-09-30T12:00:00.000Z",
    events:[
      open("a","2026-09-30T09:00:00.000Z"),
      resolved("a","2026-09-30T09:01:30.000Z"),
      open("b","2026-09-30T10:00:00.000Z"),
      resolved("b","2026-09-30T10:02:00.000Z")
    ]
  });

  assert.equal(history.summary.incidents, 2);
  assert.equal(history.summary.resolved, 2);
  assert.equal(history.summary.active, 0);
  assert.equal(history.summary.cumulativeMs, 210000);
  assert.equal(history.summary.longestMs, 120000);
  assert.equal(history.incidents[0].incidentId, "b");
});

test("history clips an incident duration to the requested period", () => {
  const history = buildIncidentHistory({
    from:"2026-09-30T08:00:00.000Z",
    to:"2026-09-30T10:00:00.000Z",
    events:[
      open("a","2026-09-30T07:55:00.000Z"),
      resolved("a","2026-09-30T08:03:00.000Z")
    ]
  });

  assert.equal(history.summary.incidents, 1);
  assert.equal(history.summary.cumulativeMs, 180000);
  assert.equal(history.incidents[0].durationMs, 480000);
  assert.equal(history.incidents[0].periodDurationMs, 180000);
});

test("active incident contributes time until the end of the requested period", () => {
  const history = buildIncidentHistory({
    from:"2026-09-30T08:00:00.000Z",
    to:"2026-09-30T12:00:00.000Z",
    events:[open("active-one","2026-09-30T11:58:00.000Z")],
    active:[{
      id:"active-one",
      severity:"critical",
      source:"restreamer-core",
      title:"Restreamer Core offline",
      detail:"API unavailable",
      channel:"",
      output:"",
      openedAt:"2026-09-30T11:58:00.000Z"
    }]
  });

  assert.equal(history.summary.incidents, 1);
  assert.equal(history.summary.active, 1);
  assert.equal(history.summary.cumulativeMs, 120000);
  assert.equal(history.incidents[0].active, true);
  assert.equal(history.incidents[0].endedAt, null);
});

test("history ignores operator and watchdog events", () => {
  const history = buildIncidentHistory({
    from:"2026-09-30T08:00:00.000Z",
    to:"2026-09-30T12:00:00.000Z",
    events:[
      { kind:"operator_action", incidentId:"a", timestamp:"2026-09-30T09:00:00.000Z" },
      { kind:"watchdog_action", incidentId:"a", timestamp:"2026-09-30T09:00:10.000Z" }
    ]
  });

  assert.equal(history.summary.incidents, 0);
  assert.equal(history.summary.cumulativeMs, 0);
});

test("history rejects ranges larger than 31 days", () => {
  assert.throws(
    () => buildIncidentHistory({
      from:"2026-08-01T00:00:00.000Z",
      to:"2026-09-30T00:00:00.000Z",
      events:[]
    }),
    /history_range_too_large/
  );
});
