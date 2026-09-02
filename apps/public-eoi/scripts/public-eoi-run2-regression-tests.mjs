import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = {
  page: path.join(root, 'src/pages/index.astro'),
  desktopHtml: path.join(root, 'public/desktop-eoi-part-1.html'),
  mobileHtml: path.join(root, 'public/mobile-eoi-part-1.html'),
  desktopCss: path.join(root, 'public/desktop.css'),
  mobileCss: path.join(root, 'public/mobile.css'),
  desktopJs: path.join(root, 'public/desktop.js'),
  mobileJs: path.join(root, 'public/mobile.js'),
};

const [page, desktopHtml, mobileHtml, desktopCss, mobileCss, desktopJs, mobileJs] = await Promise.all([
  readFile(files.page, 'utf8'),
  readFile(files.desktopHtml, 'utf8'),
  readFile(files.mobileHtml, 'utf8'),
  readFile(files.desktopCss, 'utf8'),
  readFile(files.mobileCss, 'utf8'),
  readFile(files.desktopJs, 'utf8'),
  readFile(files.mobileJs, 'utf8'),
]);

assert.ok(desktopHtml.includes('65+'));
assert.ok(mobileHtml.includes('65+'));
assert.ok(!desktopHtml.includes('64+'));
assert.ok(!mobileHtml.includes('64+'));
assert.ok(desktopHtml.includes('Parts 2, 3 and 4'));
assert.ok(mobileHtml.includes('Parts 2, 3 and 4'));
assert.ok(desktopHtml.includes('https://www.gymfusion.com.au/privacy-policy'));
assert.ok(mobileHtml.includes('https://www.gymfusion.com.au/privacy-policy'));

assert.ok(page.includes('gf-member-nav-intent'));
assert.ok(page.includes('portal.gymfusion.com.au/login'));
assert.ok(page.includes('portal.gymfusion.com.au/members'));
assert.ok(page.includes("action === 'login'"));
assert.ok(page.includes("action === 'portal'"));

assert.ok(desktopCss.includes('/assets/desktop-eoi-part-1-assets/menu-icon.png'));
assert.ok(mobileCss.includes('/assets/mobile-eoi-part-1-form-assets/icons/menu-icon.png'));
assert.ok(desktopJs.includes('/assets/desktop-eoi-part-1-assets/menu-icon.png'));
assert.ok(desktopJs.includes('/assets/desktop-eoi-part-1-assets/handwave-fallback-icon.png'));
assert.ok(mobileJs.includes('/assets/mobile-eoi-part-1-form-assets/icons/accessibility-button-icon.svg'));
assert.ok(mobileJs.includes('/assets/mobile-eoi-part-1-form-assets/icons/menu-icon.png'));
assert.ok(desktopJs.includes('const timeoutMs = 1200'));
assert.ok(mobileJs.includes('const timeoutMs = 1200'));
assert.ok(desktopJs.includes('setManualMode(mode, true, true);'));
assert.ok(mobileJs.includes('setManualMode(mode, true, true);'));
assert.ok(!mobileJs.includes('resetCheckboxSlide(targetIndex)'));
assert.ok(desktopHtml.includes('name="sex_at_birth" required=""'));
assert.ok(mobileHtml.includes('name="sex_at_birth" required=""'));
assert.ok(desktopHtml.includes('Prefer not to say'));
assert.ok(mobileHtml.includes('Prefer not to say'));

console.log('PASS run2-regression');
