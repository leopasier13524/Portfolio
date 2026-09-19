import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));

async function run(label, opts) {
  console.log('\n====', label, '====');
  const browser = await chromium.launch({ headless: opts.headless, channel: opts.channel });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    reducedMotion: opts.reducedMotion || 'no-preference',
  });
  const page = await context.newPage();
  await page.route('**/webpack-hmr**', (route) => route.abort());
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => ({
    skip: !!document.querySelector('[aria-label="Skip introduction"]'),
    navOp: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
  }));
  console.log('before', before);
  const clicked = await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Skip introduction"]');
    if (!b) return false;
    b.click();
    return true;
  });
  console.log('domClick', clicked);
  await page.waitForTimeout(1200);
  const afterClick = await page.evaluate(() => ({
    skip: !!document.querySelector('[aria-label="Skip introduction"]'),
    skipShow: (() => { const b = document.querySelector('[aria-label="Skip introduction"]'); return b ? getComputedStyle(b.parentElement).pointerEvents : null; })(),
    navOp: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
    introDialog: !!document.querySelector('[aria-label="Introduction"]'),
  }));
  console.log('afterClick', afterClick);
  await page.screenshot({ path: path.join(OUT, `diag2-${label}-afterclick.png`) });
  if (afterClick.navOp === '0' || afterClick.navOp === '0.0') {
    await page.waitForTimeout(10000);
  }
  const late = await page.evaluate(() => ({
    skip: !!document.querySelector('[aria-label="Skip introduction"]'),
    navOp: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
  }));
  console.log('late', late);
  await page.screenshot({ path: path.join(OUT, `diag2-${label}-late.png`) });
  await browser.close();
  return { afterClick, late };
}

await run('headless', { headless: true });
await run('headless-prm', { headless: true, reducedMotion: 'reduce' });
try {
  await run('headed', { headless: false });
} catch (e) {
  console.log('headed failed', e.message);
}
