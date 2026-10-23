// Renders the social cards from card.html with the page's own fonts, logo and
// screenshots. Run from the repo root:
//
//   PLAYWRIGHT_BROWSERS_PATH=… node docs/social/make.mjs
//
// Each card is drawn at 2x and halved, so the type stays crisp at the small sizes
// the platforms actually show.
import { chromium } from '/home/k/Code/ghosted/node_modules/@playwright/test/index.mjs';

const CARD = new URL('./card.html', import.meta.url).href;
const OUT = new URL('./', import.meta.url).pathname;
const SIZES = {
  'og-1200x630': { width: 1200, height: 630 },
  'github-1280x640': { width: 1280, height: 640 },
  'square-1080': { width: 1080, height: 1080 },
};

const browser = await chromium.launch({ headless: true });
for (const [name, size] of Object.entries(SIZES)) {
  const format = name.split('-')[0];
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${CARD}?format=${format}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}${name}@2x.png` });
  console.log('rendered', name, `${size.width}x${size.height} @2x`);
  await ctx.close();
}
await browser.close();
