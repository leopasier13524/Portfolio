import { chromium } from 'playwright';

function fiberKeys(el) {
  return Object.keys(el).filter((k) => /react|fiber|props/i.test(k));
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })).newPage();
await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(400);
const t0 = await page.evaluate(() => document.querySelector('[data-splash-counter]')?.textContent || null);
await page.waitForTimeout(1500);
const mid = await page.evaluate(() => {
  const skip = document.querySelector('[aria-label="Skip introduction"]');
  const keys = skip ? Object.keys(skip).filter((k) => /react|fiber|props/i.test(k)) : [];
  return {
    counter: document.querySelector('[data-splash-counter]')?.textContent || null,
    skipFocused: skip ? document.activeElement === skip : false,
    skipFiberKeys: keys,
    skipHasFiber: keys.length > 0,
  };
});
await page.getByRole('button', { name: /skip introduction/i }).click();
await page.waitForTimeout(900);
const after = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Primary"]');
  const h1 = document.querySelector('h1');
  return {
    skipGone: !document.querySelector('[aria-label="Skip introduction"]'),
    navOp: nav ? getComputedStyle(nav).opacity : null,
    h1: h1 ? h1.innerText.replace(/\s+/g, ' ').trim() : null,
  };
});
console.log(JSON.stringify({
  counterStart: t0,
  counterAfter1_5s: mid.counter,
  counterMoved: t0 !== mid.counter,
  skipFocused: mid.skipFocused,
  skipHasFiber: mid.skipHasFiber,
  skipFiberKeys: mid.skipFiberKeys,
  after,
  homeOk: /Hi! I'm Mateo/i.test(after.h1 || ''),
}, null, 2));
await browser.close();
