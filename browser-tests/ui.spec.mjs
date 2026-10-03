import {totp} from "../lib/totp.js";
import { test, expect } from "@playwright/test";

const views = ["channels", "system", "incidents", "diagnostics", "watchdog"];
async function login(page, role = "admin") {
  await page.locator("#loginUsername").fill(`visual-${role}`);
  await page.locator("#loginPassword").fill(role === "admin" ? "visual-pass" : "visual-tech-pass");
  await page.getByRole("button", { name: "SIGN IN", exact: true }).click();
  await expect(page.locator("#loginGate")).not.toBeVisible();
  await expect(page.locator("#channels")).toContainText("Agora");
  await expect(page.locator("#apiDetail")).toContainText("0.2.0-alpha.5");
}
async function navigate(page, view) {
  if (await page.locator("#mobileView").isVisible()) await page.locator("#mobileView").selectOption(view);
  else await page.locator(`.nav-item[data-view="${view}"]`).click();
  await expect(page.locator(".view.active")).toHaveAttribute("id", `view${view[0].toUpperCase()}${view.slice(1)}`);
}

for (const width of [320, 390, 759, 760, 761, 1024, 1600]) {
  test(`all five views at ${width}px without horizontal overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("stream-supervisor-theme", "dark"));
    await page.goto("/");
    await login(page);
    await expect(page.getByText("SETTINGS", { exact: true })).toHaveCount(0);
    for (const view of views) {
      await navigate(page, view);
      if (view === "diagnostics") await expect(page.locator("#diagnosticChecks .diag-row").first()).toBeVisible();
      if (view === "system") await expect(page.locator("#dockerContainers .docker-row").first()).toBeVisible();
      if (view === "incidents") await expect(page.locator("#journalStorage")).not.toHaveText("--");
      if (view === "watchdog") await expect(page.locator("#watchdogMode")).not.toHaveText("--");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await expect(page.locator(`.nav-item[data-view="${view}"]`)).toHaveAttribute("aria-current", "page");
      if (width <= 760) {
        await expect(page.locator("#mobileView")).toHaveValue(view);
        expect((await page.locator("#mobileView").boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`), fullPage: true });
    }
  });
}


for (const width of [390, 1600]) {
  test(`Distillerie light theme at ${width}px keeps every view usable`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => localStorage.getItem("stream-supervisor-theme"))).toBeNull();
    const loginToggle = page.locator("#loginThemeToggle");
    await expect(loginToggle).toHaveText("DARK");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#f5f3ef");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim())).toBe("#e9471d");
    await login(page);
    const themeToggle = width <= 760 ? page.locator("#mobileThemeToggle") : page.locator("#desktopThemeToggle");
    await expect(themeToggle).toHaveText("DARK");
    for (const view of views) {
      await navigate(page, view);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`light-${view}-${width}.png`), fullPage: true });
    }
  });
}

