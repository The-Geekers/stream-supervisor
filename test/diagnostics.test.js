import test from "node:test";
import assert from "node:assert/strict";
import { buildDiagnostics } from "../lib/diagnostics.js";

function statusFixture() {
  return {
    supervisor: {
      version: "0.1.0-alpha.11",
      mode: "read-only",
      uptimeSeconds: 120,
      monitoring: { sourcePollMs:1000, pollDurationMs:12 }
    },
    restreamer: {
      core: { configured:true, online:true, authenticated:true, version:"16.0.0", latencyMs:7 },
      ui: { configured:true, reachable:true, online:true, httpStatus:200, latencyMs:4 },
      summary: {
        channels:9, live:9, waiting:0, stopped:0,
        outputs:15, outputsLive:6, outputsStopped:9, outputErrors:0,
        ingestBitrateKbit:51000, egressBitrateKbit:32000
      },
      channels:[{
        id:"channel-safe",
        name:"Channel Safe",
        internalOnly:"omit-me",
        outputs:[{ id:"output-safe", internalOnly:"omit-me-too" }]
      }]
    },
    system: {
      available:true,
      cpu:{usagePercent:22.4},
      memory:{usedPercent:9},
      disk:{usedPercent:8},
      load:{one:1.2,five:1.0,fifteen:0.8},
      uptimeSeconds:5000,
      network:{interface:"ens3",rxBytesPerSecond:1000,txBytesPerSecond:2000}
    },
    docker: {
      connected:true,
      observerFresh:true,
      engineVersion:"29.8.1",
      ageMs:500,
      summary:{configured:2,running:2,stopped:0,unhealthy:0},
      containers:[{
        name:"restreamer",
        image:"datarhei/restreamer:latest",
        state:"running",
        health:"healthy",
        uptimeSeconds:5000,
        cpuCores:1.25,
        memory:{usageBytes:123456},
        internalOnly:"omit-me-three"
      }]
    },
    incidents:{summary:{active:0,critical:0,warning:0}}
  };
}

test("buildDiagnostics returns an allow-listed healthy report", () => {
  const report = buildDiagnostics(statusFixture(), {
    journalPersistent:true,
    events:[{
      timestamp:"2026-09-29T22:00:00.000Z",
      kind:"operator_action",
      severity:"info",
      source:"restreamer-egress",
      title:"Destination démarrée",
      detail:"Channel Safe · YouTube",
      actor:"technician",
      internalOnly:"omit-me-four"
    }]
  });

  assert.equal(report.overall, "ok");
  assert.equal(report.streaming.channels, 9);
  assert.equal(report.docker.containers[0].cpuCores, 1.25);
  assert.equal(report.security.rawEnginePayloadIncluded, false);
  assert.equal(report.security.streamAddressesIncluded, false);
  assert.equal(report.security.streamKeysIncluded, false);
  assert.equal(report.security.credentialsIncluded, false);
  assert.equal(report.security.jwtIncluded, false);
  assert.equal(report.security.ffmpegCommandsIncluded, false);
  assert.equal(report.security.environmentIncluded, false);
  assert.equal(report.security.rawLogsIncluded, false);

  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("omit-me"), false);
});

test("buildDiagnostics gives Web UI warning without escalating healthy Core", () => {
  const status = statusFixture();
  status.restreamer.ui.online = false;
  status.restreamer.ui.reachable = true;
  status.restreamer.ui.httpStatus = 404;

  const report = buildDiagnostics(status, { journalPersistent:true });
  const core = report.checks.find((item) => item.id === "restreamer-core");
  const ui = report.checks.find((item) => item.id === "restreamer-web-ui");

  assert.equal(core.status, "ok");
  assert.equal(ui.status, "warning");
  assert.equal(report.overall, "warning");
  assert.match(ui.advice, /ne pas redémarrer Core/i);
});

test("buildDiagnostics marks Core outage critical", () => {
  const status = statusFixture();
  status.restreamer.core.online = false;
  status.restreamer.core.authenticated = false;

  const report = buildDiagnostics(status, { journalPersistent:true });
  assert.equal(report.overall, "critical");
  assert.equal(
    report.checks.find((item) => item.id === "restreamer-core").status,
    "critical"
  );
});
