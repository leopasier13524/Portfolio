import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })).newPage();
await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
try { await page.getByRole('button', { name: /skip introduction/i }).waitFor({ timeout: 3000 }); await page.keyboard.press('Escape'); } catch {}
await page.waitForFunction(() => {
  const n = document.querySelector('nav[aria-label="Primary"]');
  return n && getComputedStyle(n).opacity !== '0';
});
await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click();
await page.getByRole('button', { name: 'Grid view' }).click();
await page.waitForTimeout(600);
await page.locator('[data-grid-item] button').nth(1).click();
await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: 'visible' });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const f = [...document.querySelectorAll('[role="dialog"] figure')].find((el) => !el.hasAttribute('data-overlay-hero'));
  f?.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(400);
const gallery = await page.evaluate(() => {
  const figs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"] figure')]
    .filter((f) => !f.hasAttribute('data-overlay-hero'));
  const boxes = figs.map((f) => {
    const r = f.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), op: getComputedStyle(f).opacity };
  });
  let sideBySide = false;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (Math.abs(boxes[i].y - boxes[j].y) < 100 && boxes[i].x !== boxes[j].x) sideBySide = true;
    }
  }
  const maxW = boxes.reduce((m, b) => Math.max(m, b.w), 0);
  return { count: boxes.length, boxes, sideBySide, maxW, vw: innerWidth, small: maxW > 0 && maxW < innerWidth * 0.7 };
});
await page.screenshot({ path: path.join(OUT, 't25-05-mealli-gallery.png') });
console.log(JSON.stringify(gallery, null, 2));
await browser.close();