test("first visit defaults to light and explicit theme preference persists locally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => localStorage.getItem("stream-supervisor-theme"))).toBeNull();
  await page.locator("#loginThemeToggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("stream-supervisor-theme"))).toBe("dark");
  await login(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#mobileThemeToggle")).toHaveText("LIGHT");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#07090b");
  await page.locator("#mobileThemeToggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => localStorage.getItem("stream-supervisor-theme"))).toBe("light");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#f5f3ef");
});

test("0.2 incident view defaults to a bounded one-hour operator history", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await navigate(page, "incidents");
  await expect(page.locator('.range-button[data-history-range="1h"]')).toHaveClass(/active/);
  await expect(page.locator("#historyScopeNote")).toHaveText("LAST HOUR");
  await expect(page.locator("#historyIncidentCount")).not.toHaveText("--");
  await expect(page.locator("#historyAffected")).toHaveText(/\d+[smh]/);
  await expect(page.locator("#historyGrouped")).not.toHaveText("--");
  await expect(page.locator("#incidentHistory")).toBeVisible();
  await expect(page.locator(".journal-details")).not.toHaveAttribute("open", "");
  expect(await page.locator("#incidentHistory .history-row").count()).toBeLessThanOrEqual(20);

  await page.locator('.range-button[data-history-range="today"]').click();
  await expect(page.locator('.range-button[data-history-range="today"]')).toHaveClass(/active/);
  await expect(page.locator("#historyScopeNote")).toHaveText("TODAY");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("back-to-top control appears only after scrolling and returns to page top", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await page.evaluate(() => { document.body.style.minHeight = "3000px"; });
  await expect(page.locator("#backToTop")).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(page.locator("#backToTop")).toBeVisible();
  await page.locator("#backToTop").click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
});

test("channel title and LIVE emphasis use alpha17 polish tokens", async ({ page }) => {
  await page.goto("/");
  await login(page);
  const channelName = page.locator(".channel-name").first();
  expect(await channelName.evaluate(el => getComputedStyle(el).fontSize)).toBe("13px");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--live").trim())).toBe("#2f7a50");
  const liveState = page.locator(".state.live").first();
  await expect(liveState).toBeVisible();
  expect(await liveState.evaluate(el => getComputedStyle(el).color)).not.toBe("rgb(68, 116, 91)");
});

for (const role of ["admin", "tech"]) {
  test(`${role}: modal focus, alpha14 ERROR/STOP, commands and logout/relogin`, async ({ page }) => {
    await page.goto("/");
    await login(page, role);
    if(role==="admin") await expect(page.locator("#adminRecovery")).not.toHaveAttribute("hidden", "");
    else await expect(page.locator("#adminRecovery")).toHaveAttribute("hidden", "");
    const output = page.locator('.output').filter({ hasText: "Facebook — Sommet" });
    await expect(output).toContainText("ERROR");
    await expect(output).toContainText("RETRY 9s");
    const trigger = output.getByRole("button", { name: "STOP", exact: true });
    await trigger.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#modalCancel")).toBeFocused();
    await expect(page.locator("#appShell")).toHaveAttribute("inert", "");
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#modalConfirm")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#modalCancel")).toBeFocused();
    // A real SSE update must not discard the dialog's trigger or focus restoration.
    await page.waitForTimeout(1200);
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
    await expect(trigger).toBeFocused();
    let commands = [];
    await page.route("**/api/restreamer/output-command", async route => {
      commands.push(route.request().postDataJSON());
      await route.fulfill({ json: { status: "accepted" } });
    });
    await trigger.click();
    await page.locator("#modalCancel").click();
    expect(commands).toEqual([]);
    await trigger.click();
    await page.locator("#modalConfirm").click();
    await expect.poll(() => commands.length).toBe(1);
    expect(commands[0]).toEqual({ outputId: "demo-fb", command: "stop" });
    const start = page.locator('button[data-output-id="demo-yt3"]');
    await expect(start).toBeEnabled();
    await start.click();
    await page.locator("#modalConfirm").click();
    await expect.poll(() => commands.length).toBe(2);
    expect(commands[1]).toEqual({ outputId: "demo-yt3", command: "start" });
    await navigate(page, "diagnostics");
    await expect(page.locator("#diagnosticChecks .diag-row").first()).toBeVisible();
    await page.locator("#logoutButton").click();
    await page.locator("#modalConfirm").click();
    await expect(page.locator("#loginGate")).toBeVisible();
    await expect(page.locator("#appShell")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#appShell")).toHaveAttribute("inert", "");
    await expect(page.locator("#appShell")).not.toContainText("Agora");
    await expect(page.locator("#diagnosticChecks .diag-row")).toHaveCount(0);
    await expect(page.locator("#hostCpu")).toHaveText("--");
    let backgroundRequests = 0;
    page.on("request", req => { if (/\/api\/(status|events|incidents|diagnostics|watchdog)/.test(req.url())) backgroundRequests++; });
    await page.waitForTimeout(5500);
    expect(backgroundRequests).toBe(0);
    await login(page, role);
    await expect(page.locator("#diagnosticChecks .diag-row").first()).toBeVisible();
  });
}

test("Admin restart is explicit, destructive, logged endpoint only and not sent on cancel", async ({ page }) => {
  await page.goto("/");
  await login(page, "admin");
  await navigate(page, "system");
  const section = page.locator("#adminRecovery");
  const button = page.locator("#restartRestreamerButton");
  await expect(section).toBeVisible();
  await expect(button).toBeEnabled();

  const requests = [];
  await page.route("**/api/admin/restart-restreamer", async route => {
    requests.push({
      method:route.request().method(),
      header:route.request().headers()["x-supervisor-action"]
    });
    await route.fulfill({
      status:200,
      json:{
        status:"completed",
        verification:{ coreOnline:true, uiOnline:true, uiHttpStatus:200, waitedMs:1200 }
      }
    });
  });

  await button.click();
  await expect(page.locator("#modalTitle")).toHaveText("RESTART RESTREAMER");
  await expect(page.locator("#modalDetail")).toContainText("ALL active streams");
  await expect(page.locator("#modalConfirm")).toHaveClass(/danger/);
  await page.locator("#modalCancel").click();
  expect(requests).toEqual([]);

  await button.click();
  await page.locator("#modalConfirm").click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toEqual({ method:"POST", header:"1" });
  await expect(page.locator("#modalTitle")).toHaveText("RESTART COMPLETE");
  await expect(page.locator("#modalMessage")).toContainText("Core and Web UI are back online");
  await page.locator("#modalConfirm").click();
  await expect(button).toBeEnabled();
});

test("Technician never receives the global Restreamer restart control", async ({ page }) => {
  await page.goto("/");
  await login(page, "tech");
  await navigate(page, "system");
  await expect(page.locator("#adminRecovery")).toHaveAttribute("hidden", "");
  await expect(page.locator("#restartRestreamerButton")).not.toBeVisible();
});

test("session expiry discards a delayed response and reconnects normally", async ({ page, context }) => {
  await page.goto("/");
  await login(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let captured = false;
  await page.route("**/api/diagnostics", async route => {
    const response = await route.fetch();
    captured = true;
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await navigate(page, "diagnostics");
  await expect.poll(() => captured).toBe(true);
  await context.clearCookies();
  await navigate(page, "incidents");
  await expect(page.locator("#loginGate")).toBeVisible();
  release();
  await page.unroute("**/api/diagnostics");
  await page.waitForTimeout(500);
  await expect(page.locator("#diagnosticChecks .diag-row")).toHaveCount(0);
  await expect(page.locator("#channels")).not.toContainText("Agora");
  await login(page);
  await expect(page.locator("#appShell")).toHaveAttribute("aria-hidden", "false");
});

test("diagnostics attachment completes and the backend response is sanitized", async ({ page }, testInfo) => {
  await page.goto("/");
  await login(page);
  await navigate(page, "diagnostics");
  const start = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#downloadDiagnostics").click()
  ]);
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe("stream-supervisor-diagnostics.json");
  const response = await page.request.get("/api/diagnostics?download=1");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-disposition"]).toContain("attachment");
  const data = await response.json();
  expect(data.security.streamKeysIncluded).toBe(false);
  expect(data.security.credentialsIncluded).toBe(false);
  expect(data.security.rawEnginePayloadIncluded).toBe(false);
  await testInfo.attach("diagnostic-timing", { body: `Download and HTTP verification: ${Date.now() - start} ms`, contentType: "text/plain" });
});

test("mobile notice traps a single button and polling fallback stops on logout", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.addInitScript(() => { delete window.EventSource; });
  let snapshots = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/status") snapshots++; });
  await page.goto("/");
  await login(page);
  const initialSnapshots = snapshots;
  await expect.poll(() => snapshots, { timeout: 7000 }).toBeGreaterThan(initialSnapshots);
  await page.route("**/api/restreamer/output-command", route => route.fulfill({ status: 503, json: { status: "unavailable" } }));
  await page.locator('button[data-output-id="demo-fb"]').click();
  await page.locator("#modalConfirm").click();
  await expect(page.locator("#modalTitle")).toHaveText("COMMAND FAILED");
  await expect(page.locator("#modalConfirm")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#modalConfirm")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#modalConfirm")).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("mobile-command-notice.png") });
  await page.keyboard.press("Escape");
  await page.locator("#logoutButton").click();
  await page.locator("#modalConfirm").click();
  await expect(page.locator("#loginGate")).toBeVisible();
  const signedOutSnapshots = snapshots;
  await page.waitForTimeout(5500);
  expect(snapshots).toBe(signedOutSnapshots);
  await page.screenshot({ path: testInfo.outputPath("mobile-logged-out.png") });
});

for (const width of [390,1600]) {
  test(`user management lifecycle at ${width}px`, async ({page},testInfo) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await login(page);
    await navigate(page,'users');
    await expect(page.locator('#usersList')).toContainText('visual-admin');
    const boxes=[];
    for(const row of await page.locator('.user-row').all()){
      const edit=await row.getByRole('button',{name:'Modifier'}).boundingBox();
      const remove=await row.getByRole('button',{name:'Supprimer'}).boundingBox();
      expect(Math.abs(edit.width-remove.width)).toBeLessThan(1);
      expect(Math.abs(edit.height-remove.height)).toBeLessThan(1);
      expect(Math.abs(edit.y-remove.y)).toBeLessThan(1);
      boxes.push({edit,remove});
    }
    for(const box of boxes){
      expect(Math.abs(box.edit.x-boxes[0].edit.x)).toBeLessThan(1);
      expect(Math.abs(box.remove.x-boxes[0].remove.x)).toBeLessThan(1);
    }
    await page.locator('#newUser').click();
    const username=`operator-${width}`;
    await page.locator('#userName').fill(username);
    await page.locator('#userPassword').fill('temporary-test-password');
    await page.locator('#userPasswordConfirm').fill('temporary-test-password');
    await page.locator('#saveUser').click();
    await expect(page.locator('#usersList')).toContainText(username);
    const row=page.locator('.user-row').filter({hasText:username});
    await row.getByRole('button',{name:'Modifier'}).click();
    await page.locator('#userStatus').selectOption('disabled');
    await page.locator('#saveUser').click();
    await expect(row).toContainText('Désactivé');
    await row.getByRole('button',{name:'Supprimer'}).click();
    await page.locator('#modalConfirm').click();
    await expect(row).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`users-${width}.png`),fullPage:true});
    await page.locator('#logoutButton').click();
    await page.locator('#modalConfirm').click();
    await expect(page.locator('#loginGate')).toBeVisible();
    await expect(page.locator('#usersList')).toBeEmpty();
  });
}

