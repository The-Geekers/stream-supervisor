import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((path) => path !== "scripts/check-repo-secrets.mjs");

const checks = [
  ["GitHub token", /(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["credential URL", /:\/\/[^/\s:@]+:[^/\s@]+@/],
  ["YouTube live key URL", /(?:youtube\.com|youtu\.be|googlevideo\.com)[^\s"'<>]*\/live2\/[A-Za-z0-9_-]{12,}/i],
  ["non-empty RESTREAMER_PASSWORD", /^RESTREAMER_PASSWORD=.+$/m]
];

let failed = false;
for (const path of files) {
  let content;
  try { content = readFileSync(path, "utf8"); } catch { continue; }
  for (const [label, pattern] of checks) {
    if (pattern.test(content)) {
      console.error(`SECRET CHECK FAILED: ${label} pattern in ${path}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log("Secret check: PASS");
