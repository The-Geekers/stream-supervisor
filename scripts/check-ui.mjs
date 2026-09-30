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
  "appShell","mobileView","desktopThemeToggle","mobileThemeToggle","loginThemeToggle",
  "viewChannels","viewSystem","pageTitle","dockerEngine","dockerRunning",
  "dockerUnhealthy","dockerAge","dockerContainers","dockerDot","modeBadge","authBadge",
  "viewIncidents","incidentActiveCount","incidentCriticalCount","incidentWarningCount",
  "journalStorage","incidentActive","incidentEvents",
  "viewDiagnostics","diagOverall","diagCheckCount","diagStreaming","diagGenerated",
  "diagnosticChecks","downloadDiagnostics",
  "viewWatchdog","watchdogMode","watchdogRecovery","watchdogCandidatesCount",
  "watchdogGlobalRestart","watchdogThreshold","watchdogVerify","watchdogCooldown",
  "watchdogMaxAttempts","watchdogWindow","watchdogCandidates",
  "loginGate","loginForm","loginUsername","loginPassword","loginSubmit","loginError",
  "logoutButton","appModal","modalTitle","modalMessage","modalDetail","modalCancel","modalConfirm",
  "viewDiagnostics","diagOverall","diagCheckCount","diagStreaming","diagGenerated",
  "diagnosticChecks","downloadDiagnostics"
];

for (const id of requiredIds) {
  const count = (html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length;
  if (count !== 1) {
    console.error(`UI CHECK FAILED: #${id} occurs ${count} times`);
    process.exit(1);
  }
}

if (!html.includes('stream-supervisor-theme') || !html.includes('<html lang="fr" data-theme="light">')) {
  console.error("UI CHECK FAILED: light default theme wiring is missing");
  process.exit(1);
}
if (!html.includes("--live:#39e56f") || !html.includes(".channel-name{font-size:13px")) {
  console.error("UI CHECK FAILED: alpha.17 channel/LIVE polish is missing");
  process.exit(1);
}
if (!html.includes("/api/restreamer/output-command")) {
  console.error("UI CHECK FAILED: output command endpoint wiring is missing");
  process.exit(1);
}
if (!html.includes("/api/incidents?limit=100")) {
  console.error("UI CHECK FAILED: incidents endpoint wiring is missing");
  process.exit(1);
}
if (!html.includes('data-view="incidents"')) {
  console.error("UI CHECK FAILED: incidents navigation is missing");
  process.exit(1);
}
if (!html.includes("/api/diagnostics")) {
  console.error("UI CHECK FAILED: diagnostics endpoint wiring is missing");
  process.exit(1);
}
if (!html.includes('data-view="diagnostics"')) {
  console.error("UI CHECK FAILED: diagnostics navigation is missing");
  process.exit(1);
}

if (html.includes("item.cpuPercent")) {
  console.error("UI CHECK FAILED: Docker CPU percent leaked into operator UI");
  process.exit(1);
}
if (!html.includes("item.cpuCores")) {
  console.error("UI CHECK FAILED: Docker CPU core-equivalent rendering is missing");
  process.exit(1);
}

console.log("UI check: PASS");

if (!html.includes("/api/diagnostics")) throw new Error("diagnostics API wiring missing");
if (!html.includes('data-view="diagnostics"')) throw new Error("diagnostics navigation missing");

if (!html.includes("/api/watchdog")) throw new Error("watchdog API wiring missing");
if (!html.includes('data-view="watchdog"')) throw new Error("watchdog navigation missing");

if (html.includes("window.confirm(")) throw new Error("native confirmation popup still present");
if (html.includes("window.alert(")) throw new Error("native alert popup still present");
if (!html.includes("/api/login")) throw new Error("session login wiring missing");
if (!html.includes("/api/logout")) throw new Error("session logout wiring missing");
