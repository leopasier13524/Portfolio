import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = 'http://localhost:3000';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.getByRole('navigation', { name: 'Primary' }).waitFor({ state: 'visible', timeout: 120000 });
await page.waitForFunction(() => {
  const n = document.querySelector('nav[aria-label="Primary"]');
  if (!n) return false;
  const s = getComputedStyle(n);
  return s.opacity !== '0' && s.pointerEvents !== 'none';
}, null, { timeout: 120000 });

await page.getByRole('button', { name: /^Projects$/i }).click();
await page.waitForTimeout(1500);
const wall = page.getByRole('button', { name: /wall/i });
if (await wall.count()) { await wall.click(); await page.waitForTimeout(800); }

// Probe gallery internal state via monkeypatch? Instead instrument by evaluating after injecting hooks.
// We'll open a project by clicking center of canvas (raycast click), wait for Close, close, then probe.
const canvas = page.locator('canvas').first();
await canvas.waitFor({ state: 'visible', timeout: 30000 });

// Click canvas center to open a card (tap, not drag)
const box = await canvas.boundingBox();
if (!box) throw new Error('no canvas box');
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
await page.waitForTimeout(2500);

const closeBtn = page.getByRole('button', { name: /close/i });
const opened = await closeBtn.isVisible().catch(() => false);
await page.screenshot({ path: path.join(OUT, 'wall-stuck-01-open.png') });

if (!opened) {
  // try a few offsets
  for (const [fx, fy] of [[0.35,0.4],[0.65,0.4],[0.5,0.55],[0.4,0.5],[0.6,0.5]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(2000);
    if (await closeBtn.isVisible().catch(() => false)) break;
  }
}

const opened2 = await closeBtn.isVisible().catch(() => false);
if (!opened2) {
  fs.writeFileSync(path.join(OUT, 'wall-stuck.json'), JSON.stringify({ error: 'could not open via wall click' }, null, 2));
  console.log(JSON.stringify({ error: 'could not open via wall click' }));
  await browser.close();
  process.exit(0);
}

await closeBtn.click();
// Wait longer than reset animation
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, 'wall-stuck-02-after-close.png') });

// Attempt drag and second open
const before = await page.screenshot();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
await page.mouse.down();
for (let i = 1; i <= 15; i++) {
  await page.mouse.move(box.x + box.width * 0.5 + i * 20, box.y + box.height * 0.5 + i * 2);
  await page.waitForTimeout(20);
}
await page.mouse.up();
await page.waitForTimeout(600);
const after = await page.screenshot();
await page.screenshot({ path: path.join(OUT, 'wall-stuck-03-after-drag.png') });

let diff = 0;
const n = Math.min(before.length, after.length);
for (let i = 0; i < n; i++) if (before[i] !== after[i]) diff++;
diff += Math.abs(before.length - after.length);

// Try open again
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
await page.waitForTimeout(2200);
const reopen = await closeBtn.isVisible().catch(() => false);
await page.screenshot({ path: path.join(OUT, 'wall-stuck-04-reopen-attempt.png') });

// Cursor check on mount
const cursor = await page.evaluate(() => {
  const el = document.querySelector('.cursor-grab, [class*="cursor-grab"]');
  const mount = document.querySelector('.touch-none');
  const target = mount || el;
  if (!target) return null;
  const s = getComputedStyle(target);
  return { cursor: s.cursor, className: target.className };
});

const result = {
  opened: opened2,
  dragDiffBytes: diff,
  dragSeemedToMove: diff > 8000,
  reopenWorked: reopen,
  cursor,
  verdict: (!reopen && diff <= 8000)
    ? 'FAIL: wall stuck after open/close (no drag, no reopen)'
    : (!reopen)
      ? 'PARTIAL: drag maybe moved but reopen failed'
      : (diff <= 8000)
        ? 'PARTIAL: reopen ok but drag little change'
        : 'PASS'
};
fs.writeFileSync(path.join(OUT, 'wall-stuck.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
