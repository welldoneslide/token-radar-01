// Screenshot helper for token-radar-01.
// Usage:
//   node scripts/screenshot.mjs <url-or-file-path> <output.png> [width] [height]
// Examples (run from the repo root, after the dashboard is built to <out>/):
//   node scripts/screenshot.mjs file://$PWD/../radar-out/dashboard/index.html screenshots/1-board.png
//   node scripts/screenshot.mjs "file://$PWD/../radar-out/dashboard/index.html#p=steakhouse-financial" screenshots/2-detail.png
//   node scripts/screenshot.mjs "file://$PWD/../radar-out/dashboard/index.html#category=Risk%20Curators" screenshots/3-filtered.png
// The dashboard reads its state from the URL hash: #p=<slug> opens a detail
// drawer, #q=<text> searches, #category=<name> filters by category.
// Requires Chromium for Testing r1255 installed for Playwright (see SCREENSHOT.md).
// Env: CHROME_PATH overrides the browser binary (default: Playwright's cache).
import { chromium } from 'playwright';

const [url, out, w = '1280', h = '800'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/screenshot.mjs <url> <output.png> [width] [height]');
  process.exit(2);
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
console.log('OK', out);
