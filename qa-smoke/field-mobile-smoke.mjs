import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:3000';
const results = [];

function record(id, severity, title, status, detail, evidence) {
  results.push({ id, severity, title, status, detail, evidence });
  console.log(`[${status}] ${id} ${title}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `field-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function skipSplash(page) {
  try {
    await page.getByRole('button', { name: /skip introduction/i }).waitFor({ timeout: 5000 });
    await page.keyboard.press('Escape');
  } catch {}
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    return n && getComputedStyle(n).opacity !== '0';
  }, null, { timeout: 20000 });
}

function sampleField() {
  const field = document.querySelector('.ac-home-field');
  const desktop = field?.querySelector('.ac-home-field__graph--desktop');
  const mobile = field?.querySelector('.ac-home-field__graph--mobile');
  const maskEl = field?.querySelector('.ac-home-field__content-mask');
  const fs = field ? getComputedStyle(field) : null;
  const circles = [...(field?.querySelectorAll('circle') || [])].filter((c) => {
    const g = c.closest('g.ac-home-field__graph, g[class*="ac-home-field__graph"]') || c.closest('g');
    // visible circles only
    let el = c;
    while (el && el !== field) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      el = el.parentElement;
    }
    return true;
  });
  // Prefer circles belonging to visible graphs
  const visibleCircles = [...(field?.querySelectorAll('.ac-home-field__graph circle') || [])].filter((c) => {
    let el = c.parentElement;
    while (el && el !== field) {
      if (getComputedStyle(el).display === 'none') return false;
      el = el.parentElement;
    }
    return true;
  });
  const pts = visibleCircles.map((c) => {
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const portrait = document.querySelector('[data-home-portrait]')?.getBoundingClientRect();
  const h1 = document.querySelector('h1');
  const copy = h1?.closest('div.flex.flex-col')?.getBoundingClientRect()
    || h1?.parentElement?.parentElement?.getBoundingClientRect();
  const inRect = (pt, r, pad = 10) =>
    r && pt.x >= r.left + pad && pt.x <= r.right - pad && pt.y >= r.top + pad && pt.y <= r.bottom - pad;
  return {
    field: !!field,
    fieldOp: fs?.opacity,
    maskImage: fs?.webkitMaskImage || fs?.maskImage || null,
    maskComposite: fs?.maskComposite || fs?.webkitMaskComposite || null,
    desktopDisplay: desktop ? getComputedStyle(desktop).display : null,
    mobileDisplay: mobile ? getComputedStyle(mobile).display : null,
    contentMaskDisplay: maskEl ? getComputedStyle(maskEl).display : null,
    visibleNodes: pts.length,
    inPortrait: pts.filter((p) => inRect(p, portrait, 12)).length,
    inCopy: pts.filter((p) => inRect(p, copy, 12)).length,
    h1: h1?.innerText?.replace(/\s+/g, ' ').trim() || null,
    h1Op: h1 ? getComputedStyle(h1).opacity : null,
    h1Color: h1 ? getComputedStyle(h1).color : null,
    homeItemMinOp: Math.min(
      ...[...document.querySelectorAll('[data-home-item]')].map((el) => parseFloat(getComputedStyle(el).opacity) || 0),
      1
    ),
  };
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

// Mobile
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    await page.waitForTimeout(500);
    const s = await page.evaluate(sampleField);
    const ev = await shot(page, 'mobile-home');
    const graphOk = s.desktopDisplay === 'none' && s.mobileDisplay !== 'none';
    const maskOk = !!(s.maskImage && s.maskImage !== 'none');
    const clear = s.inPortrait === 0 && s.inCopy === 0;
    record('M1', 'blocker', 'Mobile uses gutter graph + content mask',
      graphOk && maskOk ? 'PASS' : 'FAIL', JSON.stringify({ graphOk, maskOk, desktopDisplay: s.desktopDisplay, mobileDisplay: s.mobileDisplay, maskImage: (s.maskImage || '').slice(0, 80) }), ev);
    record('M2', 'blocker', 'Mobile: no dense nodes behind portrait/copy',
      clear && s.visibleNodes > 0 ? 'PASS' : 'FAIL',
      JSON.stringify({ visibleNodes: s.visibleNodes, inPortrait: s.inPortrait, inCopy: s.inCopy }), ev);
    record('M3', 'blocker', 'Type never opacity-gated (mobile)',
      parseFloat(s.h1Op || '0') >= 0.95 && s.homeItemMinOp >= 0.95 && /Mateo/i.test(s.h1 || '') ? 'PASS' : 'FAIL',
      JSON.stringify({ h1: s.h1, h1Op: s.h1Op, homeItemMinOp: s.homeItemMinOp }), ev);
  } catch (e) {
    record('M1', 'blocker', 'Mobile Field smoke crashed', 'FAIL', String(e), null);
  }
  await ctx.close();
}

