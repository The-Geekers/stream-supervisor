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

test("history pairs incidents and measures wall-clock affected time", () => {
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
  assert.equal(history.summary.affectedMs, 210000);
  assert.equal(history.summary.longestMs, 120000);
  assert.equal(history.incidents[0].incidentId, "b");
});

test("simultaneous incidents count affected wall-clock time only once", () => {
  const history = buildIncidentHistory({
    from:"2026-09-30T08:00:00.000Z",
    to:"2026-09-30T12:00:00.000Z",
    events:[
      open("a","2026-09-30T09:00:00.000Z",{channel:"Channel 1"}),
      resolved("a","2026-09-30T09:10:00.000Z"),
      open("b","2026-09-30T09:00:00.000Z",{channel:"Channel 2"}),
      resolved("b","2026-09-30T09:10:00.000Z"),
      open("c","2026-09-30T09:05:00.000Z",{channel:"Channel 3"}),
      resolved("c","2026-09-30T09:15:00.000Z")
    ]
  });

  assert.equal(history.summary.rawIncidents, 3);
  assert.equal(history.summary.incidents, 3);
  assert.equal(history.summary.affectedMs, 15 * 60 * 1000);
});

test("egress errors fully covered by an ingest loss are grouped under the ingest root cause", () => {
  const history = buildIncidentHistory({
    from:"2026-09-30T08:00:00.000Z",
    to:"2026-09-30T12:00:00.000Z",
    events:[
      open("ingest","2026-09-30T09:00:00.000Z",{
        source:"restreamer-ingest",
        title:"Signal ingest absent",
        channel:"Channel 1",
        output:""
      }),
      open("egress-1","2026-09-30T09:00:10.000Z",{channel:"Channel 1",output:"YouTube"}),
      open("egress-2","2026-09-30T09:00:12.000Z",{channel:"Channel 1",output:"Twitch"}),
      resolved("egress-1","2026-09-30T09:02:00.000Z"),
      resolved("egress-2","2026-09-30T09:02:05.000Z"),
      resolved("ingest","2026-09-30T09:02:10.000Z")
    ]
  });

  assert.equal(history.summary.rawIncidents, 3);
  assert.equal(history.summary.incidents, 1);
  assert.equal(history.summary.groupedDownstream, 2);
  assert.equal(history.summary.affectedMs, 130000);
  assert.equal(history.incidents[0].incidentId, "ingest");
  assert.equal(history.incidents[0].groupedDownstream, 2);
});

test("egress error that outlives the ingest loss remains visible as a standalone problem", () => {
  const history = buildIncidentHistory({
    from:"2026-09-30T08:00:00.000Z",
    to:"2026-09-30T12:00:00.000Z",
    events:[
      open("ingest","2026-09-30T09:00:00.000Z",{
        source:"restreamer-ingest",
        channel:"Channel 1",
        output:""
      }),
      open("egress","2026-09-30T09:00:10.000Z",{channel:"Channel 1",output:"YouTube"}),
      resolved("ingest","2026-09-30T09:01:00.000Z"),
      resolved("egress","2026-09-30T09:02:00.000Z")
    ]
  });

  assert.equal(history.summary.incidents, 2);
  assert.equal(history.summary.groupedDownstream, 0);
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
  assert.equal(history.summary.affectedMs, 180000);
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
  assert.equal(history.summary.affectedMs, 120000);
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
  assert.equal(history.summary.affectedMs, 0);
});

test("history result stays visually bounded while summary covers the full period", () => {
  const events = [];
  for (let index = 0; index < 30; index += 1) {
    const minute = String(index).padStart(2, "0");
    events.push(open(`i-${index}`,`2026-09-30T09:${minute}:00.000Z`,{channel:`Channel ${index}`}));
    events.push(resolved(`i-${index}`,`2026-09-30T09:${minute}:10.000Z`));
  }

  const history = buildIncidentHistory({
    from:"2026-09-30T09:00:00.000Z",
    to:"2026-09-30T10:00:00.000Z",
    events,
    limit:20
  });

  assert.equal(history.summary.incidents, 30);
  assert.equal(history.summary.displayed, 20);
  assert.equal(history.incidents.length, 20);
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