test('account API rejects technician writes and missing action header',async ({request})=>{
  const loginResponse=await request.post('/api/login',{data:{username:'visual-tech',password:'visual-tech-pass'}});
  expect(loginResponse.ok()).toBe(true);
  expect((await request.get('/api/admin/users')).status()).toBe(403);
  expect((await request.post('/api/admin/users',{headers:{'X-Supervisor-Action':'1'},data:{username:'forbidden',role:'super-admin',password:'temporary-test-password',confirmPassword:'temporary-test-password'}})).status()).toBe(403);
  await request.post('/api/login',{data:{username:'visual-admin',password:'visual-pass'}});
  expect((await request.post('/api/admin/users',{data:{username:'forbidden'}})).status()).toBe(403);
});

for(const width of [390,1600]){
  test(`2FA setup, recovery login and disable at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:950});
    await page.goto('/');await login(page);
    const username=`twofactor-${width}`,password='temporary-2fa-password';
    const created=await page.request.post('/api/admin/users',{headers:{'X-Supervisor-Action':'1'},data:{username,role:'technician',password,confirmPassword:password}});
    expect(created.status()).toBe(201);
    await page.locator('#logoutButton').click();await page.locator('#modalConfirm').click();
    await expect(page.locator('#loginGate')).toBeVisible();
    await page.locator('#loginUsername').fill(username);await page.locator('#loginPassword').fill(password);await page.locator('#loginSubmit').click();
    await expect(page.locator('#loginGate')).not.toBeVisible();
    await navigate(page,'account');
    await expect(page.locator('#securityStatus')).toHaveText('2FA inactif.');
    await page.locator('#securityPassword').fill(password);await page.locator('#setupTwoFactor').click();
    await expect(page.locator('#twoFactorQr')).toHaveAttribute('src',/^data:image\/png/);
    const secret=await page.locator('#twoFactorSecret').textContent();
    await page.locator('#securityToken').fill(totp(secret));await page.locator('#confirmTwoFactor').click();
    await expect(page.locator('#twoFactorRecovery')).toBeVisible();
    const codes=(await page.locator('#recoveryCodes').inputValue()).split('\n');expect(codes.length).toBe(10);
    await page.locator('#closeRecovery').click();
    await expect(page.locator('#securityStatus')).toContainText('2FA actif');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`account-${width}.png`),fullPage:true});
    await page.locator('#logoutButton').click();await page.locator('#modalConfirm').click();
    await expect(page.locator('#loginGate')).toBeVisible();
    await expect(page.locator('#twoFactorSecret')).toHaveText('');await expect(page.locator('#recoveryCodes')).toHaveValue('');
    await expect(page.locator('#twoFactorQr')).not.toHaveAttribute('src');
    await page.locator('#loginUsername').fill(username);await page.locator('#loginPassword').fill(password);await page.locator('#loginSubmit').click();
    await expect(page.locator('#loginTokenField')).toBeVisible();await expect(page.locator('#loginGate')).toBeVisible();
    await page.locator('#loginToken').fill(codes[0]);await page.locator('#loginSubmit').click();
    await expect(page.locator('#loginGate')).not.toBeVisible();await navigate(page,'account');
    await expect(page.locator('#securityStatus')).toContainText('9 codes');
    await page.locator('#securityPassword').fill(password);await page.locator('#securityToken').fill(codes[1]);
    await page.locator('#disableTwoFactor').click();await page.locator('#modalConfirm').click();
    await expect(page.locator('#loginGate')).toBeVisible();
    await page.locator('#loginPassword').fill(password);await page.locator('#loginSubmit').click();
    await expect(page.locator('#loginGate')).not.toBeVisible();await navigate(page,'account');
    await expect(page.locator('#securityStatus')).toHaveText('2FA inactif.');
  });
}
