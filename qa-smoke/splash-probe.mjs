import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })).newPage();
await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1000);
const before = await page.evaluate(() => ({
  skip: !!document.querySelector('[aria-label="Skip introduction"]'),
  counter: document.querySelector('[data-splash-counter]')?.textContent,
  navOp: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
  focused: document.activeElement && document.activeElement.getAttribute('aria-label'),
}));
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
const afterEsc = await page.evaluate(() => ({
  skip: !!document.querySelector('[aria-label="Skip introduction"]'),
  navOp: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
  counter: document.querySelector('[data-splash-counter]')?.textContent,
}));
if (afterEsc.navOp === '0' || afterEsc.navOp === null) {
  const b = page.getByRole('button', { name: /skip introduction/i });
  if (await b.count()) await b.click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
}
const afterClick = await page.evaluate(() => ({
  skip: !!document.querySelector('[aria-label="Skip introduction"]'),
  navOp: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
  counter: document.querySelector('[data-splash-counter]')?.textContent,
}));
console.log(JSON.stringify({ before, afterEsc, afterClick, handedOff: afterClick.navOp && afterClick.navOp !== '0' }, null, 2));
await browser.close();
