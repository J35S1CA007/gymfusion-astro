import { chromium } from "playwright";
import assert from "node:assert/strict";

const baseUrl = process.env.MEMBER_LOGIN_TEST_URL || "http://127.0.0.1:4322";
const loginUrl = `${baseUrl.replace(/\/$/, "")}/login`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let loginCalls = 0;
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
await resetPage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await resetPage.goto(`${loginUrl}?reset=complete`);
await resetPage.waitForSelector('[data-message]');
assert.match(await resetPage.locator('[data-message]').innerText(), /password was reset/i);
await resetPage.close();

const rootPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await rootPage.route("**/api/auth/session", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
await rootPage.goto(baseUrl);
await rootPage.waitForURL("**/login");
await rootPage.close();

await page.goto(loginUrl);
assert.equal(await page.getByRole("heading", { name: "WELCOME BACK", exact: true }).innerText(), "WELCOME BACK");
await page.locator("#email").fill("member@example.com");
await page.locator("#password").fill("bad");
await page.locator('[data-submit]').click();
await waitForMessage(page, "incorrect");
assert.match(await page.locator("[data-message]").innerText(), /incorrect/);

loginCalls = 0;
await page.locator("#password").fill("duplicate");
await Promise.all([
  page.locator('[data-submit]').click(),
  page.locator('[data-submit]').click(),
]);
await waitForMessage(page, "could not complete");
assert.equal(loginCalls, 1);
assert.match(await page.locator("[data-message]").innerText(), /could not complete/);

await page.getByRole("button", { name: "Forgot Password?" }).click();
assert.equal(await page.getByRole("heading", { name: "FORGOT PASS?", exact: true }).innerText(), "FORGOT PASS?");
await page.locator("#email").fill("member@example.com");
await page.locator('[data-submit]').click();
assert.match(await page.locator("[data-message]").innerText(), /reset instructions/);
await page.getByRole("button", { name: "Return to Login" }).click();
assert.equal(await page.getByRole("heading", { name: "WELCOME BACK", exact: true }).innerText(), "WELCOME BACK");

await page.getByRole("button", { name: "Forgot Password?" }).click();
await page.locator("#email").fill("failure@example.com");
await page.locator('[data-submit]').click();
await waitForMessage(page, "could not complete");
assert.match(await page.locator("[data-message]").innerText(), /could not complete/);

const successPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
