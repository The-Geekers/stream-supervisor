import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createDockerControlServer } from "../docker-control/controller.js";
import { DockerControlAdapter } from "../lib/docker-control.js";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("Docker control helper only restarts the fixed running Restreamer target", async (t) => {
  const calls = [];
  const server = createDockerControlServer({
    target: "restreamer",
    dockerRequest: async (path, options) => {
      calls.push({ path, method:options?.method || "GET" });
      if (path === "/containers/restreamer/json") {
        return { status:200, raw:JSON.stringify({ State:{ Running:true } }) };
      }
      if (path === "/containers/restreamer/restart?t=10") {
        return { status:204, raw:"" };
      }
      return { status:404, raw:"" };
    }
  });
  t.after(() => server.close());
  const baseUrl = await listen(server);

  const adapter = new DockerControlAdapter({ baseUrl, timeoutMs:2000 });
  assert.deepEqual(await adapter.restartRestreamer(), { restarted:true, container:"restreamer" });
  assert.deepEqual(calls, [
    { path:"/containers/restreamer/json", method:"GET" },
    { path:"/containers/restreamer/restart?t=10", method:"POST" }
  ]);
});

test("Docker control helper refuses to restart a stopped target", async (t) => {
  let restartCalled = false;
  const server = createDockerControlServer({
    target: "restreamer",
    dockerRequest: async (path) => {
      if (path.endsWith("/json")) return { status:200, raw:JSON.stringify({ State:{ Running:false } }) };
      restartCalled = true;
      return { status:204, raw:"" };
    }
  });
  t.after(() => server.close());
  const baseUrl = await listen(server);

  const response = await fetch(`${baseUrl}/v1/restart-restreamer`, {
    method:"POST",
    headers:{ "X-Supervisor-Control":"restart-restreamer" }
  });
  assert.equal(response.status, 409);
  assert.equal(restartCalled, false);
});

test("Docker control helper rejects missing internal control header", async (t) => {
  const server = createDockerControlServer({
    dockerRequest: async () => { throw new Error("must_not_be_called"); }
  });
  t.after(() => server.close());
  const baseUrl = await listen(server);

  const response = await fetch(`${baseUrl}/v1/restart-restreamer`, { method:"POST" });
  assert.equal(response.status, 403);
});
