import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  timeout: 30000,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:18090", browserName: "chromium", trace: "retain-on-failure" },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:18090/health",
    reuseExistingServer: false,
    env: {
      HOST: "127.0.0.1", PORT: "18090", DEMO_MODE: "true",
      SUPERVISOR_USERNAME: "visual-admin", SUPERVISOR_PASSWORD: "visual-pass",
      SUPERVISOR_TECH_USERNAME: "visual-tech", SUPERVISOR_TECH_PASSWORD: "visual-tech-pass",
      USERS_FILE: "runtime/browser-tests/users.json",
      EVENTS_FILE: "runtime/browser-tests/events.jsonl",
      INCIDENT_STATE_FILE: "runtime/browser-tests/incidents.json",
      WATCHDOG_STATE_FILE: "runtime/browser-tests/watchdog.json"
    }
  }
});
