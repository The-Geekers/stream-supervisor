import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProcStat,
  parseMeminfo,
  parseLoadavg,
  parseUptime,
  parseCounter
} from "../lib/system.js";

test("system adapter parses host CPU counters", () => {
  assert.deepEqual(
    parseProcStat("cpu  100 2 30 400 20 0 0 0 0 0\ncpu0 1 2 3 4"),
    { idle: 420, total: 552 }
  );
});

test("system adapter parses memory in bytes", () => {
  const mem = parseMeminfo("MemTotal:       8000000 kB\nMemAvailable:   3000000 kB\n");
  assert.equal(mem.totalBytes, 8000000 * 1024);
  assert.equal(mem.availableBytes, 3000000 * 1024);
  assert.equal(mem.usedBytes, 5000000 * 1024);
  assert.equal(mem.usedPercent, 62.5);
});

test("system adapter parses load and uptime", () => {
  assert.deepEqual(parseLoadavg("0.25 0.50 0.75 1/123 999"), { one:0.25, five:0.5, fifteen:0.75 });
  assert.equal(parseUptime("12345.67 500.00"), 12345);
});

test("system adapter parses sysfs network counters", () => {
  assert.equal(parseCounter("123456789\n"), 123456789);
});
