import { chromium } from "playwright";
import assert from "node:assert/strict";

/** @typedef {import('playwright').Page} Page */
/** @typedef {import('playwright').Route} Route */

const baseUrl = process.env.MEMBER_LOGIN_TEST_URL || "http://127.0.0.1:4322";
const loginUrl = `${baseUrl.replace(/\/$/, "")}/login`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let loginCalls = 0;
/** @param {Page} targetPage @param {string[]} outcomes */
const mockTurnstile = async (targetPage, outcomes = ["success"]) => {
  await targetPage.route("**/login*", async (/** @type {Route} */ route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/login") return route.continue();
    const response = await route.fetch();
    const body = await response.text();
    return route.fulfill({
      response,
      body: body.replace(/data-turnstile-site-key(?:="")?(?=\s|>)/, 'data-turnstile-site-key="test-site-key"'),
    });
  });
  await targetPage.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async (/** @type {Route} */ route) => {
    await route.fulfill({ contentType: "application/javascript", body: "" });
  });
  await targetPage.addInitScript((/** @type {string[]} */ initialOutcomes) => {
    let attempt = 0;
    const testWindow = /** @type {any} */ (window);
    const widgets = new Map();
    testWindow.__testTurnstileWidgets = widgets;
    testWindow.turnstile = {
      render: (/** @type {unknown} */ _container, /** @type {Record<string, any>} */ options) => {
        const widgetId = `test-widget-${widgets.size + 1}`;
        widgets.set(widgetId, { options, removed: false });
        return widgetId;
      },
      execute: (/** @type {string} */ widgetId) => {
        const currentAttempt = ++attempt;
        testWindow.__testTurnstileExecutions = currentAttempt;
        const outcome = initialOutcomes[currentAttempt - 1] || "success";
        queueMicrotask(() => {
          const options = widgets.get(widgetId)?.options;
          if (!options) return;
          if (outcome === "failure") return options["error-callback"]?.("mock-error");
          if (outcome === "expired") return options["expired-callback"]?.();
          if (outcome === "pending") return;
          options.callback?.(`mock-token-${currentAttempt}`);
        });
      },
      remove: (/** @type {string} */ widgetId) => {
        const widget = widgets.get(widgetId);
        if (widget) widget.removed = true;
      },
      reset: (/** @type {string} */ _widgetId) => {
      },
    };
    testWindow.__testTurnstileFire = (/** @type {string} */ widgetId, /** @type {string} */ kind, /** @type {string} */ token) => {
      const options = widgets.get(widgetId)?.options;
      if (kind === "success") options?.callback?.(token);
      if (kind === "error") options?.["error-callback"]?.("mock-error");
      if (kind === "expired") options?.["expired-callback"]?.();
    };
  }, outcomes);
};
await mockTurnstile(page);
const waitForMessage = async (
  /** @type {import('playwright').Page} */ targetPage,
  /** @type {string} */ pattern,
) => targetPage.waitForFunction(
  /** @param {string[]} patterns */
  (patterns) => patterns.some((expected) => document.querySelector('[data-message]')?.textContent?.includes(expected)),
  pattern.split('|'),
);

await page.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await page.route("**/api/auth/login", async (route) => {
  loginCalls += 1;
  const body = JSON.parse(route.request().postData() || "{}");
  assert.match(body.turnstileToken, /^mock-token-/);
  if (body.password === "bad") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "The email or password is incorrect." }) });
  if (body.password === "duplicate") {
    await new Promise((resolve) => setTimeout(resolve, 60));
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "We could not complete that request. Please try again." }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ redirectUrl: "/members" }) });
});
await page.route("**/api/auth/recovery", async (route) => {
  const body = JSON.parse(route.request().postData() || "{}");
  if (body.email === "failure@example.com") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "We could not complete that request. Please try again." }) });
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

const resetPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mockTurnstile(resetPage);
await resetPage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await resetPage.goto(`${loginUrl}?reset=complete`);
await resetPage.waitForSelector('[data-message]');
assert.match(await resetPage.locator('[data-message]').innerText(), /password was reset/i);
await resetPage.close();

const rootPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mockTurnstile(rootPage);
await rootPage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await rootPage.goto(baseUrl);
await rootPage.waitForURL("**/login");
await rootPage.close();

