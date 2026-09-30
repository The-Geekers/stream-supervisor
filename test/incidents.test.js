import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  deriveIncidentCandidates,
  EventJournal,
  IncidentTracker,
  normalizeJournalEvent
} from "../lib/incidents.js";

function healthyStatus() {
  return {
    restreamer: {
      core: { configured:true, online:true, authenticated:true },
      ui: { configured:true, reachable:true, online:true, httpStatus:200 },
      channels: []
    },
    docker: {
      connected:true,
      observerFresh:true,
      containers:[]
    }
  };
}

test("deriveIncidentCandidates identifies a Core outage", () => {
  const status = healthyStatus();
  status.restreamer.core.online = false;
  status.restreamer.core.authenticated = false;

  const incidents = deriveIncidentCandidates(status);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].id, "restreamer:core:offline");
  assert.equal(incidents[0].severity, "critical");
});

test("journal allow-list drops unknown and sensitive-looking fields", () => {
  const event = normalizeJournalEvent({
    kind:"operator_action",
    severity:"info",
    title:"Safe",
    detail:"Allowed",
    token:"secret-token",
    address:"rtmp://example.invalid/live/secret",
    command:"ffmpeg -i secret"
  });

  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes("secret-token"), false);
  assert.equal(serialized.includes("rtmp://"), false);
  assert.equal(serialized.includes("ffmpeg"), false);
  assert.deepEqual(
    Object.keys(event),
    ["id","timestamp","kind","severity","source","title","detail","incidentId","channel","output","actor","action","status"]
  );
});

test("IncidentTracker persists opens and resolutions without raw payloads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stream-supervisor-incidents-"));
  try {
    const journal = new EventJournal({ filePath:join(dir, "events.jsonl") });
    await journal.init();
    const tracker = new IncidentTracker({
      journal,
      stateFile:join(dir, "incidents-state.json")
    });
    await tracker.init();

    const down = healthyStatus();
    down.restreamer.core.online = false;
    down.restreamer.core.authenticated = false;
    let snapshot = await tracker.update(down);
    assert.equal(snapshot.summary.active, 1);
    assert.equal(snapshot.summary.critical, 1);
    assert.equal(journal.list(10)[0].kind, "incident_open");

    snapshot = await tracker.update(healthyStatus());
    assert.equal(snapshot.summary.active, 0);
    assert.equal(journal.list(10)[0].kind, "incident_resolved");

    const trackerAfterRestart = new IncidentTracker({
      journal,
      stateFile:join(dir, "incidents-state.json")
    });
    await trackerAfterRestart.init();
    assert.equal(trackerAfterRestart.snapshot().summary.active, 0);
  } finally {
    await rm(dir, { recursive:true, force:true });
  }
});

test("transient waiting ingest is debounced", async () => {
  const journal = new EventJournal({ filePath:join(tmpdir(), "non-persistent-events-" + process.pid + ".jsonl") });
  const tracker = new IncidentTracker({ journal, stateFile:join(tmpdir(), "non-persistent-state-" + process.pid + ".json") });
  const status = healthyStatus();
  status.restreamer.channels = [{
    id:"channel-demo",
    name:"Demo",
    status:"waiting",
    outputs:[]
  }];

  const snapshot = await tracker.update(status);
  assert.equal(snapshot.summary.active, 0);
});


test("active egress incident stays open while watchdog verification holds resolution", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stream-supervisor-incident-hold-"));
  try {
    const journal = new EventJournal({ filePath:join(dir, "events.jsonl") });
    await journal.init();
    const tracker = new IncidentTracker({
      journal,
      stateFile:join(dir, "incidents-state.json")
    });
    await tracker.init();

    const outputId = "restreamer-ui:egress:rtmp:11111111-1111-1111-1111-111111111111";
    const incidentId = `output:${outputId}:error`;
    const status = healthyStatus();
    status.restreamer.channels = [{
      id:"channel-demo",
      name:"Demo",
      status:"live",
      outputs:[{
        id:outputId,
        name:"RTMP Test",
        provider:"rtmp",
        status:"error"
      }]
    }];

    await tracker.update(status);
    tracker.pending.set(incidentId, Date.now() - 4000);
    let snapshot = await tracker.update(status);
    assert.equal(snapshot.summary.active, 1);

    status.restreamer.channels[0].outputs[0].status = "connecting";
    snapshot = await tracker.update(status, {
      holdResolutionIds:new Set([incidentId])
    });

    assert.equal(snapshot.summary.active, 1);
    assert.equal(
      journal.list(20).some((event) => event.kind === "incident_resolved" && event.incidentId === incidentId),
      false
    );

    snapshot = await tracker.update(status);
    assert.equal(snapshot.summary.active, 0);
    assert.equal(
      journal.list(20).some((event) => event.kind === "incident_resolved" && event.incidentId === incidentId),
      true
    );
  } finally {
    await rm(dir, { recursive:true, force:true });
  }
});
