import test from "node:test";
import assert from "node:assert/strict";
import { buildChannels, sanitizeProcess, summarizeChannels } from "../lib/model.js";

const FAKE_STREAM_KEY = "fake1-fake2-fake3-fake4-fake5";
const FAKE_PASSWORD = "FAKE_PASSWORD_DO_NOT_USE";
const UUID = "922b8104-8474-4e3c-a6f8-818cf2bc90cf";

test("sanitizer never exposes Restreamer commands, addresses or credentials", () => {
  const raw = {
    id: `restreamer-ui:ingest:${UUID}`,
    reference: UUID,
    metadata: {"restreamer-ui": {name:"Site test - Journée", internal:{stream_key:FAKE_STREAM_KEY}}},
    state: {
      order:"start", exec:"running", runtime_seconds:123,
      last_logline:`publishing ${FAKE_STREAM_KEY}`,
      command:["-i",["http:","//","admin",":",FAKE_PASSWORD,"@","localhost:8080/input"].join(""),["rtmps:","//","example.invalid","/","live2","/",FAKE_STREAM_KEY].join("")],
      progress:{fps:50,bitrate_kbit:6000,inputs:[{type:"video",codec:"h264",width:1920,height:1080,fps:50,bitrate_kbit:5800,address:["rtmps:","//","example.invalid","/","live2","/",FAKE_STREAM_KEY].join("")}]}
    }
  };

  const safe = sanitizeProcess(raw);
  const text = JSON.stringify(safe);
  assert.equal(safe.name, "Site test - Journée");
  assert.equal(safe.metrics.fps, 50);
  assert.ok(!text.includes(FAKE_STREAM_KEY));
  assert.ok(!text.includes(FAKE_PASSWORD));
  assert.ok(!text.includes("command"));
  assert.ok(!text.includes("address"));
  assert.ok(!text.includes("last_logline"));
  assert.ok(!text.includes("stream_key"));
});

test("channel model groups egresses by Restreamer reference", () => {
  const ingest = sanitizeProcess({
    id:`restreamer-ui:ingest:${UUID}`, reference:UUID,
    metadata:{"restreamer-ui":{name:"Plateau A"}},
    state:{order:"start",exec:"running",runtime_seconds:60,progress:{fps:50,bitrate_kbit:6000,inputs:[{type:"video",codec:"h264",width:1920,height:1080,fps:50}]}}
  });
  const egress = sanitizeProcess({
    id:"restreamer-ui:egress:youtube:11111111-1111-4111-8111-111111111111", reference:UUID,
    metadata:{"restreamer-ui":{name:"YouTube journée"}},
    state:{order:"start",exec:"running",runtime_seconds:40,progress:{fps:50,bitrate_kbit:6000}}
  });

  const channels = buildChannels([ingest, egress]);
  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, "Plateau A");
  assert.equal(channels[0].status, "live");
  assert.equal(channels[0].outputs.length, 1);
  assert.equal(channels[0].outputs[0].name, "YouTube journée");
  assert.equal(channels[0].outputs[0].status, "live");
  assert.deepEqual(summarizeChannels(channels), {channels:1,live:1,waiting:0,stopped:0,outputs:1,outputsLive:1,outputErrors:0});
});
