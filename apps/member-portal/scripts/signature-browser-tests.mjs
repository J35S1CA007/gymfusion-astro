import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startTestPreview, stopTestPreview } from "./test-preview-server.mjs";

const testPort = Number(process.env.GYMFUSION_TEST_PORT || 4349);
const baseURL = `http://127.0.0.1:${testPort}`;
const expectedTypeFonts = [
  { value: "GF Black William", label: "Black William", size: "28px" },
  { value: "GF Byron", label: "Byron", size: "28px" },
  { value: "GF Indian Dunes", label: "Indian Dunes", size: "28px" },
  { value: "GF Roustel", label: "Roustel", size: "22px" },
  { value: "GF Signature", label: "Signature", size: "22px" },
  { value: "GF Thornton", label: "Thornton", size: "22px" },
];
const expectedSignatureMetadata = {
  "part-2": { documentId: "EOI-P2-HEALTH-PROFILE", filePrefix: "EOI-P2-HEALTH-NOTICE-SIGNATURE" },
  "part-3": { documentId: "EOI-P3-ACCESSIBILITY-SUPPORT", filePrefix: "EOI-P3-HEALTH-NOTICE-SIGNATURE" },
  "part-4": { documentId: "EOI-P4-HEALTH-PROFILE", filePrefix: "EOI-P4-HEALTH-NOTICE-SIGNATURE" },
};
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const perfectFreehandEntry = require.resolve("perfect-freehand", { paths: [appRoot] });
const perfectFreehandPackage = JSON.parse(readFileSync(join(dirname(perfectFreehandEntry), "..", "..", "package.json"), "utf8"));
assert.equal(perfectFreehandPackage.version, "1.2.3", "perfect-freehand must remain pinned to 1.2.3");

async function startPreview() {
  return startTestPreview({ port: testPort, readinessPath: "/eoi/part-2", env: process.env });
}

async function drawSyntheticStroke(page, points, { pointerType = "pen", pressures = [] } = {}) {
  await page.evaluate(({ points, pointerType, pressures }) => {
    const canvas = document.querySelector("canvas[data-signature-pad]");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("signature canvas missing");
    const rect = canvas.getBoundingClientRect();
    canvas.setPointerCapture = () => {};
    const events = points.length === 1 ? ["pointerdown", "pointerup"] : points.map((_, index) => (
      index === 0 ? "pointerdown" : index === points.length - 1 ? "pointerup" : "pointermove"
    ));
    for (let index = 0; index < events.length; index += 1) {
      const point = points[Math.min(index, points.length - 1)];
      const type = events[index];
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
        pointerId: 17,
        pointerType,
        pressure: pressures[index] ?? 0.5,
        isPrimary: true,
      }));
    }
  }, { points, pointerType, pressures });
}

async function horizontalWidthRange(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas[data-signature-pad]");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("signature canvas missing");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("signature canvas context missing");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const columns = [];
    for (let x = 12; x < canvas.width - 12; x += 1) {
      let coverage = 0;
      for (let y = 0; y < canvas.height; y += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 0) coverage += 1;
      }
      if (coverage > 0) columns.push(coverage);
    }
    return { min: Math.min(...columns), max: Math.max(...columns), values: columns };
  });
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

async function signatureFields(page) {
  return page.evaluate(() => {
    const svg = document.querySelector("#healthInformationSignatureSvg")?.value || "";
    return {
      raw: document.querySelector("#healthInformationSignature")?.value || "",
      svg,
      fileName: document.querySelector("#healthInformationSignatureFileName")?.value || "",
      signedAt: document.querySelector("#healthInformationSignatureSignedAt")?.value || "",
      documentID: document.querySelector("#healthInformationSignatureDocumentID")?.value || "",
      stampID: svg.match(/(HEALTH-COLLECTION-NOTICE-SIGNATURE-\d+-[A-Z0-9]{8}) \| Signed:/)?.[1] || "",
      mode: document.querySelector("[data-health-information-notice]")?.dataset.signatureCurrentMode || "",
      valid: document.querySelector("[data-health-information-notice]")?.dataset.signatureValid || "false",
    };
  });
}

function assertEmptySignatureFields(fields, label) {
  assert.deepEqual(
    {
      raw: fields.raw,
      svg: fields.svg,
      fileName: fields.fileName,
      signedAt: fields.signedAt,
      documentID: fields.documentID,
      stampID: fields.stampID,
    },
    { raw: "", svg: "", fileName: "", signedAt: "", documentID: "", stampID: "" },
    `${label} must clear all signature output and audit metadata`,
  );
}

