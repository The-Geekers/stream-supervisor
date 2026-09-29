import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { RestreamerAdapter } from "../lib/restreamer.js";

const OUTPUT_ID = "restreamer-ui:egress:youtube:11111111-1111-4111-8111-111111111111";

test("Restreamer output command uses JWT auth and only sends start/stop", async (t) => {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      requests.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization || "",
        body: raw
      });

      if (req.url === "/api/login" && req.method === "POST") {
        res.writeHead(200, {"Content-Type":"application/json"});
        res.end(JSON.stringify({access_token:"fake-access-token"}));
        return;
      }

      if (req.url === `/api/v3/process/${OUTPUT_ID}/command` && req.method === "PUT") {
        assert.equal(req.headers.authorization, "Bearer fake-access-token");
        assert.deepEqual(JSON.parse(raw), {command:"stop"});
        res.writeHead(200, {"Content-Type":"application/json"});
        res.end(JSON.stringify("OK"));
        return;
      }

      res.writeHead(404);
      res.end();
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const address = server.address();
  const adapter = new RestreamerAdapter({
    baseUrl: `http://127.0.0.1:${address.port}`,
    uiUrl: "",
    username: "admin",
    password: "fake-password"
  });

  assert.deepEqual(await adapter.commandOutput(OUTPUT_ID, "stop"), {ok:true, command:"stop"});
  assert.equal(requests.filter((r) => r.url === "/api/login").length, 1);
});

test("Restreamer output command rejects arbitrary process IDs and commands", async () => {
  const adapter = new RestreamerAdapter({
    baseUrl: "http://127.0.0.1:1",
    username: "admin",
    password: "fake-password"
  });

  await assert.rejects(() => adapter.commandOutput("restreamer-ui:ingest:11111111-1111-4111-8111-111111111111", "stop"), /invalid_output_id/);
  await assert.rejects(() => adapter.commandOutput(OUTPUT_ID, "restart"), /invalid_output_command/);
});
