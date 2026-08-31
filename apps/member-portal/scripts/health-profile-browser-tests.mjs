import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseURL = "http://127.0.0.1:4327";
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const distRoot = resolve(appRoot, "dist");
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", baseURL).pathname;
    let filePath = resolve(distRoot, `.${pathname}`);
    assert.ok(filePath === distRoot || filePath.startsWith(`${distRoot}${sep}`));
    if ((await stat(filePath)).isDirectory()) filePath = resolve(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

async function drawSignature(page) {
  const canvas = page.locator("canvas[data-signature-pad]");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box, "signature canvas must be visible");
  await page.mouse.move(box.x + 45, box.y + 105);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 8 });
  await page.mouse.move(box.x + 205, box.y + 125, { steps: 8 });
  await page.mouse.up();
}

let browser;
try {
  await new Promise((resolveListen) => server.listen(4327, "127.0.0.1", resolveListen));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  page.setDefaultTimeout(10_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "native health profile route must render");
  assert.equal(await page.locator("iframe").count(), 0, "Astro form must not use an iframe");
  await page.locator("canvas[data-signature-pad]").waitFor();
  assert.equal(
    await page.locator("[data-signature-provider='@shadix-ui/signature-pad']").count(),
    1,
    "Shadix signature pad must be mounted",
  );
  await page.locator("[data-datetimepicker-provider='@shadix-ui/datetimepicker'][data-datetimepicker-ready='true']").waitFor();
  const expectedDate = await page.evaluate(() => {
    const date = new Date();
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return offsetDate.toISOString().slice(0, 10);
  });
  assert.equal(await page.locator("#healthInformationDate").inputValue(), expectedDate);
  assert.equal(await page.locator("input[type='date']").count(), 0, "native date input must be replaced");

  await page.locator("#healthInformationDateTrigger").click();
  assert.equal(await page.locator("[role='dialog'][aria-label='Choose date']").count(), 1);
  const alternateDate = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return offsetDate.toISOString().slice(0, 10);
  });
  assert.equal(
    await page.locator(":focus").getAttribute("data-date-value"),
    expectedDate,
    "opening the calendar must focus the selected date",
  );
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(
    (date) => document.activeElement?.getAttribute("data-date-value") === date,
    alternateDate,
  );
  assert.equal(
    await page.locator(":focus").getAttribute("data-date-value"),
    alternateDate,
    "arrow keys must move calendar focus by date",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#healthInformationDate").inputValue(), alternateDate);

  await page.locator("#healthInformationFirstName").fill("Jamie");
  await page.locator("#healthInformationFirstName").press("Enter");
  assert.equal(
    await page.locator(".gf-page.is-active").getAttribute("data-page"),
    "0",
    "Enter must not advance or submit the form",
  );

  await drawSignature(page);
  const signatureInput = page.locator("#healthInformationSignature");
  await assert.doesNotReject(async () => {
    await signatureInput.waitFor({ state: "attached" });
    await page.waitForFunction(() => {
      const input = document.querySelector("#healthInformationSignature");
      return input instanceof HTMLInputElement && input.value.startsWith("data:image/png;base64,");
    });
  }, "drawing must produce a PNG data URL");
  assert.match(await page.locator("#healthInformationSignatureFileName").inputValue(), /\.png$/);
  assert.match(await page.locator("#healthInformationSignatureSvg").inputValue(), /data:image\/png;base64,/);

  await page.evaluate(() => {
    const NativeImage = window.Image;
    window.__nativeImage = NativeImage;
    window.__pendingSignatureImageLoads = [];
    window.Image = function DelayedImage(...args) {
      const image = new NativeImage(...args);
      let delayedOnload = null;
      Object.defineProperty(image, "onload", {
        configurable: true,
        get: () => delayedOnload,
        set: (handler) => { delayedOnload = handler; },
      });
      image.addEventListener("load", () => {
        window.__pendingSignatureImageLoads.push(() => delayedOnload?.call(image));
      });
      return image;
    };
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForFunction(() => window.__pendingSignatureImageLoads?.length === 1);
  await page.locator("[data-clear-signature]").click();
  const signatureInkAfterDelayedRestore = await page.evaluate(() => {
    window.__pendingSignatureImageLoads.shift()?.();
    window.Image = window.__nativeImage;
    const canvas = document.querySelector("canvas[data-signature-pad]");
    const context = canvas.getContext("2d");
    return context.getImageData(0, 0, canvas.width, canvas.height).data.some((channel, index) => index % 4 === 3 && channel !== 0);
  });
  assert.equal(signatureInkAfterDelayedRestore, false, "clearing must cancel a pending signature redraw");
  await page.waitForFunction(() => {
    const input = document.querySelector("#healthInformationSignature");
    return input instanceof HTMLInputElement && input.value === "";
  });
  assert.equal(await page.locator("#healthInformationSignatureSignedAt").inputValue(), "");
  assert.equal(await page.locator("#healthInformationSignatureDocumentID").inputValue(), "");

  const signatureCanvas = page.locator("canvas[data-signature-pad]");
  await signatureCanvas.focus();
  await signatureCanvas.press("Enter");
  await signatureCanvas.press("ArrowRight");
  await signatureCanvas.press("ArrowUp");
  await signatureCanvas.press("ArrowRight");
  await signatureCanvas.press("ArrowDown");
  await signatureCanvas.press("Enter");
  await page.waitForFunction(() => document.querySelector("#healthInformationSignature")?.value.startsWith("data:image/png;base64,"));
  await page.locator("[data-clear-signature]").click();

  await page.reload();
  await page.locator("[data-next]").click();
  assert.equal(await page.locator(".gf-error.is-visible").count(), 4, "all missing Step 1 fields must show errors");
  assert.equal(
    await page.locator(".gf-signature-pad.gf-invalid").count(),
    1,
    "the visible signature pad must show its invalid state",
  );
  const firstNameErrorId = await page.locator("#healthInformationFirstName").getAttribute("aria-describedby");
  assert.equal(await page.locator("#healthInformationFirstName").getAttribute("aria-invalid"), "true");
  assert.ok(firstNameErrorId, "invalid controls must reference their error message");
  assert.equal(await page.locator(`#${firstNameErrorId}`).count(), 1);
  assert.equal(await page.locator("canvas[data-signature-pad]").getAttribute("aria-invalid"), "true");

  await page.locator("#healthInformationFirstName").fill("Jamie");
  await page.locator("#healthInformationLastName").fill("Nguyen");
  await page.locator("input[name='healthInformationConsent']").check();
  await drawSignature(page);
  await page.locator("[data-next]").click();
  assert.equal(await page.locator(".gf-page.is-active").getAttribute("data-page"), "1");
  await page.locator("input[name='heartConditionStroke'][value='No']").check();
  await page.locator("input[name='chestPainDiscomfort'][value='No']").check();
  await page.locator("input[name='dizzyBalanceEpisodes'][value='No']").check();
  await page.locator("[data-next]").click();
  assert.equal(await page.locator(".gf-page.is-active").getAttribute("data-page"), "2");

  const breathingCases = [
    ["Asthma", "asthma"],
    ["COPD", "airway"],
    ["OSA", "airway"],
    ["Long Covid", "airway"],
    ["Chronic Bronchitis", "airway"],
    ["None", "none"],
    ["Other", "other multiple"],
  ];
  for (const [condition, expectedBranch] of breathingCases) {
    const inputs = page.locator("input[name='breathingConditions']");
    for (let index = 0; index < await inputs.count(); index += 1) {
      if (await inputs.nth(index).isChecked()) await inputs.nth(index).uncheck();
    }
    await page.locator(`input[name='breathingConditions'][value='${condition}']`).check();
    assert.equal(
      await page.locator(`.gf-followup-item[data-show-when-breathing-followup='${expectedBranch}'].is-visible`).count(),
      1,
      `${condition} must show its assigned breathing follow-up`,
    );
    assert.equal(
      await page.locator(".gf-followup-item[data-show-when-breathing-followup].is-visible").count(),
      1,
      `${condition} must show one breathing follow-up only`,
    );
    if (condition === "Other") {
      assert.equal(await page.locator("#breathingConditionOther:visible").count(), 1, "Other must request specification");
      assert.equal(await page.locator("#breathingConditionOther").getAttribute("required"), "");
    }
  }

  await page.locator("input[name='breathingConditions'][value='Other']").uncheck();
  assert.equal(await page.locator("#breathingConditionOther").inputValue(), "", "hidden Other details must be cleared");
  await page.locator("input[name='breathingConditions'][value='None']").check();
  await page.locator("input[name='breathingConditions'][value='Asthma']").check();
  assert.equal(await page.locator("input[name='breathingConditions'][value='None']").isChecked(), true);
  assert.equal(await page.locator("input[name='breathingConditions'][value='Asthma']").isChecked(), true);
  assert.equal(await page.locator("[data-show-when-breathing-followup='other multiple'].is-visible").count(), 1);
  assert.equal(await page.locator(".gf-followup-item[data-show-when-breathing-followup].is-visible").count(), 1);

  const mobilePage = await browser.newPage({ viewport: { width: 320, height: 700 } });
  await mobilePage.goto(baseURL, { waitUntil: "domcontentloaded" });
  await mobilePage.locator("[data-datetimepicker-ready='true']").waitFor();
  await mobilePage.locator("#healthInformationDateTrigger").scrollIntoViewIfNeeded();
  await mobilePage.locator("#healthInformationDateTrigger").click();
  const [shellBox, pickerBox] = await Promise.all([
    mobilePage.locator(".gf-shell").boundingBox(),
    mobilePage.locator("[aria-label='Choose date']").boundingBox(),
  ]);
  assert.ok(shellBox && pickerBox, "mobile shell and date picker must be visible");
  assert.ok(pickerBox.x >= shellBox.x, "date picker must not clip past the mobile shell's left edge");
  assert.ok(
    pickerBox.x + pickerBox.width <= shellBox.x + shellBox.width,
    "date picker must not clip past the mobile shell's right edge",
  );
  await mobilePage.close();
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);

  console.log("health-profile browser tests passed");
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
