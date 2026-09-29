import test from "node:test";
import assert from "node:assert/strict";
import { createBasicAuth } from "../lib/auth.js";

test("Supervisor auth stays disabled until both credentials exist", () => {
  assert.equal(createBasicAuth({username:"", password:""}).enabled, false);
  assert.equal(createBasicAuth({username:"operator", password:""}).enabled, false);
});

test("Supervisor Basic auth accepts only the configured pair", () => {
  const auth = createBasicAuth({username:"operator", password:"correct-horse"});
  const good = "Basic " + Buffer.from("operator:correct-horse").toString("base64");
  const bad = "Basic " + Buffer.from("operator:wrong").toString("base64");

  assert.equal(auth.enabled, true);
  assert.equal(auth.isAuthorized(good), true);
  assert.equal(auth.isAuthorized(bad), false);
  assert.equal(auth.isAuthorized(undefined), false);
});
