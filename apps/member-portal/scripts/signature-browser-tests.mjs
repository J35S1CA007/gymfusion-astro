import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseURL = "http://127.0.0.1:4347";
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const astroPackage = require.resolve("astro/package.json", { paths: [appRoot] });
const astroBin = join(dirname(astroPackage), "bin", "astro.mjs");

async function startPreview() {
  const child = spawn(process.execPath, [astroBin, "dev", "--host", "127.0.0.1", "--port", "4347"], {
    cwd: appRoot,
    detached: process.platform !== "win32",
    stdio: "ignore",
    env: process.env,
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseURL}/eoi/part-2`);
      if (response.ok) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error("Astro preview server did not start");
}

function stopPreview(child) {
  if (!child || child.killed) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  child.kill("SIGTERM");
}

async function drawWithPointer(page) {
  const canvas = page.locator("canvas[data-signature-pad]");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box, "signature canvas must be visible");
  const start = { x: box.x + Math.max(24, box.width * 0.12), y: box.y + box.height * 0.52 };
  const middle = { x: box.x + box.width * 0.42, y: box.y + box.height * 0.28 };
  const end = { x: box.x + box.width * 0.72, y: box.y + box.height * 0.64 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(middle.x, middle.y, { steps: 8 });
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  return { box, start, middle, end };
}

async function signatureValue(page) {
  return page.locator("#healthInformationSignature").inputValue();
}

async function canvasState(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas[data-signature-pad]");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("signature canvas missing");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("signature canvas context missing");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let alphaPixels = 0;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
        alphaPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const rect = canvas.getBoundingClientRect();
    const ratioX = canvas.width / Math.max(rect.width, 1);
    const ratioY = canvas.height / Math.max(rect.height, 1);
    return {
      displayedWidth: rect.width,
      displayedHeight: rect.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      alphaPixels,
      bounds: maxX < 0 ? null : {
        left: minX / ratioX,
        top: minY / ratioY,
        right: maxX / ratioX,
        bottom: maxY / ratioY,
      },
    };
  });
}

async function waitForDrawableCanvas(page, route) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas[data-signature-pad]");
    return canvas instanceof HTMLCanvasElement && canvas.getBoundingClientRect().width > 1 && canvas.width > 1;
  }, undefined, { timeout: 3000 });
  const state = await canvasState(page);
  assert.ok(state.displayedWidth > 100 && state.displayedHeight > 100, `${route} canvas must have meaningful displayed dimensions`);
  assert.ok(state.backingWidth > 1 && state.backingHeight > 1, `${route} canvas must not remain 1x1`);
  assert.ok(
    Math.abs(state.backingWidth / state.displayedWidth - state.devicePixelRatio) < 0.1,
    `${route} canvas width must track devicePixelRatio`,
  );
  assert.ok(
    Math.abs(state.backingHeight / state.displayedHeight - state.devicePixelRatio) < 0.1,
    `${route} canvas height must track devicePixelRatio`,
  );
  return state;
}

async function assertVisibleStroke(page, route, stroke) {
  const state = await canvasState(page);
  assert.ok(state.alphaPixels > 0, `${route} pointer drawing must change visible pixels`);
  assert.match(await signatureValue(page), /^data:image\/png;base64,/, `${route} pointer drawing must produce a PNG`);
  assert.ok(state.bounds, `${route} pointer drawing must have pixel bounds`);
  const expected = {
    left: stroke.start.x - stroke.box.x,
    top: stroke.start.y - stroke.box.y,
    right: stroke.end.x - stroke.box.x,
    bottom: stroke.end.y - stroke.box.y,
  };
  assert.ok(state.bounds.left <= expected.left + 18, `${route} stroke left edge must align with pointer`);
  assert.ok(state.bounds.top <= expected.top + 18, `${route} stroke top edge must align with pointer`);
  assert.ok(state.bounds.right >= expected.right - 18, `${route} stroke right edge must align with pointer`);
  assert.ok(state.bounds.bottom >= expected.bottom - 18, `${route} stroke bottom edge must align with pointer`);
  return state;
}

let preview;
let browser;
try {
  preview = await startPreview();
  browser = await chromium.launch({ headless: true });

  for (const width of [1280, 320, 390, 414]) {
    for (const route of ["part-2", "part-3", "part-4"]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500 });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    const response = await page.goto(`${baseURL}/eoi/${route}`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${route} must render`);
    await page.fill("#healthInformationFirstName", "Preview");
    await page.fill("#healthInformationLastName", "Member");
    await page.check('input[name="healthInformationConsent"]');
    await page.locator("canvas[data-signature-pad]").scrollIntoViewIfNeeded();
    await waitForDrawableCanvas(page, route);

    const drawState = await page.evaluate(() => {
      const instruction = document.querySelector("#healthInformationSignatureInstructions");
      const canvas = document.querySelector("canvas[data-signature-pad]");
      const instructionRect = instruction.getBoundingClientRect();
      return {
        instructionPosition: getComputedStyle(instruction).position,
        instructionWidth: instructionRect.width,
        instructionHeight: instructionRect.height,
        cursor: getComputedStyle(canvas).cursor,
      };
    });
    assert.equal(drawState.instructionPosition, "absolute", `${route} guidance must remain accessible but visually hidden`);
    assert.ok(drawState.instructionWidth <= 1 && drawState.instructionHeight <= 1, `${route} guidance must not be visible`);
    assert.match(drawState.cursor, /image-set/, `${route} must use the desktop pen cursor`);

    const firstStroke = await drawWithPointer(page);
    const firstState = await assertVisibleStroke(page, route, firstStroke);
    const secondStroke = await drawWithPointer(page);
    const secondState = await assertVisibleStroke(page, route, secondStroke);
    assert.ok(secondState.alphaPixels >= firstState.alphaPixels, `${route} repeated strokes must remain visible`);

    await page.locator("[data-clear-signature]").click();
    await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value === "");
    const clearedState = await canvasState(page);
    assert.equal(clearedState.alphaPixels, 0, `${route} Clear Signature must remove drawing pixels`);

    const redrawStroke = await drawWithPointer(page);
    await assertVisibleStroke(page, route, redrawStroke);
    const beforeTypeState = await canvasState(page);

    await page.getByRole("button", { name: "Choose a font" }).click();
    await page.getByRole("button", { name: "Great Vibes" }).click();
    await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
    const typeState = await page.evaluate(() => ({
      instructionRect: (() => { const rect = document.querySelector("#healthInformationSignatureInstructions").getBoundingClientRect(); return { width: rect.width, height: rect.height }; })(),
      fontPickerHidden: document.querySelector("[data-signature-font-options]")?.hidden,
      typedPreviewHidden: document.querySelector("[data-signature-typed-preview]")?.hidden,
      typedPreviewText: document.querySelector("[data-signature-typed-preview]")?.textContent?.trim(),
    }));
    assert.ok(typeState.instructionRect.width <= 1 && typeState.instructionRect.height <= 1, `${route} guidance must stay hidden in Type mode`);
    assert.equal(typeState.fontPickerHidden, false, `${route} font choices must be available`);
    assert.equal(typeState.typedPreviewHidden, false, `${route} typed preview must render`);
    assert.equal(typeState.typedPreviewText, "Preview Member", `${route} typed signature must use the member name`);
    const hiddenCanvasState = await canvasState(page);
    assert.equal(hiddenCanvasState.backingWidth, beforeTypeState.backingWidth, `${route} Type mode must not collapse the hidden canvas`);
    assert.equal(hiddenCanvasState.backingHeight, beforeTypeState.backingHeight, `${route} Type mode must preserve canvas backing height`);

    await page.locator("[data-clear-signature]").click();
    assert.equal(await signatureValue(page), "", `${route} Clear Signature must clear typed output`);
    await page.getByRole("button", { name: "Draw signature" }).click();
    const canvas = page.locator("canvas[data-signature-pad]");
    assert.equal(await canvas.isVisible(), true, `${route} Draw mode must restore the canvas`);
    await waitForDrawableCanvas(page, route);
    await canvas.focus();
    await canvas.press("Enter");
    await canvas.press("ArrowRight");
    await canvas.press("ArrowDown");
    await canvas.press("Enter");
    await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
    assert.ok((await canvasState(page)).alphaPixels > 0, `${route} keyboard drawing must change visible pixels`);

    const resizedWidth = width === 1280 ? 1024 : width + 20;
    await page.setViewportSize({ width: resizedWidth, height: 900 });
    await page.locator("canvas[data-signature-pad]").scrollIntoViewIfNeeded();
    await waitForDrawableCanvas(page, route);
    const resizedStroke = await drawWithPointer(page);
    await assertVisibleStroke(page, route, resizedStroke);
    assert.deepEqual(consoleErrors, [], `${route} console errors: ${consoleErrors.join("; ")}`);
    await page.close();
    }
  }

  for (const width of [320, 390, 414]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, hasTouch: true });
    await page.goto(`${baseURL}/eoi/part-3`, { waitUntil: "networkidle" });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      `${width}px must not introduce horizontal overflow`,
    );
    await page.close();
  }

  console.log("signature browser tests passed");
} finally {
  await browser?.close();
  stopPreview(preview);
}
