import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DockerAdapter } from "../lib/docker.js";

test("Docker adapter only exposes the observer allow-list model", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stream-supervisor-docker-"));
  const file = join(dir, "status.json");
  const secret = "FAKE_DOCKER_SECRET";
  await writeFile(file, JSON.stringify({
    connected: true,
    observedAt: new Date().toISOString(),
    engineVersion: "27.5.1",
    dangerous: { env: ["PASSWORD=" + secret] },
    containers: [{
      id: "abcdef0123456789",
      name: "restreamer",
      image: "datarhei/restreamer:latest",
      state: "running",
      status: "Up 2 hours (healthy)",
      health: "healthy",
      uptimeSeconds: 7200,
      cpuPercent: 12.5,
      memory: { usageBytes: 123456789, limitBytes: 1000000000, usagePercent: 12.3 },
      env: ["PASSWORD=" + secret],
      command: secret,
      labels: { secret }
    }]
  }));

  const data = await new DockerAdapter({ snapshotPath:file, staleAfterMs:60000 }).snapshot();
  const text = JSON.stringify(data);

  assert.equal(data.connected, true);
  assert.equal(data.containers[0].name, "restreamer");
  assert.ok(!text.includes(secret));
  assert.ok(!text.includes('"env"'));
  assert.ok(!text.includes('"command"'));
  assert.ok(!text.includes('"labels"'));
});
