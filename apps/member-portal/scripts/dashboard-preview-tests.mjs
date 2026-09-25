import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4327";
const port = new URL(baseURL).port || "4327";
const appRoot = fileURLToPath(new URL("..", import.meta.url));
let preview;

let browser;
try {
  try {
    const existing = await fetch(`${baseURL}/dev-preview/frame`);
    if (!existing.ok) throw new Error(`existing dev server returned ${existing.status}`);
  } catch {
    preview = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", port], {
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
  const taskHeading = page.locator("#dashboard-tasks-heading");
  assert.equal(await page.locator("#eoi-overview-heading").textContent(), "Where you are now");
  assert.equal(await page.locator("#dashboard-eoi-heading").count(), 0);
  assert.equal(await page.locator("[aria-label^='EOI - Part']").count(), 0);

  await page.getByRole("button", { name: "Open preview controls" }).click();
  const state = page.locator("#dashboard-preview-state");
  await state.selectOption("active-incomplete");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await page.locator("[aria-label^='EOI - Part']").count(), 0);
  await page.getByRole("heading", { name: "Complete your Expression of Interest", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Complete your Expression of Interest" }).count(), 1);
  assert.equal(await page.locator("#dashboard-tasks-heading").textContent(), "Action required");

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("part2-complete");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("heading", { name: "Complete your Accessibility & Support Needs", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Complete your Accessibility & Support Needs" }).count(), 1);
  assert.equal(await page.locator("[aria-label='EOI - Part 3, INCOMPLETE, locked']").count(), 0);

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("part3-complete");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("heading", { name: "Complete your Fitness Profile", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Complete your Fitness Profile" }).count(), 1);
  assert.equal(await page.locator("[aria-label='EOI - Part 4, INCOMPLETE, locked']").count(), 0);

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("complete-eoi-phase");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await page.locator("h3").filter({ hasText: "Your EOI is in the Review Phase" }).count(), 0);
  assert.equal(await page.locator("h3").filter({ hasText: "Parts 2-4 complete" }).count(), 2);

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("complete-no-phase");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await page.locator("h3").filter({ hasText: "Your EOI is in the Review Phase" }).count(), 0);

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("incomplete-review");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await page.locator("h3").filter({ hasText: "Your EOI is in the Review Phase" }).count(), 0);
  assert.equal(await taskHeading.textContent(), "Action required");

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("no-active");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await taskHeading.textContent(), "No outstanding tasks.");
  const noActiveText = await page.locator("body").innerText();
  assert.equal(noActiveText.includes("Complete Part 1"), false);
  assert.equal(noActiveText.includes("Your next steps"), false);
  assert.equal(noActiveText.includes("Your EOI is in the Review Phase"), false);

  await page.getByRole("button", { name: "Open preview controls" }).click();
  await state.selectOption("eoi-review");
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(await page.locator("h3").filter({ hasText: "Your EOI is in the Review Phase" }).count(), 2);
  assert.equal(await page.locator("[aria-label^='EOI - Part']").count(), 0);
  assert.equal(await page.locator("#dashboard-tasks-heading").textContent(), "No outstanding tasks.");

  for (const width of [320, 390, 414, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `no horizontal overflow at ${width}px`);
  }
  await page.goto(`${baseURL}/dev-preview/eoi`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#eoi-overview-heading").textContent(), "Where you are now");
  assert.equal(await page.locator("#dashboard-eoi-heading").count(), 1);
  assert.equal(await page.locator("[aria-label^='EOI - Part']").count(), 4);
  assert.equal(await page.locator("[aria-label='EOI - Part 4, COMPLETE']").count(), 1);
  console.log("dashboard preview tests passed: 9 states, dashboard tracker, detailed EOI grid, 4 widths");
} finally {
  await browser?.close();
  preview?.kill();
}