async function assertSignatureSpacing(page, route) {
  const spacing = await page.evaluate(() => {
    const method = document.querySelector(".gf-signature-method");
    const legend = method?.querySelector("legend");
    const methodOptions = document.querySelector(".gf-signature-method-options");
    const fontOptions = document.querySelector(".gf-signature-font-options");
    const methodRect = methodOptions?.getBoundingClientRect();
    const workspaceRect = document.querySelector("[data-signature-workspace]")?.getBoundingClientRect();
    return {
      headingMarginBottom: legend ? getComputedStyle(legend).marginBottom : "",
      methodContainerGap: method ? getComputedStyle(method).rowGap : "",
      methodButtonGap: methodOptions ? getComputedStyle(methodOptions).gap : "",
      fontOptionGap: fontOptions ? getComputedStyle(fontOptions).gap : "",
      methodToContentGap: methodRect && workspaceRect ? workspaceRect.top - methodRect.bottom : 0,
    };
  });
  assert.equal(spacing.headingMarginBottom, "4px", `${route} Choose signature method heading must have a 4px margin below it`);
  assert.equal(spacing.methodContainerGap, "12px", `${route} method container gap must remain 12px`);
  assert.equal(spacing.methodButtonGap, "12px", `${route} method-button gap must remain 12px`);
  assert.equal(spacing.fontOptionGap, "12px", `${route} font-option gap must remain 12px`);
  assert.ok(spacing.methodToContentGap >= 12, `${route} method-to-content spacing must remain usable`);
}

