import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = {
  desktopHtml: path.join(root, 'public/desktop-eoi-part-1.html'),
  mobileHtml: path.join(root, 'public/mobile-eoi-part-1.html'),
  desktopJs: path.join(root, 'public/desktop.js'),
  mobileJs: path.join(root, 'public/mobile.js'),
  previewAdultRoute: path.join(root, 'src/pages/api/preview/eoi-part1-submit.js'),
  previewUnder18Route: path.join(root, 'src/pages/api/preview/under18-service-demand-submit.js'),
};

const [desktopHtml, mobileHtml, desktopJs, mobileJs] = await Promise.all([
  readFile(files.desktopHtml, 'utf8'),
  readFile(files.mobileHtml, 'utf8'),
  readFile(files.desktopJs, 'utf8'),
  readFile(files.mobileJs, 'utf8'),
]);

assert.match(desktopHtml, /data-under18-home-exit/);
assert.match(desktopHtml, /data-under18-actions/);
assert.match(mobileHtml, /data-under18-home-exit/);
assert.match(mobileHtml, /data-under18-actions/);
assert.match(desktopJs, /\/api\/preview\/eoi-part1-submit/);
assert.match(desktopJs, /\/api\/preview\/under18-service-demand-submit/);
assert.match(mobileJs, /\/api\/preview\/eoi-part1-submit/);
assert.match(mobileJs, /\/api\/preview\/under18-service-demand-submit/);
assert.match(desktopJs, /preview-turnstile-token/);
assert.match(mobileJs, /preview-turnstile-token/);
assert.match(desktopJs, /preview_under18_state/);
assert.match(desktopJs, /setUnder18View\("success"\)/);
assert.match(mobileJs, /preview_under18_state/);
assert.match(mobileJs, /setUnder18View\("success"\)/);
assert.match(desktopJs, /data-under18-actions/);
assert.match(mobileJs, /data-under18-actions/);
assert.match(desktopJs, /scrollCurrentPageToElement\(under18ActionFooter\)/);
assert.match(mobileJs, /scrollCurrentPageToElement\(under18ActionFooter\)/);
assert.match(desktopJs, /if \(isLocalTurnstileHost\(\)\) \{[\s\S]*?window\.setTimeout/);
assert.match(mobileJs, /if \(isLocalTurnstileHost\(\)\) \{[\s\S]*?window\.setTimeout/);
assert.match(desktopJs, /data-under18-home-exit/);
assert.match(mobileJs, /data-under18-home-exit/);
assert.match(desktopJs, /under18HomeExitButton\.classList\.toggle\("is-hidden", isReady\)/);
assert.match(mobileJs, /under18HomeExitButton\.classList\.toggle\("is-hidden", isReady\)/);
assert.doesNotMatch(desktopJs, /Preview human verification ready/);
assert.doesNotMatch(mobileJs, /Preview human verification ready/);

const { POST: previewAdultSubmit } = await import(pathToFileURL(files.previewAdultRoute).href);
const { POST: previewUnder18Submit } = await import(pathToFileURL(files.previewUnder18Route).href);

const previewAdultResponse = await previewAdultSubmit({
  request: new Request('http://127.0.0.1:4321/api/preview/eoi-part1-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formId: 'eoi_part1',
      formPart: 'PART_1',
      email: 'preview@example.com',
      fields: { first_name: 'Preview' },
    }),
  }),
});
const previewAdultJson = await previewAdultResponse.json();
assert.equal(previewAdultResponse.status, 200);
assert.equal(previewAdultJson.ok, true);
assert.equal(previewAdultJson.preview, true);
assert.equal(typeof previewAdultJson.episodeId, 'string');
assert.ok(previewAdultJson.episodeId.startsWith('preview-'));

const previewUnder18Response = await previewUnder18Submit({
  request: new Request('http://127.0.0.1:4321/api/preview/under18-service-demand-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turnstileToken: 'token-ok',
      submissionNonce: 'nonce-ok',
      under18AgeBand: '16-17',
    }),
  }),
});
const previewUnder18Json = await previewUnder18Response.json();
assert.equal(previewUnder18Response.status, 200);
assert.equal(previewUnder18Json.ok, true);
assert.equal(previewUnder18Json.preview, true);
assert.equal(previewUnder18Json.recordedAgeBand, '16-17');

const missingTokenResponse = await previewUnder18Submit({
  request: new Request('http://127.0.0.1:4321/api/preview/under18-service-demand-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submissionNonce: 'nonce-missing',
    }),
  }),
});
const missingTokenJson = await missingTokenResponse.json();
assert.equal(missingTokenResponse.status, 400);
assert.equal(missingTokenJson.ok, false);
assert.equal(missingTokenJson.code, 'turnstile_token_required');

const remoteBlockedResponse = await previewAdultSubmit({
  request: new Request('https://www.gymfusion.com.au/api/preview/eoi-part1-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formId: 'eoi_part1',
      formPart: 'PART_1',
      email: 'preview@example.com',
      fields: { first_name: 'Preview' },
    }),
  }),
});
assert.equal(remoteBlockedResponse.status, 404);

console.log('PASS local-preview-submit');
