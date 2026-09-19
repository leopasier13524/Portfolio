import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })).newPage();
await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
try {
  await page.getByRole('button', { name: /skip introduction/i }).waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
} catch {}
await page.waitForFunction(() => {
  const n = document.querySelector('nav[aria-label="Primary"]');
  return n && getComputedStyle(n).opacity !== '0';
});
await page.getByRole('button', { name: 'My Road', exact: true }).click();
await page.getByRole('dialog', { name: 'My Road' }).waitFor({ state: 'visible' });
const projects = page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' });
let realClick = 'ok';
try {
  await projects.click({ timeout: 3000 });
} catch (e) {
  realClick = e.message.split('\n')[0];
}
await page.waitForTimeout(400);
const state = await page.evaluate(() => ({
  road: !!document.querySelector('[role="dialog"][aria-label="My Road"]'),
  navZ: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).zIndex : null; })(),
  roadZ: (() => { const d = document.querySelector('[role="dialog"][aria-label="My Road"]'); return d ? getComputedStyle(d).zIndex : null; })(),
}));
console.log(JSON.stringify({ realClick, state }, null, 2));
await browser.close();