async function assertSignatureMetadata(page, route) {
  const expected = expectedSignatureMetadata[route];
  const metadata = await page.evaluate(() => {
    const raw = document.querySelector("#healthInformationSignature")?.value || "";
    const svg = document.querySelector("#healthInformationSignatureSvg")?.value || "";
    const signedAt = document.querySelector("#healthInformationSignatureSignedAt")?.value || "";
    const documentID = document.querySelector("#healthInformationSignatureDocumentID")?.value || "";
    const fileName = document.querySelector("#healthInformationSignatureFileName")?.value || "";
    const rawBinary = raw.startsWith("data:image/png;base64,") ? atob(raw.split(",", 2)[1]) : "";
    const pngView = rawBinary.length >= 24 ? new DataView(Uint8Array.from(rawBinary, (character) => character.charCodeAt(0)).buffer) : null;
    const pngWidth = pngView?.getUint32(16) || 0;
    const pngHeight = pngView?.getUint32(20) || 0;
    const svgDocument = svg ? new DOMParser().parseFromString(svg, "image/svg+xml") : null;
    const parserError = svgDocument?.querySelector("parsererror");
    const viewBox = svgDocument?.documentElement.getAttribute("viewBox")?.split(/\s+/).map(Number) || [];
    const texts = [...(svgDocument?.querySelectorAll("text") || [])].map((text) => text.textContent || "");
    const embeddedImage = svgDocument?.querySelector("image");
    const stampMatch = svg.match(/(HEALTH-COLLECTION-NOTICE-SIGNATURE-\d+-[A-Z0-9]{8}) \| Signed: ([^<]+)/);
    return {
      raw,
      svg,
      signedAt,
      documentID,
      fileName,
      pngWidth,
      pngHeight,
      svgValid: Boolean(svgDocument?.documentElement && !parserError),
      viewBox,
      texts,
      embeddedRaw: Boolean(embeddedImage?.getAttribute("href") === raw),
      embeddedWidth: Number(embeddedImage?.getAttribute("width") || 0),
      embeddedHeight: Number(embeddedImage?.getAttribute("height") || 0),
      stampID: stampMatch?.[1] || "",
      stampSignedAt: stampMatch?.[2] || "",
    };
  });
  assert.match(metadata.raw, /^data:image\/png;base64,/, `${route} raw signature must remain a PNG data URL`);
  assert.ok(metadata.pngWidth > 0 && metadata.pngHeight > 0, `${route} raw PNG must have valid dimensions`);
  assert.equal(metadata.documentID, expected.documentId, `${route} must use its fixed signature document ID`);
  assert.equal(metadata.fileName, `${expected.filePrefix}_${expected.documentId}_${metadata.signedAt.replace(/[:.]/g, "-")}.png`, `${route} filename must use the fixed document ID and signed timestamp`);
  assert.ok(metadata.svgValid, `${route} stamped SVG must remain XML-valid`);
  assert.ok(metadata.svg.includes(metadata.raw), `${route} SVG must embed the unchanged raw PNG`);
  assert.equal(metadata.embeddedRaw, true, `${route} SVG image must reference the raw PNG`);
  assert.ok(metadata.embeddedWidth > 0 && metadata.embeddedHeight > 0, `${route} SVG image dimensions must be positive`);
  assert.equal(metadata.viewBox[2], metadata.embeddedWidth, `${route} SVG image must fit the SVG width`);
  assert.ok(metadata.viewBox[3] > metadata.embeddedHeight, `${route} SVG must reserve space below the embedded signature image`);
  assert.equal(metadata.texts[0], "Printed Name: Preview | Member", `${route} SVG must include the entered printed name`);
  assert.equal(metadata.texts[1], "MODE: DIGITAL SIGNATURE", `${route} SVG must use the required digital-signature mode label`);
  assert.equal(metadata.texts[2], `Document ID: ${expected.documentId}`, `${route} SVG must include the fixed document ID`);
  assert.match(metadata.stampID, /^HEALTH-COLLECTION-NOTICE-SIGNATURE-\d+-[A-Z0-9]{8}$/, `${route} SVG must include a unique signature stamp ID`);
  assert.equal(metadata.stampSignedAt, metadata.signedAt, `${route} SVG and hidden Signed timestamps must match`);
  assert.equal(metadata.svg.includes(`Document ID: ${expected.documentId}`), true, `${route} SVG must include its fixed document ID`);
  return metadata;
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

async function assertTypeFontPicker(page, route) {
  const pickerState = await page.evaluate(() => ({
    labels: [...document.querySelectorAll("[data-signature-font]")].map((button) => button.textContent.trim()),
    values: [...document.querySelectorAll("[data-signature-font]")].map((button) => button.dataset.signatureFont),
    selected: [...document.querySelectorAll("[data-signature-font][aria-pressed='true']")].map((button) => button.dataset.signatureFont),
    modeSize: getComputedStyle(document.querySelector("[data-signature-mode]"))?.fontSize,
    fontSize: getComputedStyle(document.querySelector("[data-signature-font]"))?.fontSize,
  }));
  assert.deepEqual(pickerState.labels, expectedTypeFonts.map(({ label }) => label), `${route} must expose the six approved font labels in order`);
  assert.deepEqual(pickerState.values, expectedTypeFonts.map(({ value }) => value), `${route} must expose the six approved font aliases in order`);
  assert.deepEqual(pickerState.selected, ["GF Black William"], `${route} Black William must be selected by default`);
  assert.equal(pickerState.modeSize, "15px", `${route} signature mode text must be 15px`);
  assert.equal(pickerState.fontSize, expectedTypeFonts[0].size, `${route} ${expectedTypeFonts[0].label} font option text must be ${expectedTypeFonts[0].size}`);

  const typedOutputs = [];
  for (const font of expectedTypeFonts) {
    await page.locator(`[data-signature-font="${font.value}"]`).click();
    await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
    const loadedState = await page.evaluate(async ({ value }) => {
      await document.fonts.load(`58px "${value}"`);
      const button = document.querySelector(`[data-signature-font="${value}"]`);
      const preview = document.querySelector("[data-signature-typed-preview]");
      const face = [...document.fonts].find((candidate) => candidate.family === value && candidate.status === "loaded");
      return {
        fontLoaded: Boolean(face),
        fontCheck: document.fonts.check(`58px "${value}"`),
        buttonFont: getComputedStyle(button).fontFamily,
        previewFont: getComputedStyle(preview).fontFamily,
        previewSize: getComputedStyle(preview).fontSize,
      };
    }, { value: font.value });
    assert.equal(loadedState.fontLoaded, true, `${route} ${font.label} font must load`);
    assert.equal(loadedState.fontCheck, true, `${route} ${font.label} font must pass document.fonts.check`);
    assert.match(loadedState.buttonFont, new RegExp(font.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${route} ${font.label} button must use its font`);
    assert.match(loadedState.previewFont, new RegExp(font.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${route} ${font.label} preview must use its font`);
    assert.match(loadedState.buttonFont, /Segoe Script|Bradley Hand|URW Chancery L|cursive/, `${route} ${font.label} button must have a handwriting fallback`);
    assert.match(loadedState.previewFont, /Segoe Script|Bradley Hand|URW Chancery L|cursive/, `${route} ${font.label} preview must have a handwriting fallback`);
    assert.equal(
      await page.locator(`[data-signature-font="${font.value}"]`).evaluate((button) => getComputedStyle(button).fontSize),
      font.size,
      `${route} ${font.label} font option text must be ${font.size}`,
    );
    assert.ok(Number.parseFloat(loadedState.previewSize) > 22, `${route} large typed preview must remain larger than font options`);
    typedOutputs.push(await signatureValue(page));
  }
  assert.ok(typedOutputs.every((value) => /^data:image\/png;base64,/.test(value)), `${route} typed signatures must remain PNG data URLs`);
  assert.ok(new Set(typedOutputs).size >= 2, `${route} distinct selected fonts must produce representative distinct PNG output`);
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

async function prepareHealthValidationPage(page, route) {
  await page.goto(`${baseURL}/eoi/${route}`, { waitUntil: "networkidle" });
  await page.locator("#healthInformationDate").waitFor({ state: "attached" });
  await page.fill("#healthInformationFirstName", "Preview");
  await page.fill("#healthInformationLastName", "Member");
  await page.check('input[name="healthInformationConsent"]');
}

async function validationProgress(page, route) {
  return page.evaluate((currentRoute) => {
    if (currentRoute === "part-2") return document.querySelector(".gf-page.is-active")?.getAttribute("data-page");
    if (currentRoute === "part-3") return document.querySelector("[data-part3-stage].is-stage-visible")?.getAttribute("data-part3-stage");
    return document.querySelector("[data-question-group].is-question-visible")?.getAttribute("data-question-group");
  }, route);
}

async function assertValidationBlocked(page, route, label) {
  const nextSelector = route === "part-2" ? "[data-next]" : route === "part-3" ? "#part3-next" : "#part4-next";
  await page.locator(nextSelector).click();
  assert.equal(await validationProgress(page, route), "0", `${route} ${label} must be blocked by signature validation`);
  const errorSelector = route === "part-2" ? "[data-signature-field] .gf-error.is-visible" : route === "part-3" ? "#part3-error" : "#part4-error";
  assert.equal(await page.locator(errorSelector).isVisible(), true, `${route} ${label} must expose the existing validation error`);
}

async function assertParts34SignatureValidation(page, route) {
  await prepareHealthValidationPage(page, route);
  assert.equal(await page.locator("[data-health-information-notice]").getAttribute("data-signature-current-mode"), "", `${route} must start without a signature method`);
  assert.equal(await page.locator("[data-health-information-notice]").getAttribute("data-signature-valid"), "false", `${route} must start unsigned`);
  await assertValidationBlocked(page, route, "initial unselected method");

  await page.getByRole("button", { name: "Draw signature" }).click();
  await assertValidationBlocked(page, route, "empty Draw method");

  await page.getByRole("button", { name: "Choose a font" }).click();
  await page.locator("[data-clear-signature]").click();
  await assertValidationBlocked(page, route, "empty Type method");

  await page.getByRole("button", { name: "Choose a font" }).click();
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await page.getByRole("button", { name: "Draw signature" }).click();
  assert.equal(await signatureValue(page), "", `${route} Typed -> Draw must clear the previous signature`);
  await assertValidationBlocked(page, route, "Typed -> Draw without a new stroke");
  await drawWithPointer(page);
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await page.locator(route === "part-3" ? "#part3-next" : "#part4-next").click();
  assert.equal(await validationProgress(page, route), "1", `${route} current Draw signature must pass validation`);

  await prepareHealthValidationPage(page, route);
  await page.getByRole("button", { name: "Draw signature" }).click();
  await drawWithPointer(page);
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await page.getByRole("button", { name: "Choose a font" }).click();
  await page.locator("[data-clear-signature]").click();
  assert.equal(await signatureValue(page), "", `${route} Draw -> Type and Clear must remove stale drawing output`);
  await assertValidationBlocked(page, route, "Draw -> Type before typed output");
  await page.locator("[data-signature-font]").first().click();
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await page.locator(route === "part-3" ? "#part3-next" : "#part4-next").click();
  assert.equal(await validationProgress(page, route), "1", `${route} current Type signature must pass validation`);

  await prepareHealthValidationPage(page, route);
  await page.getByRole("button", { name: "Draw signature" }).click();
  await drawWithPointer(page);
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await page.locator("[data-clear-signature]").click();
  assert.equal(await signatureValue(page), "", `${route} Clear Signature must clear the current output`);
  await assertValidationBlocked(page, route, "cleared signature");
}

async function assertParts34SameMethodLifecycle(page, route) {
  await prepareHealthValidationPage(page, route);
  await page.getByRole("button", { name: "Draw signature" }).click();
  await drawWithPointer(page);
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  const firstDraw = await signatureFields(page);
  await page.getByRole("button", { name: "Draw signature" }).click();
  const resetDraw = await signatureFields(page);
  assert.equal(resetDraw.mode, "draw", `${route} same-method Draw reset must retain the selected mode`);
  assert.equal(resetDraw.valid, "false", `${route} same-method Draw reset must invalidate current signature state`);
  assert.equal((await canvasState(page)).alphaPixels, 0, `${route} same-method Draw reset must empty the canvas`);
  assertEmptySignatureFields(resetDraw, `${route} same-method Draw reset`);
  await assertValidationBlocked(page, route, "same-method Draw reset");

  await drawWithPointer(page);
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  const freshDraw = await signatureFields(page);
  assert.notEqual(freshDraw.stampID, firstDraw.stampID, `${route} fresh Draw after same-method reset must receive a new audit identity`);
  assert.equal(await validationProgress(page, route), "0");
  await page.locator(route === "part-3" ? "#part3-next" : "#part4-next").click();
  assert.equal(await validationProgress(page, route), "1", `${route} fresh Draw after same-method reset must pass validation`);

  await prepareHealthValidationPage(page, route);
  await page.getByRole("button", { name: "Choose a font" }).click();
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  const firstType = await signatureFields(page);
  await page.getByRole("button", { name: "Choose a font" }).click();
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  const freshType = await signatureFields(page);
  assert.equal(freshType.valid, "true", `${route} Type re-selection must end with a newly generated current signature`);
  assert.notEqual(freshType.stampID, firstType.stampID, `${route} Type re-selection must not preserve the old audit identity`);
}

async function assertParts34AccessibilityTransitions(page, route) {
  await prepareHealthValidationPage(page, route);
  await page.getByRole("button", { name: "Draw signature" }).click();
  await assertValidationBlocked(page, route, "accessibility Draw failure");
  const failedDraw = await page.evaluate(() => ({
    invalid: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-invalid"),
    describedBy: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-describedby"),
  }));
  assert.equal(failedDraw.invalid, "true", `${route} failed Draw validation must mark the active canvas invalid`);
  assert.ok(failedDraw.describedBy, `${route} failed Draw validation must link the active canvas to its error`);

  await page.getByRole("button", { name: "Choose a font" }).click();
  const afterDrawToType = await page.evaluate(() => ({
    hidden: document.querySelector("canvas[data-signature-pad]")?.hidden,
    invalid: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-invalid"),
    describedBy: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-describedby"),
    errorVisible: [...document.querySelectorAll("[role='alert']")].some((element) => !element.hasAttribute("hidden")),
  }));
  assert.equal(afterDrawToType.hidden, true, `${route} Draw control must be hidden after switching to Type`);
  assert.equal(afterDrawToType.invalid, null, `${route} hidden Draw control must clear aria-invalid after switching to Type`);
  assert.equal(afterDrawToType.describedBy, null, `${route} hidden Draw control must clear aria-describedby after switching to Type`);
  assert.equal(afterDrawToType.errorVisible, false, `${route} obsolete Draw error must clear after switching to Type`);

  await page.locator("[data-clear-signature]").click();
  await assertValidationBlocked(page, route, "accessibility Type failure");
  const failedType = await page.evaluate(() => ({
    invalid: document.querySelector("[data-signature-font][aria-pressed='true']")?.getAttribute("aria-invalid"),
    describedBy: document.querySelector("[data-signature-font][aria-pressed='true']")?.getAttribute("aria-describedby"),
  }));
  assert.equal(failedType.invalid, "true", `${route} failed Type validation must mark the active font control invalid`);
  assert.ok(failedType.describedBy, `${route} failed Type validation must link the active font control to its error`);

  await page.getByRole("button", { name: "Draw signature" }).click();
  const afterTypeToDraw = await page.evaluate(() => ({
    invalid: document.querySelector("[data-signature-font][aria-pressed='true']")?.getAttribute("aria-invalid"),
    describedBy: document.querySelector("[data-signature-font][aria-pressed='true']")?.getAttribute("aria-describedby"),
    errorVisible: [...document.querySelectorAll("[role='alert']")].some((element) => !element.hasAttribute("hidden")),
  }));
  assert.equal(afterTypeToDraw.invalid, null, `${route} inactive Type control must clear aria-invalid after switching to Draw`);
  assert.equal(afterTypeToDraw.describedBy, null, `${route} inactive Type control must clear aria-describedby after switching to Draw`);
  assert.equal(afterTypeToDraw.errorVisible, false, `${route} obsolete Type error must clear after switching to Draw`);
}

async function assertPart2SameMethodInvalidation(page) {
  await prepareHealthValidationPage(page, "part-2");
  await page.getByRole("button", { name: "Draw signature" }).click();
  await drawWithPointer(page);
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await page.getByRole("button", { name: "Draw signature" }).click();
  const invalidated = await page.evaluate(() => Object.fromEntries([
    "healthInformationSignature",
    "healthInformationSignatureSvg",
    "healthInformationSignatureFileName",
    "healthInformationSignatureSignedAt",
    "healthInformationSignatureDocumentID",
  ].map((id) => [id, document.getElementById(id)?.value || ""])));
  assert.equal(await page.locator("[data-health-information-notice]").getAttribute("data-signature-valid"), "false");
  assert.deepEqual(invalidated, {
    healthInformationSignature: "",
    healthInformationSignatureSvg: "",
    healthInformationSignatureFileName: "",
    healthInformationSignatureSignedAt: "",
    healthInformationSignatureDocumentID: "",
  }, "Part 2 method re-selection must clear all stale signature outputs");
  await assertValidationBlocked(page, "part-2", "same-method Draw re-selection without a new stroke");

  await drawWithPointer(page);
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await page.locator("[data-next]").click();
  assert.equal(await page.locator(".gf-page.is-active").getAttribute("data-page"), "1", "Part 2 fresh Draw after invalidation must pass");
}

async function assertPart2AccessibilityTransitions(page) {
  await prepareHealthValidationPage(page, "part-2");
  await page.getByRole("button", { name: "Draw signature" }).click();
  await assertValidationBlocked(page, "part-2", "accessibility Draw failure");
  const failedDraw = await page.evaluate(() => ({
    invalid: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-invalid"),
    describedBy: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-describedby"),
    errorVisible: Boolean(document.querySelector("[data-signature-field] .gf-error.is-visible")),
  }));
  assert.equal(failedDraw.invalid, "true", "Part 2 failed Draw validation must mark the canvas invalid");
  assert.ok(failedDraw.describedBy, "Part 2 failed Draw validation must reference its error");
  assert.equal(failedDraw.errorVisible, true, "Part 2 failed Draw validation must show its error");

  await page.getByRole("button", { name: "Choose a font" }).click();
  const afterDrawToType = await page.evaluate(() => ({
    invalid: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-invalid"),
    describedBy: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-describedby"),
    errorVisible: Boolean(document.querySelector("[data-signature-field] .gf-error.is-visible")),
  }));
  assert.equal(afterDrawToType.invalid, null, "Part 2 hidden Draw control must clear aria-invalid synchronously");
  assert.ok(!afterDrawToType.describedBy || !afterDrawToType.describedBy.includes("gf-error-"), "Part 2 hidden Draw control must clear its stale error ID synchronously");
  assert.equal(afterDrawToType.errorVisible, false, "Part 2 stale Draw error must clear synchronously");
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));

  await page.locator("[data-clear-signature]").click();
  await assertValidationBlocked(page, "part-2", "accessibility Type failure");
  const failedType = await page.evaluate(() => ({
    canvasHidden: document.querySelector("canvas[data-signature-pad]")?.hidden,
    canvasAriaHidden: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-hidden"),
    canvasInvalid: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-invalid"),
    canvasDescribedBy: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-describedby"),
    fontInvalid: document.querySelector("[data-signature-font][aria-pressed='true']")?.getAttribute("aria-invalid"),
    fontDescribedBy: document.querySelector("[data-signature-font][aria-pressed='true']")?.getAttribute("aria-describedby"),
  }));
  assert.equal(failedType.canvasHidden, true, "Part 2 Type failure must keep the Draw canvas hidden");
  assert.equal(failedType.canvasAriaHidden, "true", "Part 2 Type failure must keep the Draw canvas hidden from assistive technology");
  assert.equal(failedType.canvasInvalid, null, "Part 2 Type failure must not mark the hidden Draw canvas invalid");
  assert.ok(!failedType.canvasDescribedBy || !failedType.canvasDescribedBy.includes("gf-error-"), "Part 2 Type failure must not link the hidden Draw canvas to the signature error");
  assert.equal(failedType.fontInvalid, "true", "Part 2 Type failure must mark the active font control invalid");
  assert.ok(failedType.fontDescribedBy?.includes("gf-error-"), "Part 2 Type failure must link the active font control to the signature error");
  await page.getByRole("button", { name: "Draw signature" }).click();
  const afterTypeToDraw = await page.evaluate(() => ({
    invalid: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-invalid"),
    describedBy: document.querySelector("canvas[data-signature-pad]")?.getAttribute("aria-describedby"),
    errorVisible: Boolean(document.querySelector("[data-signature-field] .gf-error.is-visible")),
  }));
  assert.equal(afterTypeToDraw.invalid, null, "Part 2 Draw transition must not retain stale Type validation");
  assert.ok(!afterTypeToDraw.describedBy || !afterTypeToDraw.describedBy.includes("gf-error-"), "Part 2 Draw transition must not retain a stale error ID");
  assert.equal(afterTypeToDraw.errorVisible, false, "Part 2 Draw transition must clear the stale Type error");
}

async function installFontLoadController(page) {
  await page.evaluate(() => {
    const pending = Object.create(null);
    const original = document.fonts.load;
    document.fonts.load = (descriptor) => {
      const family = descriptor.match(/"([^"]+)"/)?.[1] || descriptor;
      return new Promise((resolve, reject) => {
        (pending[family] ||= []).push({ resolve, reject });
      });
    };
    window.__gymfusionFontLoadController = { original, pending };
  });
}

