import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })).newPage();
await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
try {
  await page.getByRole('button', { name: /skip introduction/i }).waitFor({ timeout: 4000 });
  await page.keyboard.press('Escape');
} catch {}
await page.waitForFunction(() => {
  const n = document.querySelector('nav[aria-label="Primary"]');
  return n && getComputedStyle(n).opacity !== '0';
});
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const field = document.querySelector('.ac-home-field');
  const svg = field?.querySelector('svg');
  const pe = field ? getComputedStyle(field).pointerEvents : null;
  const canvases = field ? field.querySelectorAll('canvas').length : -1;
  const portrait = document.querySelector('[data-home-portrait]')?.getBoundingClientRect();
  const h1 = document.querySelector('h1')?.getBoundingClientRect();
  const copy = document.querySelector('h1')?.closest('.flex.flex-col')?.getBoundingClientRect()
    || document.querySelector('h1')?.parentElement?.parentElement?.getBoundingClientRect();
  const circles = [...(svg?.querySelectorAll('circle') || [])].map((c) => {
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const inRect = (pt, r, pad = 8) => r && pt.x >= r.left + pad && pt.x <= r.right - pad && pt.y >= r.top + pad && pt.y <= r.bottom - pad;
  const inPortrait = circles.filter((p) => inRect(p, portrait, 12)).length;
  const inCopy = circles.filter((p) => inRect(p, copy, 12)).length;
  return {
    pointerEvents: pe,
    canvasesInField: canvases,
    svgOnly: !!(svg && canvases === 0),
    behind: field ? getComputedStyle(field).zIndex : null,
    nodes: circles.length,
    inPortrait,
    inCopy,
    portrait: portrait && { l: +portrait.left.toFixed(0), t: +portrait.top.toFixed(0), r: +portrait.right.toFixed(0), b: +portrait.bottom.toFixed(0) },
    copy: copy && { l: +copy.left.toFixed(0), t: +copy.top.toFixed(0), r: +copy.right.toFixed(0), b: +copy.bottom.toFixed(0) },
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
