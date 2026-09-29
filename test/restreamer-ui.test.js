import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { RestreamerAdapter } from "../lib/restreamer.js";

test("Restreamer Web UI probe uses /ui/ on the Core HTTP listener", async (t) => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url);

    if (req.url === "/api") {
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({app:"datarhei-core",version:{number:"16.0.0"}}));
      return;
    }
    if (req.url === "/ui/") {
      res.writeHead(200, {"Content-Type":"text/html"});
      res.end("<!doctype html><title>Restreamer</title>");
      return;
    }
    if (req.url === "/api/login" && req.method === "POST") {
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({access_token:"fake-access-token"}));
      return;
    }
    if (req.url === "/api/v3/process?filter=state,metadata") {
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end("[]");
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const address = server.address();
  const adapter = new RestreamerAdapter({
    baseUrl: `http://127.0.0.1:${address.port}`,
    username: "admin",
    password: "fake-password"
  });

  const status = await adapter.overview();
  assert.equal(status.core.online, true);
  assert.equal(status.ui.online, true);
  assert.ok(seen.includes("/ui/"));
});