async function settleFontLoad(page, family, outcome = "resolve") {
  await page.evaluate(({ family, outcome }) => {
    const request = window.__gymfusionFontLoadController?.pending[family]?.shift();
    if (!request) throw new Error(`No pending font load for ${family}`);
    if (outcome === "reject") request.reject(new Error(`Synthetic ${family} font failure`));
    else request.resolve();
  }, { family, outcome });
}

async function waitForPendingFont(page, family) {
  await page.waitForFunction((currentFamily) => Boolean(window.__gymfusionFontLoadController?.pending[currentFamily]?.length), family);
}

async function restoreFontLoadController(page) {
  await page.evaluate(() => {
    const controller = window.__gymfusionFontLoadController;
    if (!controller) return;
    document.fonts.load = controller.original;
    delete window.__gymfusionFontLoadController;
  });
}

async function assertTypedFontRace(page, route) {
  await prepareHealthValidationPage(page, route);
  await page.getByRole("button", { name: "Choose a font" }).click();
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await installFontLoadController(page);

  await page.locator('[data-signature-font="GF Thornton"]').click();
  await waitForPendingFont(page, "GF Thornton");
  assertEmptySignatureFields(await signatureFields(page), `${route} pending font change`);
  assert.equal((await signatureFields(page)).valid, "false", `${route} pending font change must be invalid`);
  await assertValidationBlocked(page, route, "pending font change");
  await settleFontLoad(page, "GF Thornton");
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  const completedThornton = await signatureFields(page);
  assert.equal(completedThornton.valid, "true", `${route} current font render must restore validity`);
  assert.equal(completedThornton.documentID, expectedSignatureMetadata[route].documentId, `${route} current font render must restore its fixed document ID`);

  await page.locator('[data-signature-font="GF Byron"]').click();
  await waitForPendingFont(page, "GF Byron");
  await page.locator('[data-signature-font="GF Indian Dunes"]').click();
  await waitForPendingFont(page, "GF Indian Dunes");
  await settleFontLoad(page, "GF Indian Dunes");
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  const completedIndianDunes = await signatureFields(page);
  await settleFontLoad(page, "GF Byron");
  await page.waitForTimeout(20);
  assert.deepEqual(await signatureFields(page), completedIndianDunes, `${route} stale earlier font render must not overwrite the latest output`);

  await page.locator('[data-signature-font="GF Roustel"]').click();
  await waitForPendingFont(page, "GF Roustel");
  await settleFontLoad(page, "GF Roustel", "reject");
  await page.waitForTimeout(20);
  assertEmptySignatureFields(await signatureFields(page), `${route} failed current font render`);
  assert.equal((await signatureFields(page)).valid, "false", `${route} failed current font render must remain invalid`);

  await page.locator('[data-signature-font="GF Signature"]').click();
  await waitForPendingFont(page, "GF Signature");
  await page.locator("[data-clear-signature]").click();
  await settleFontLoad(page, "GF Signature");
  await page.waitForTimeout(20);
  assertEmptySignatureFields(await signatureFields(page), `${route} Clear during pending font render`);

  await page.locator('[data-signature-font="GF Byron"]').click();
  await waitForPendingFont(page, "GF Byron");
  await page.getByRole("button", { name: "Draw signature" }).click();
  await settleFontLoad(page, "GF Byron");
  await page.waitForTimeout(20);
  assertEmptySignatureFields(await signatureFields(page), `${route} Type -> Draw during pending font render`);
  assert.equal((await signatureFields(page)).valid, "false", `${route} mode switch must prevent stale Type repopulation`);
  await restoreFontLoadController(page);
}

