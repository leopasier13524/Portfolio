import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
const resp = await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle', timeout: 45000 });
console.log('status', resp && resp.status());
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, 'diag-01.png') });
const info = await page.evaluate(() => ({
  title: document.title,
  bodyLen: document.body ? document.body.innerText.slice(0, 400) : null,
  nav: !!document.querySelector('nav[aria-label="Primary"]'),
  skip: !!document.querySelector('[aria-label="Skip introduction"]'),
  dialog: !!document.querySelector('[role="dialog"]'),
  buttons: [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 20),
  canvases: document.querySelectorAll('canvas').length,
}));
console.log(JSON.stringify(info, null, 2));
await page.keyboard.press('Escape');
await page.waitForTimeout(1500);
const skip = page.getByRole('button', { name: /skip/i });
if (await skip.count()) {
  console.log('skip count', await skip.count(), 'visible', await skip.first().isVisible());
  await skip.first().click({ force: true }).catch((e) => console.log('skip click', e.message));
}
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, 'diag-02.png') });
const after = await page.evaluate(() => ({
  nav: !!document.querySelector('nav[aria-label="Primary"]'),
  navOpacity: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
  skip: !!document.querySelector('[aria-label="Skip introduction"]'),
  buttons: [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 20),
}));
console.log('AFTER', JSON.stringify(after, null, 2));
await page.waitForTimeout(10000);
await page.screenshot({ path: path.join(OUT, 'diag-03.png') });
const late = await page.evaluate(() => ({
  nav: !!document.querySelector('nav[aria-label="Primary"]'),
  navOpacity: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
  text: document.body.innerText.slice(0, 300),
}));
console.log('LATE', JSON.stringify(late, null, 2));
await browser.close();