// Desktop regression
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    await page.waitForTimeout(400);
    const s = await page.evaluate(sampleField);
    const ev = await shot(page, 'desktop-home');
    const graphOk = s.desktopDisplay !== 'none' && (s.mobileDisplay === 'none' || !s.mobileDisplay);
    const clear = s.inPortrait === 0 && s.inCopy === 0;
    record('D1', 'blocker', 'Desktop Field still present (perimeter graph)',
      s.field && graphOk && s.visibleNodes >= 10 ? 'PASS' : 'FAIL',
      JSON.stringify({ visibleNodes: s.visibleNodes, desktopDisplay: s.desktopDisplay, mobileDisplay: s.mobileDisplay }), ev);
    record('D2', 'blocker', 'Desktop nodes clear of portrait/copy',
      clear ? 'PASS' : 'FAIL',
      JSON.stringify({ inPortrait: s.inPortrait, inCopy: s.inCopy }), ev);
    record('D3', 'blocker', 'Desktop type solid / contrast held',
      parseFloat(s.h1Op || '0') >= 0.95 && /Hi! I'm Mateo/i.test(s.h1 || '') ? 'PASS' : 'FAIL',
      JSON.stringify({ h1: s.h1, h1Op: s.h1Op, h1Color: s.h1Color }), ev);
  } catch (e) {
    record('D1', 'blocker', 'Desktop Field smoke crashed', 'FAIL', String(e), null);
  }
  await ctx.close();
}

// PRM desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    const s = await page.evaluate(() => {
      const edges = [...document.querySelectorAll('.ac-home-field__edge')].slice(0, 3).map((el) => getComputedStyle(el).animationName);
      const nodes = [...document.querySelectorAll('.ac-home-field__node')].slice(0, 3).map((el) => getComputedStyle(el).animationName);
      const none = (v) => !v || v === 'none';
      return {
        field: !!document.querySelector('.ac-home-field'),
        lines: document.querySelectorAll('.ac-home-field line').length,
        staticGraph: edges.every(none) && nodes.every(none),
      };
    });
    record('D4', 'major', 'PRM Field still static graph',
      s.field && s.staticGraph ? 'PASS' : 'FAIL', JSON.stringify(s), await shot(page, 'desktop-prm'));
  } catch (e) {
    record('D4', 'major', 'PRM Field still static graph', 'FAIL', String(e), null);
  }
  await ctx.close();
}

await browser.close();
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
const blockers = results.filter((r) => r.status === 'FAIL' && r.severity === 'blocker').map((r) => r.id + ' ' + r.title);
const summary = {
  title: 'Field mobile mask smoke',
  timestamp_utc: new Date().toISOString(),
  overall: fail === 0 ? 'CLEAR' : (blockers.length ? 'FAIL (blockers)' : 'FAIL (non-blocking)'),
  pass,
  fail,
  blockerFails: blockers,
  results,
};
fs.writeFileSync(path.join(OUT, 'field-mobile-smoke.json'), JSON.stringify(summary, null, 2));
console.log('\nOVERALL', summary.overall, { pass, fail, blockers });
if (fail) process.exitCode = 1;
