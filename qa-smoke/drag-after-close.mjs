import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = 'http://localhost:3000';

function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  return page.screenshot({ path: p, fullPage: false }).then(() => p);
}

async function waitNav(page) {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    if (!n) return false;
    const s = getComputedStyle(n);
    return s.opacity !== '0' && s.pointerEvents !== 'none';
  }, null, { timeout: 120000 });
}

async function goProjectsWall(page) {
  await page.getByRole('button', { name: /^Projects$/i }).click();
  await page.waitForTimeout(1200);
  const wall = page.getByRole('button', { name: /wall/i });
  if (await wall.count()) {
    await wall.click();
    await page.waitForTimeout(800);
  }
}

async function openFirstListProject(page) {
  const list = page.getByRole('button', { name: /list/i });
  if (await list.count()) {
    await list.click();
    await page.waitForTimeout(700);
  }
  const candidates = page.locator('button:visible, a:visible');
  const n = await candidates.count();
  for (let i = 0; i < Math.min(n, 50); i++) {
    const el = candidates.nth(i);
    const label = ((await el.innerText().catch(() => '')) || '').trim();
    if (!label) continue;
    if (/^(home|projects|contact|wall|list|close)$/i.test(label)) continue;
    if (label.length < 2 || label.length > 80) continue;
    await el.click({ timeout: 2500 });
    await page.waitForTimeout(1400);
    const closeBtn = page.getByRole('button', { name: /close/i });
    if (await closeBtn.count()) {
      return { label: label.replace(/\s+/g, ' ').slice(0, 60), closeBtn };
    }
  }
  throw new Error('Could not open a project overlay');
}

async function canvasCenter(page) {
  // Prefer webgl/canvas used by three.js gallery
  const handle = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const c = canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, count: canvases.length };
  });
  return handle;
}

async function sampleScene(page) {
  return page.evaluate(() => {
    const canvas = [...document.querySelectorAll('canvas')].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    const texts = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false;
        const t = (el.textContent || '').trim();
        return t.length > 0 && t.length < 40 && el.children.length === 0;
      })
      .slice(0, 30)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { t: (el.textContent || '').trim(), x: Math.round(r.left), y: Math.round(r.top) };
      });
    let pixels = null;
    if (canvas) {
      try {
        const ctx = canvas.getContext('2d');
        // WebGL canvas won't give 2d; hash via toDataURL length + a few CSS rects instead
      } catch {}
      const r = canvas.getBoundingClientRect();
      pixels = { cw: canvas.width, ch: canvas.height, cssW: Math.round(r.width), cssH: Math.round(r.height) };
    }
    // Capture a cheap visual fingerprint via screenshot isn't possible here; return DOM labels positions
    return { canvas: pixels, labels: texts };
  });
}

async function dragWall(page, steps = 1) {
  const c = await canvasCenter(page);
  if (!c || c.w < 50) throw new Error(`No usable canvas for drag (found=${c && c.count})`);
  const start = { x: c.x, y: c.y };
  const end = { x: c.x + 280, y: c.y + 40 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // stepwise drag
  for (let i = 1; i <= 12; i++) {
    const x = start.x + ((end.x - start.x) * i) / 12;
    const y = start.y + ((end.y - start.y) * i) / 12;
    await page.mouse.move(x, y, { steps: 2 });
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  return { start, end, canvas: c };
}

function labelsMoved(before, after, minPx = 18) {
  const mapB = new Map(before.labels.map((l) => [l.t, l]));
  const moved = [];
  for (const a of after.labels) {
    const b = mapB.get(a.t);
    if (!b) continue;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    if (dx + dy >= minPx) moved.push({ t: a.t, dx, dy });
  }
  return moved;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const result = {
  ok: false,
  steps: [],
  dragBeforeClose: null,
  dragAfterClose: null,
  overlays: {},
  consoleErrors,
};

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitNav(page);
  result.steps.push('intro+nav ok');

  await goProjectsWall(page);
  result.overlays.projectsWall = await shot(page, 'drag-01-projects-wall');
  result.steps.push('on projects wall');

  // Baseline: drag should work BEFORE opening a project
  let beforeA = await sampleScene(page);
  const drag1 = await dragWall(page);
  let afterA = await sampleScene(page);
  const movedBefore = labelsMoved(beforeA, afterA);
  // Also compare canvas screenshot hashes via page screenshots
  const hash = async (name) => {
    const buf = fs.readFileSync(path.join(OUT, name));
    // simple checksum
    let h = 0;
    for (let i = 0; i < buf.length; i += 97) h = (h * 33 + buf[i]) >>> 0;
    return h;
  };
  await shot(page, 'drag-02-after-baseline-drag');
  result.dragBeforeClose = {
    drag: drag1,
    labelsMoved: movedBefore.slice(0, 10),
    movedCount: movedBefore.length,
  };
  result.steps.push(`baseline drag movedLabels=${movedBefore.length}`);

  // Reset to list to open reliably, then back
  const opened = await openFirstListProject(page);
  result.overlays.open = await shot(page, 'drag-03-project-open');
  result.steps.push(`opened ${opened.label}`);

  await opened.closeBtn.first().click();
  await page.waitForTimeout(1200);
  // Ensure overlay gone
  const closeStill = await page.getByRole('button', { name: /close/i }).isVisible().catch(() => false);
  result.steps.push(`closed overlay (closeVisible=${closeStill})`);
  // Ensure wall mode
  await goProjectsWall(page);
  result.overlays.afterClose = await shot(page, 'drag-04-after-close');

  const beforeB = await sampleScene(page);
  await shot(page, 'drag-05-before-postclose-drag');
  const drag2 = await dragWall(page);
  await page.waitForTimeout(400);
  const afterB = await sampleScene(page);
  await shot(page, 'drag-06-after-postclose-drag');
  const movedAfter = labelsMoved(beforeB, afterB);

  // Pixel-diff the before/after post-close screenshots
  const b5 = fs.readFileSync(path.join(OUT, 'drag-05-before-postclose-drag.png'));
  const b6 = fs.readFileSync(path.join(OUT, 'drag-06-after-postclose-drag.png'));
  let diffBytes = 0;
  const len = Math.min(b5.length, b6.length);
  for (let i = 0; i < len; i++) if (b5[i] !== b6[i]) diffBytes++;
  diffBytes += Math.abs(b5.length - b6.length);

  result.dragAfterClose = {
    drag: drag2,
    labelsMoved: movedAfter.slice(0, 10),
    movedCount: movedAfter.length,
    screenshotDiffBytes: diffBytes,
    closeStillVisible: closeStill,
    canvas: beforeB.canvas,
  };

  // Heuristic: drag works if screenshot changed meaningfully OR labels moved
  const dragWorks = diffBytes > 5000 || movedAfter.length > 0;
  result.ok = !closeStill && dragWorks;
  result.verdict = dragWorks
    ? (closeStill ? 'FAIL: overlay remnants but scene moved' : 'PASS: drag works after close')
    : 'FAIL: drag appears stuck after close';
  result.steps.push(result.verdict);
} catch (e) {
  result.ok = false;
  result.verdict = `ERROR: ${e.message}`;
  result.steps.push(result.verdict);
  try { await shot(page, 'drag-error'); } catch {}
}

fs.writeFileSync(path.join(OUT, 'drag-after-close.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
