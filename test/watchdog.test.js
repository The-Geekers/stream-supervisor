import test from "node:test";
import assert from "node:assert/strict";
import { Watchdog } from "../lib/watchdog.js";

function statusFixture({ channelStatus = "live", outputStatus = "error" } = {}) {
  const outputId = "restreamer-ui:egress:youtube:11111111-1111-1111-1111-111111111111";
  const status = {
    restreamer: {
      core: { online:true, authenticated:true },
      channels:[{
        id:"channel-1",
        name:"Channel Test",
        status:channelStatus,
        outputs:[{
          id:outputId,
          name:"YouTube Test",
          provider:"youtube",
          status:outputStatus
        }]
      }]
    },
    incidents:{
      active: outputStatus === "error"
        ? [{ id:`output:${outputId}:error` }]
        : [],
      summary:{ active:outputStatus === "error" ? 1 : 0, critical:outputStatus === "error" ? 1 : 0, warning:0 }
    }
  };
  return { status, outputId };
}

function fakeJournal() {
  return {
    events:[],
    async append(event) {
      this.events.push(event);
      return event;
    }
  };
}

test("observe mode never executes a recovery command", async () => {
  const { status, outputId } = statusFixture();
  const journal = fakeJournal();
  const calls = [];
  const watchdog = new Watchdog({
    journal,
    restreamer:{ async commandOutput(...args) { calls.push(args); } },
    mode:"observe",
    outputRecoveryEnabled:false,
    errorThresholdMs:5000
  });

  await watchdog.evaluate(status);
  watchdog.firstSeen.set(outputId, Date.now() - 6000);
  const snapshot = await watchdog.evaluate(status);

  assert.equal(calls.length, 0);
  assert.equal(snapshot.mode, "observe");
  assert.equal(snapshot.globalRestartEnabled, false);
  assert.equal(snapshot.coreReloadEnabled, false);
  assert.equal(snapshot.candidates[0].state, "eligible");
  assert.equal(snapshot.candidates[0].nextAction, "observe-only");
  assert.equal(journal.events.filter((event) => event.kind === "watchdog_candidate").length, 1);
});

test("recover mode performs one targeted start and verifies LIVE recovery", async () => {
  const { status, outputId } = statusFixture();
  const journal = fakeJournal();
  const calls = [];
  const watchdog = new Watchdog({
    journal,
    restreamer:{ async commandOutput(...args) { calls.push(args); } },
    mode:"recover",
    outputRecoveryEnabled:true,
    errorThresholdMs:5000,
    verifyAfterMs:5000,
    maxAttempts:1
  });

  await watchdog.evaluate(status);
  watchdog.firstSeen.set(outputId, Date.now() - 6000);
  let snapshot = await watchdog.evaluate(status);

  assert.deepEqual(calls, [[outputId, "start"]]);
  assert.equal(snapshot.pending, 1);

  status.restreamer.channels[0].outputs[0].status = "live";
  status.incidents.active = [];
  status.incidents.summary = { active:0, critical:0, warning:0 };
  snapshot = await watchdog.evaluate(status);

  assert.equal(snapshot.pending, 0);
  assert.equal(journal.events.some((event) => event.kind === "watchdog_action"), true);
  assert.equal(
    journal.events.some((event) => event.kind === "watchdog_result" && event.status === "success"),
    true
  );
});

test("watchdog never recovers an output when ingest is not LIVE", async () => {
  const { status } = statusFixture({ channelStatus:"waiting" });
  const calls = [];
  const watchdog = new Watchdog({
    journal:fakeJournal(),
    restreamer:{ async commandOutput(...args) { calls.push(args); } },
    mode:"recover",
    outputRecoveryEnabled:true,
    errorThresholdMs:5000
  });

  const snapshot = await watchdog.evaluate(status);
  assert.equal(snapshot.candidates.length, 0);
  assert.equal(calls.length, 0);
});

test("watchdog refuses recovery when Core authentication is unavailable", async () => {
  const { status } = statusFixture();
  status.restreamer.core.authenticated = false;
  const calls = [];
  const watchdog = new Watchdog({
    journal:fakeJournal(),
    restreamer:{ async commandOutput(...args) { calls.push(args); } },
    mode:"recover",
    outputRecoveryEnabled:true,
    errorThresholdMs:5000
  });

  const snapshot = await watchdog.evaluate(status);
  assert.equal(snapshot.candidates.length, 0);
  assert.equal(calls.length, 0);
});


test("watchdog exposes incident hold while targeted recovery is being verified", async () => {
  const { status, outputId } = statusFixture();
  const watchdog = new Watchdog({
    journal:fakeJournal(),
    restreamer:{ async commandOutput() {} },
    mode:"recover",
    outputRecoveryEnabled:true,
    errorThresholdMs:5000,
    verifyAfterMs:5000,
    maxAttempts:1
  });

  await watchdog.evaluate(status);
  watchdog.firstSeen.set(outputId, Date.now() - 6000);
  await watchdog.evaluate(status);

  assert.deepEqual(
    [...watchdog.incidentHolds()],
    [`output:${outputId}:error`]
  );

  status.restreamer.channels[0].outputs[0].status = "live";
  status.incidents.active = [];
  status.incidents.summary = { active:0, critical:0, warning:0 };
  await watchdog.evaluate(status);

  assert.deepEqual([...watchdog.incidentHolds()], []);
});
