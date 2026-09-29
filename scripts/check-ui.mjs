import { readFileSync } from "node:fs";

const html = readFileSync("public/index.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
if (scripts.length !== 1) {
  console.error(`UI CHECK FAILED: expected 1 inline script, found ${scripts.length}`);
  process.exit(1);
}

try {
  new Function(scripts[0][1]);
} catch (error) {
  console.error("UI CHECK FAILED: JavaScript syntax error");
  console.error(error.message);
  process.exit(1);
}

const requiredIds = [
  "viewChannels","viewSystem","pageTitle","dockerEngine","dockerRunning",
  "dockerUnhealthy","dockerAge","dockerContainers","dockerDot"
];

for (const id of requiredIds) {
  const count = (html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length;
  if (count !== 1) {
    console.error(`UI CHECK FAILED: #${id} occurs ${count} times`);
    process.exit(1);
  }
}

console.log("UI check: PASS");
