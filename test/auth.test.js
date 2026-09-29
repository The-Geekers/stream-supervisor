import test from "node:test";
import assert from "node:assert/strict";
import { createBasicAuth } from "../lib/auth.js";

function basic(username, password) {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

test("Supervisor auth stays disabled until a complete account exists", () => {
  assert.equal(createBasicAuth({username:"", password:""}).enabled, false);
  assert.equal(createBasicAuth({username:"operator", password:""}).enabled, false);
  assert.equal(createBasicAuth({technicianUsername:"tech", technicianPassword:""}).enabled, false);
});

test("historical Supervisor credentials map to the admin role", () => {
  const auth = createBasicAuth({username:"admin", password:"correct-horse"});
  const session = auth.authenticate(basic("admin","correct-horse"));

  assert.equal(auth.enabled, true);
  assert.equal(session.authenticated, true);
  assert.equal(session.role, "admin");
  assert.equal(session.actionsEnabled, true);
  assert.equal(auth.isAuthorized(basic("admin","wrong")), false);
});

test("Technician credentials are accepted with the technician role", () => {
  const auth = createBasicAuth({
    username:"admin",
    password:"admin-pass",
    technicianUsername:"tech",
    technicianPassword:"tech-pass"
  });

  const session = auth.authenticate(basic("tech","tech-pass"));
  assert.equal(session.authenticated, true);
  assert.equal(session.role, "technician");
  assert.equal(session.actionsEnabled, true);
});

test("open mode remains anonymous and read-only", () => {
  const auth = createBasicAuth({});
  const session = auth.authenticate(undefined);

  assert.equal(auth.isAuthorized(undefined), true);
  assert.equal(session.authenticated, false);
  assert.equal(session.role, "viewer");
  assert.equal(session.actionsEnabled, false);
});
