import test from "node:test";
import assert from "node:assert/strict";
import { createSessionAuth } from "../lib/auth.js";

test("Supervisor auth stays disabled until a complete account exists", () => {
  assert.equal(createSessionAuth({username:"", password:""}).enabled, false);
  assert.equal(createSessionAuth({username:"operator", password:""}).enabled, false);
  assert.equal(createSessionAuth({technicianUsername:"tech", technicianPassword:""}).enabled, false);
});

test("admin credentials create an HttpOnly session cookie", () => {
  const auth = createSessionAuth({username:"admin", password:"correct-horse"});
  const login = auth.login("admin", "correct-horse");

  assert.equal(auth.enabled, true);
  assert.ok(login?.token);
  assert.equal(login.session.authenticated, true);
  assert.equal(login.session.role, "admin");
  assert.equal(login.session.actionsEnabled, true);

  const cookie = auth.cookie(login.token, { secure:true });
  assert.match(cookie, /ss_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);

  const session = auth.authenticate(cookie);
  assert.equal(session.authenticated, true);
  assert.equal(session.role, "admin");
});

test("technician credentials create a technician session", () => {
  const auth = createSessionAuth({
    username:"admin",
    password:"admin-pass",
    technicianUsername:"tech",
    technicianPassword:"tech-pass"
  });

  const login = auth.login("tech", "tech-pass");
  assert.equal(login.session.authenticated, true);
  assert.equal(login.session.role, "technician");
  assert.equal(login.session.actionsEnabled, true);
});

test("invalid credentials never create a session", () => {
  const auth = createSessionAuth({username:"admin", password:"admin-pass"});
  assert.equal(auth.login("admin", "wrong-pass"), null);
  assert.equal(auth.login("unknown", "admin-pass"), null);
});

test("logout invalidates the server-side session", () => {
  const auth = createSessionAuth({username:"admin", password:"admin-pass"});
  const login = auth.login("admin", "admin-pass");
  const cookie = auth.cookie(login.token);

  assert.equal(auth.authenticate(cookie).authenticated, true);
  assert.equal(auth.logout(cookie), true);
  assert.equal(auth.authenticate(cookie).authenticated, false);
});

test("open mode remains anonymous and read-only", () => {
  const auth = createSessionAuth({});
  const session = auth.authenticate(undefined);

  assert.equal(session.authenticated, false);
  assert.equal(session.authRequired, false);
  assert.equal(session.role, "viewer");
  assert.equal(session.actionsEnabled, false);
});
