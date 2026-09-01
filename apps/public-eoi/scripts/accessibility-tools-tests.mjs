import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobileJs = readFileSync(new URL('../public/mobile.js', import.meta.url), 'utf8');
const desktopJs = readFileSync(new URL('../public/desktop.js', import.meta.url), 'utf8');
const desktopCss = readFileSync(new URL('../public/desktop.css', import.meta.url), 'utf8');
const indexAstro = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

const test = (name, callback) => {
  try {
    callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
};

test('mobile and desktop reduce motion defaults are off', () => {
  assert.match(mobileJs, /motion:\s*false/);
  assert.match(desktopJs, /motion:\s*false/);
});

test('accessibility preferences reset instead of persisting across refreshes', () => {
  assert.doesNotMatch(mobileJs, /localStorage/);
  assert.doesNotMatch(desktopJs, /localStorage/);
});

test('desktop dyslexia mode uses the approved open-dyslexic package', () => {
  assert.match(desktopCss, /open-dyslexic@1\.0\.3\/woff\/OpenDyslexic-Regular\.woff/);
});

test('desktop high contrast has an implemented palette', () => {
  assert.match(desktopCss, /body\[data-a11y-contrast="high"\]/);
  assert.match(desktopCss, /--a11y-contrast-background:\s*#000000/);
  assert.match(desktopCss, /--a11y-contrast-text:\s*#ffffff/);
});

test('desktop expanded spacing increases line height consistently', () => {
  assert.match(desktopCss, /body\[data-a11y-spacing="expanded"\][\s\S]*?line-height:\s*1\.7\s*!important/);
});

test('desktop text controls use bounded form-specific scaling', () => {
  assert.match(desktopCss, /--a11y-copy-size:\s*0\.855rem/);
  assert.match(desktopCss, /--a11y-copy-size:\s*1\.0925rem/);
  assert.match(desktopCss, /body\[data-a11y-text\][\s\S]*?\.content-page/);
});

test('desktop reduce motion pauses the Astro page marquees', () => {
  assert.match(desktopJs, /gf-eoi-accessibility/);
  assert.match(indexAstro, /data-reduced-motion/);
  assert.match(indexAstro, /desktop-marquee__track[\s\S]*?animation-play-state:\s*paused\s*!important/);
});
