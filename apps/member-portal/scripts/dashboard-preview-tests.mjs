import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseURL = "http://127.0.0.1:4327";
const appRoot = fileURLToPath(new URL("..", import.meta.url));
let preview;

let browser;
try {
  try {
    const existing = await fetch(`${baseURL}/dev-preview/frame`);
    if (!existing.ok) throw new Error(`existing dev server returned ${existing.status}`);
  } catch {
    preview = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4327"], {
      cwd: appRoot,
      stdio: "ignore",
      env: { ...process.env },
    });
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseURL}/dev-preview/frame`);
      if (response.status === 200) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseURL}/dev-preview/frame`, { waitUntil: "networkidle" });

  await page.waitForFunction(() => !document.querySelector("astro-island")?.hasAttribute("ssr"));
  const status = page.locator("#dashboard-status-heading");
  const taskHeading = page.locator("#dashboard-tasks-heading");
  assert.equal(await status.textContent(), "Your EOI is in progress.");
  assert.equal(await page.locator("[aria-label='EOI - Part 1, COMPLETE']").count(), 1);
  assert.equal(await page.locator("[aria-label='EOI - Part 3, INCOMPLETE, locked']").count(), 1);

  await page.getByRole("button", { name: "Open preview controls" }).click();
  const state = page.locator("#dashboard-preview-state");
  await state.selectOption("active-incomplete");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await page.locator("[aria-label='EOI - Part 1, INCOMPLETE']").count(), 1);
  assert.equal(await page.locator("#dashboard-tasks-heading").textContent(), "Action required");

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("no-active");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await status.textContent(), "No active enrolment or EOI in progress.");
  assert.equal(await page.getByText("If you would like to re-enrol, please submit a new").count(), 1);
  assert.equal(await page.getByRole("link", { name: "EOI" }).getAttribute("href"), "https://eoi.gymfusion.com.au");
  assert.equal(await taskHeading.textContent(), "No outstanding tasks.");
  assert.equal(await page.locator("#dashboard-eoi-heading").count(), 0);

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("eoi-review");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await status.textContent(), "Your EOI is under review.");
  assert.equal(await page.locator("[aria-label='EOI - Part 4, COMPLETE']").count(), 1);
  await page.getByRole("link", { name: "Review" }).first().waitFor();
  assert.equal(await page.getByRole("link", { name: "Review" }).count(), 3);

  for (const width of [320, 390, 414]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `no horizontal overflow at ${width}px`);
  }
  console.log("dashboard preview tests passed: 4 states, 3 mobile widths");
} finally {
  await browser?.close();
  preview?.kill();
}