let preview;
let browser;
try {
  preview = await startPreview();
  browser = await chromium.launch({ headless: true });

  const part2ValidationPage = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await assertPart2SameMethodInvalidation(part2ValidationPage);
  await part2ValidationPage.close();

  const part2AccessibilityPage = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await assertPart2AccessibilityTransitions(part2AccessibilityPage);
  await part2AccessibilityPage.close();

  for (const route of ["part-3", "part-4"]) {
    const validationPage = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await assertParts34SignatureValidation(validationPage, route);
    await validationPage.close();

    const lifecyclePage = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await assertParts34SameMethodLifecycle(lifecyclePage, route);
    await lifecyclePage.close();

    const accessibilityPage = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await assertParts34AccessibilityTransitions(accessibilityPage, route);
    await accessibilityPage.close();
  }

  for (const route of ["part-2", "part-3", "part-4"]) {
    const fontRacePage = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await assertTypedFontRace(fontRacePage, route);
    await fontRacePage.close();
  }

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
    await page.locator("#healthInformationFirstName").fill("Élodie Jane123@😀");
    await page.locator("#healthInformationLastName").fill("Anne-Marie O'Connor2!");
    assert.equal(await page.locator("#healthInformationFirstName").inputValue(), "Élodie Jane", `${route} must preserve Unicode letters and spaces while removing invalid characters`);
    assert.equal(await page.locator("#healthInformationLastName").inputValue(), "AnneMarie OConnor", `${route} must remove punctuation, apostrophes, hyphens, digits, and emoji`);
    await page.fill("#healthInformationFirstName", "Preview");
    await page.fill("#healthInformationLastName", "Member");
    await page.check('input[name="healthInformationConsent"]');
    const initialSignatureState = await page.evaluate(() => ({
      workspaceHidden: document.querySelector("[data-signature-workspace]")?.hidden,
      fontPickerHidden: document.querySelector("[data-signature-font-options]")?.hidden,
      typedPreviewHidden: document.querySelector("[data-signature-typed-preview]")?.hidden,
      selectedMethods: [...document.querySelectorAll("[data-signature-mode][aria-pressed='true']")].length,
      signatureValue: document.querySelector("#healthInformationSignature")?.value,
    }));
    assert.equal(initialSignatureState.workspaceHidden, true, `${route} signing workspace must stay hidden until a method is selected`);
    assert.equal(await page.locator("canvas[data-signature-pad]").isVisible(), false, `${route} drawing field must stay hidden until Draw signature is selected`);
    assert.equal(await page.locator("[data-clear-signature]").isVisible(), false, `${route} Clear Signature must stay hidden until a method is selected`);
    assert.equal(initialSignatureState.fontPickerHidden, true, `${route} font choices must stay hidden until Choose a font is selected`);
    assert.equal(initialSignatureState.typedPreviewHidden, true, `${route} typed preview must stay hidden until Choose a font is selected`);
    assert.equal(initialSignatureState.selectedMethods, 0, `${route} must not preselect a signing method`);
    assert.equal(initialSignatureState.signatureValue, "", `${route} must not create a signature result before a method is selected`);
    await page.getByRole("button", { name: "Draw signature" }).click();
    assert.equal(await page.locator("[data-signature-workspace]").isVisible(), true, `${route} signing workspace must appear after Draw signature is selected`);
    assert.equal(await page.locator("canvas[data-signature-pad]").isVisible(), true, `${route} drawing field must appear after Draw signature is selected`);
    assert.equal(await page.locator("[data-clear-signature]").isVisible(), true, `${route} Clear Signature must appear after Draw signature is selected`);
    await assertSignatureSpacing(page, route);
    await page.locator("canvas[data-signature-pad]").scrollIntoViewIfNeeded();
    await waitForDrawableCanvas(page, route);

    const dateState = await page.evaluate(() => {
      const label = document.querySelector('label[for="healthInformationDateTrigger"]');
      return {
        indicatorCount: label?.querySelectorAll(".gf-required-indicator").length ?? 0,
        indicatorText: label?.querySelector(".gf-required-indicator")?.textContent,
      };
    });
    assert.equal(dateState.indicatorCount, 1, `${route} Date must have exactly one required indicator`);
    assert.equal(dateState.indicatorText, "*", `${route} Date required indicator must be an asterisk`);
    if (route === "part-2") {
      const subtitleState = await page.evaluate(() => {
        const subtitle = document.querySelector(".gf-header .gf-intro");
        return { text: subtitle?.textContent?.trim(), size: getComputedStyle(subtitle).fontSize };
      });
      assert.equal(subtitleState.text, "Complete this profile so GYMFUSION can support safe and appropriate coaching. This information is treated as private health information and is intended for staff review only.", "Part 2 subtitle text must remain unchanged");
      assert.equal(subtitleState.size, "16px", "Part 2 subtitle must be 16px");
    }

    await page.locator("[data-clear-signature]").click();
    await drawSyntheticStroke(page, [{ x: 40, y: 90 }], { pointerType: "pen", pressures: [0.6] });
    assert.ok((await canvasState(page)).alphaPixels > 0, `${route} single-point pen stroke must remain visible`);

    await page.locator("[data-clear-signature]").click();
    await drawSyntheticStroke(page, [{ x: 40, y: 90 }, { x: 46, y: 92 }], { pointerType: "mouse", pressures: [0, 0] });
    assert.ok((await canvasState(page)).alphaPixels > 0, `${route} short mouse stroke must remain visible`);

    await page.locator("[data-clear-signature]").click();
    const horizontalPoints = Array.from({ length: 80 }, (_, index) => ({ x: 30 + index * 4, y: 100 }));
    const pressureRamp = horizontalPoints.map((_, index) => index < 40 ? 0.12 : 0.9);
    await drawSyntheticStroke(page, horizontalPoints, { pointerType: "pen", pressures: pressureRamp });
    const pressureWidth = await horizontalWidthRange(page);
    assert.ok(pressureWidth.max - pressureWidth.min >= 2, `${route} pressure stroke must have measurable width variation`);
    assert.ok((await canvasState(page)).alphaPixels > 0, `${route} dense pressure stroke must remain visible`);

    await page.locator("[data-clear-signature]").click();
    const touchPoints = [{ x: 50, y: 120 }, { x: 110, y: 80 }, { x: 170, y: 120 }];
    await drawSyntheticStroke(page, touchPoints, { pointerType: "touch", pressures: [0.5, 0.5, 0.5] });
    assert.ok((await canvasState(page)).alphaPixels > 0, `${route} touch-emulated stroke must remain visible`);

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
    const firstExport = await assertSignatureMetadata(page, route);
    await page.locator("[data-clear-signature]").click();
    await page.waitForFunction(() => [
      "healthInformationSignature",
      "healthInformationSignatureSvg",
      "healthInformationSignatureFileName",
      "healthInformationSignatureSignedAt",
      "healthInformationSignatureDocumentID",
    ].every((id) => document.getElementById(id)?.value === ""));
    await page.waitForTimeout(2);
    const newRedrawStroke = await drawWithPointer(page);
    await assertVisibleStroke(page, route, newRedrawStroke);
    const secondExport = await assertSignatureMetadata(page, route);
    assert.notEqual(secondExport.stampID, firstExport.stampID, `${route} new signatures must receive a new unique stamp ID`);
    assert.notEqual(secondExport.signedAt, firstExport.signedAt, `${route} new signatures must receive a new Signed timestamp`);
    const beforeTypeState = await canvasState(page);

    await page.getByRole("button", { name: "Choose a font" }).click();
    await assertTypeFontPicker(page, route);
    await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
    await assertSignatureMetadata(page, route);
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
    await page.fill("#healthInformationFirstName", "Preview");
    await page.fill("#healthInformationLastName", "Member");
    await page.check('input[name="healthInformationConsent"]');
    await page.getByRole("button", { name: "Choose a font" }).click();
    const pickerLayout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      buttons: [...document.querySelectorAll("[data-signature-font]")].map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, left: rect.left, right: rect.right, text: button.textContent.trim() };
      }),
    }));
    assert.ok(pickerLayout.documentWidth <= pickerLayout.viewportWidth + 1, `${width}px font picker must not introduce horizontal overflow`);
    assert.equal(pickerLayout.buttons.length, 6, `${width}px font picker must expose all six choices`);
    assert.ok(pickerLayout.buttons.every(({ width: buttonWidth, left, right }) => buttonWidth > 0 && left >= -1 && right <= pickerLayout.viewportWidth + 1), `${width}px font picker buttons must fit the viewport`);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      `${width}px must not introduce horizontal overflow`,
    );
    await page.close();
  }

  console.log("signature browser tests passed");
} finally {
  await browser?.close();
  await stopTestPreview(preview);
}
