import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProcStat,
  parseMeminfo,
  parseLoadavg,
  parseUptime,
  parseDefaultRouteInterface,
  parseNetDev
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

test("system adapter parses load, uptime and default route", () => {
  assert.deepEqual(parseLoadavg("0.25 0.50 0.75 1/123 999"), { one:0.25, five:0.5, fifteen:0.75 });
  assert.equal(parseUptime("12345.67 500.00"), 12345);
  assert.equal(
    parseDefaultRouteInterface("Iface Destination Gateway Flags RefCnt Use Metric Mask\neth0 00000000 01010101 0003 0 0 100 00000000\n"),
    "eth0"
  );
});

test("system adapter parses network counters", () => {
  const data = parseNetDev("Inter-| Receive | Transmit\n eth0: 1000 1 2 3 4 5 6 7 2000 9 10 11 12 13 14 15\n");
  assert.deepEqual(data.eth0, { rxBytes:1000, txBytes:2000 });
});