await page.goto(loginUrl);
assert.match((await page.getByRole("heading", { name: /WELCOME\s+BACK/ }).innerText()).replace(/\s+/g, " "), /^WELCOME BACK$/);
await page.locator("#email").fill("member@example.com");
await page.locator("#password").fill("bad");
await page.locator('[data-submit]').click();
await waitForMessage(page, "incorrect");
assert.match(await page.locator("[data-message]").innerText(), /incorrect/);

loginCalls = 0;
const duplicatePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mockTurnstile(duplicatePage, ["pending"]);
let duplicateLoginCalls = 0;
await duplicatePage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await duplicatePage.route("**/api/auth/login", async (route) => {
  duplicateLoginCalls += 1;
  return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "The email or password is incorrect." }) });
});
await duplicatePage.goto(loginUrl);
await duplicatePage.locator("#email").fill("member@example.com");
await duplicatePage.locator("#password").fill("bad");
await duplicatePage.locator('[data-submit]').dispatchEvent('click');
await duplicatePage.locator('[data-submit]').dispatchEvent('click');
await duplicatePage.waitForTimeout(100);
assert.equal(await duplicatePage.evaluate(() => (/** @type {any} */ (window)).__testTurnstileExecutions || 0), 1);
assert.equal(duplicateLoginCalls, 0);
await duplicatePage.evaluate(() => {
  const testWindow = /** @type {any} */ (window);
  const widgetId = Array.from(testWindow.__testTurnstileWidgets.keys()).at(-1);
  testWindow.__testTurnstileFire(widgetId, "success", "mock-token-pending");
});
await duplicatePage.waitForResponse("**/api/auth/login");
assert.equal(duplicateLoginCalls, 1);
await duplicatePage.close();

const executionsBeforeRecovery = await page.evaluate(() => (/** @type {any} */ (window)).__testTurnstileExecutions || 0);
await page.getByRole("button", { name: "Forgot Password?" }).click();
assert.match((await page.getByRole("heading", { name: /FORGOT\s+PASS\?/ }).innerText()).replace(/\s+/g, " "), /^FORGOT PASS\?$/);
await page.locator("#email").fill("member@example.com");
await page.locator('[data-submit]').click();
assert.match(await page.locator("[data-message]").innerText(), /reset instructions/);
assert.equal(await page.evaluate(() => (/** @type {any} */ (window)).__testTurnstileExecutions || 0), executionsBeforeRecovery);
await page.getByRole("button", { name: "Return to Login" }).click();
assert.match((await page.getByRole("heading", { name: /WELCOME\s+BACK/ }).innerText()).replace(/\s+/g, " "), /^WELCOME BACK$/);

await page.getByRole("button", { name: "Forgot Password?" }).click();
await page.locator("#email").fill("failure@example.com");
await page.locator('[data-submit]').click();
await waitForMessage(page, "could not complete");
assert.match(await page.locator("[data-message]").innerText(), /could not complete/);

const turnstileFailurePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mockTurnstile(turnstileFailurePage, ["failure", "success"]);
let turnstileFailureLoginCalls = 0;
await turnstileFailurePage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await turnstileFailurePage.route("**/api/auth/login", async (route) => {
  turnstileFailureLoginCalls += 1;
  return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "The email or password is incorrect." }) });
});
await turnstileFailurePage.goto(loginUrl);
await turnstileFailurePage.locator("#email").fill("member@example.com");
await turnstileFailurePage.locator("#password").fill("bad");
await turnstileFailurePage.locator("[data-submit]").click();
await waitForMessage(turnstileFailurePage, "Turnstile verification failed");
assert.equal(turnstileFailureLoginCalls, 0);
assert.equal(await turnstileFailurePage.locator("[data-submit]").isEnabled(), true);
await turnstileFailurePage.locator("[data-submit]").click();
await waitForMessage(turnstileFailurePage, "incorrect");
assert.equal(turnstileFailureLoginCalls, 1);
await turnstileFailurePage.close();

const turnstileExpiryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mockTurnstile(turnstileExpiryPage, ["expired", "success"]);
let turnstileExpiryLoginCalls = 0;
await turnstileExpiryPage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await turnstileExpiryPage.route("**/api/auth/login", async (route) => {
  turnstileExpiryLoginCalls += 1;
  return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "The email or password is incorrect." }) });
});
await turnstileExpiryPage.goto(loginUrl);
await turnstileExpiryPage.locator("#email").fill("member@example.com");
await turnstileExpiryPage.locator("#password").fill("bad");
await turnstileExpiryPage.locator("[data-submit]").click();
await waitForMessage(turnstileExpiryPage, "Turnstile verification failed");
assert.equal(turnstileExpiryLoginCalls, 0);
await turnstileExpiryPage.locator("[data-submit]").click();
await waitForMessage(turnstileExpiryPage, "incorrect");
assert.equal(turnstileExpiryLoginCalls, 1);
await turnstileExpiryPage.close();

const staleCallbackPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mockTurnstile(staleCallbackPage, ["pending", "pending"]);
let staleCallbackLoginCalls = 0;
let staleCallbackToken;
await staleCallbackPage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await staleCallbackPage.route("**/api/auth/login", async (route) => {
  staleCallbackLoginCalls += 1;
  staleCallbackToken = JSON.parse(route.request().postData() || "{}").turnstileToken;
  return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "The email or password is incorrect." }) });
});
await staleCallbackPage.goto(loginUrl);
await staleCallbackPage.locator("#email").fill("member@example.com");
await staleCallbackPage.locator("#password").fill("bad");
await staleCallbackPage.locator("[data-submit]").click();
await staleCallbackPage.waitForFunction(() => (/** @type {any} */ (window)).__testTurnstileExecutions === 1);
const staleWidgetId = await staleCallbackPage.evaluate(() => Array.from((/** @type {any} */ (window)).__testTurnstileWidgets.keys())[0]);
await staleCallbackPage.evaluate((widgetId) => (/** @type {any} */ (window)).__testTurnstileFire(widgetId, "error", ""), staleWidgetId);
await staleCallbackPage.locator("[data-submit]").click();
await staleCallbackPage.waitForFunction(() => (/** @type {any} */ (window)).__testTurnstileExecutions === 2);
const currentWidgetId = await staleCallbackPage.evaluate(() => Array.from((/** @type {any} */ (window)).__testTurnstileWidgets.keys())[1]);
for (const kind of ["success", "error", "expired"]) {
  await staleCallbackPage.evaluate(({ widgetId, callbackKind }) => (/** @type {any} */ (window)).__testTurnstileFire(widgetId, callbackKind, "stale-token"), { widgetId: staleWidgetId, callbackKind: kind });
}
assert.equal(staleCallbackLoginCalls, 0);
await staleCallbackPage.evaluate((widgetId) => (/** @type {any} */ (window)).__testTurnstileFire(widgetId, "success", "fresh-token-b"), currentWidgetId);
await staleCallbackPage.waitForResponse("**/api/auth/login");
assert.equal(staleCallbackLoginCalls, 1);
assert.equal(staleCallbackToken, "fresh-token-b");
await staleCallbackPage.close();

const successPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mockTurnstile(successPage);
await successPage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await successPage.route("**/api/auth/login", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ redirectUrl: "/members" }) }));
await successPage.route("**/members", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Members</title>" }));
await successPage.goto(loginUrl);
await successPage.locator("#email").fill("member@example.com");
await successPage.locator("#password").fill("good");
await successPage.locator('[data-submit]').click();
await successPage.waitForURL("**/members");
await successPage.close();

const networkFailurePage = await browser.newPage({ viewport: { width: 414, height: 896 } });
await mockTurnstile(networkFailurePage);
await networkFailurePage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await networkFailurePage.route("**/api/auth/login", async (route) => route.abort("failed").catch(() => {}));
await networkFailurePage.goto(loginUrl);
await networkFailurePage.locator("#email").fill("member@example.com");
await networkFailurePage.locator("#password").fill("good");
await networkFailurePage.locator('[data-submit]').click();
await waitForMessage(networkFailurePage, "could not reach|could not complete");
assert.match(await networkFailurePage.locator("[data-message]").innerText(), /could not reach|could not complete/i);
await networkFailurePage.close();

const authenticatedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mockTurnstile(authenticatedPage);
await authenticatedPage.route("**/api/auth/session", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, redirectUrl: "/members" }) }));
await authenticatedPage.route("**/members", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Members</title>" }));
await authenticatedPage.goto(loginUrl);
await authenticatedPage.waitForURL("**/members");
await authenticatedPage.close();

await page.setViewportSize({ width: 320, height: 700 });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
await page.setViewportSize({ width: 1440, height: 900 });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

await browser.close();
console.log("member-login browser checks passed");
