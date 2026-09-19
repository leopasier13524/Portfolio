import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:3000';
const results = [];

function record(id, gate, severity, title, status, detail, evidence) {
  results.push({ id, gate, severity, title, status, detail, evidence });
  console.log(`[${status}] ${id} ${title}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `t25-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function waitNav(page) {
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    if (!n) return false;
    const s = getComputedStyle(n);
    return s.opacity !== '0' && s.pointerEvents !== 'none';
  }, null, { timeout: 15000 });
}

async function skipIn(page) {
  const skip = page.getByRole('button', { name: /skip introduction/i });
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    await page.keyboard.press('Escape');
  } catch { /* maybe already gone */ }
  await waitNav(page);
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await skipIn(page);
  await page.waitForTimeout(400);

  // ---- (3) About + location ----
  const homeLayout = await page.evaluate(() => {
    const portrait = document.querySelector('[data-home-portrait]');
    const about = [...document.querySelectorAll('p')].find((p) => p.textContent.trim() === 'About');
    const loc = [...document.querySelectorAll('p')].find((p) => /split/i.test(p.textContent || '') && /croatia/i.test(p.textContent || ''));
    const headline = [...document.querySelectorAll('p')].find((p) => /ui\/ux/i.test(p.textContent || ''));
    const pr = portrait ? portrait.getBoundingClientRect() : null;
    const ar = about ? about.getBoundingClientRect() : null;
    const lr = loc ? loc.getBoundingClientRect() : null;
    const hr = headline ? headline.getBoundingClientRect() : null;
    return {
      aboutText: about ? about.textContent.trim() : null,
      locText: loc ? loc.textContent.trim() : null,
      headlineText: headline ? headline.textContent.trim() : null,
      aboutBelowPortrait: !!(pr && ar && ar.top >= pr.bottom - 8),
      locBelowHeadline: !!(hr && lr && lr.top >= hr.bottom - 4),
      locNotUnderPortrait: !!(pr && lr && (lr.left > pr.right - 40 || lr.top > pr.bottom - 4)),
      gaps: {
        aboutTop: ar ? Math.round(ar.top) : null,
        portraitBottom: pr ? Math.round(pr.bottom) : null,
        locTop: lr ? Math.round(lr.top) : null,
        headlineBottom: hr ? Math.round(hr.bottom) : null,
      },
    };
  });
  const homeShot = await shot(page, '03-home');
  if (homeLayout.aboutBelowPortrait && homeLayout.locBelowHeadline && homeLayout.locText) {
    record('T3', 'About', 'blocker', 'About below portrait; Split, Croatia under UI/UX headline', 'PASS',
      JSON.stringify(homeLayout), homeShot);
  } else {
    record('T3', 'About', 'blocker', 'About below portrait; Split, Croatia under UI/UX headline', 'FAIL',
      JSON.stringify(homeLayout), homeShot);
  }

  // ---- (2) stutter ----
  async function trip(from, to) {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: from }).click();
    await page.waitForTimeout(500);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: to }).click();
    const samples = [];
    const start = Date.now();
    while (Date.now() - start < 450) {
      samples.push(await page.evaluate(() => {
        const items = [...document.querySelectorAll('[data-home-item]')];
        const ops = items.map((el) => parseFloat(getComputedStyle(el).opacity));
        const h1 = document.querySelector('h1');
        const h1op = h1 ? parseFloat(getComputedStyle(h1).opacity) : 1;
        return { min: Math.min(...ops, h1op), hidden: ops.filter((o) => o < 0.2).length, n: ops.length };
      }));
      await page.waitForTimeout(50);
    }
    return samples;
  }
  const fromProjects = await trip('Projects', 'Home');
  await page.waitForTimeout(300);
  const fromContact = await trip('Contact', 'Home');
  const stutterShot = await shot(page, '02-home-return');
  const worst = [...fromProjects, ...fromContact].reduce((m, s) => Math.min(m, s.min), 1);
  const hiddenHits = [...fromProjects, ...fromContact].some((s) => s.hidden > 0);
  if (!hiddenHits && worst >= 0.2) {
    record('T2', 'Stutter', 'blocker', 'Home text does not stutter from Projects/Contact', 'PASS',
      `minOpacity=${worst}`, stutterShot);
  } else {
    record('T2', 'Stutter', 'blocker', 'Home text does not stutter from Projects/Contact', 'FAIL',
      `minOpacity=${worst} hiddenHits=${hiddenHits} proj=${JSON.stringify(fromProjects.slice(0, 3))} contact=${JSON.stringify(fromContact.slice(0, 3))}`, stutterShot);
  }

  // ---- (4) Explore default / order / labels ----
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click();
  await page.waitForTimeout(800);
  const toggle = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="group"][aria-label="Projects layout"] button')];
    return btns.map((b) => {
      const span = b.querySelector('span');
      const spanVis = span ? getComputedStyle(span).display !== 'none' && parseFloat(getComputedStyle(span).opacity) > 0 : false;
      return {
        label: b.getAttribute('aria-label'),
        pressed: b.getAttribute('aria-pressed') === 'true',
        text: (span && spanVis ? span.textContent.trim() : ''),
        hasText: !!(span && spanVis && span.textContent.trim()),
      };
    });
  });
  const projShot = await shot(page, '04-projects');
  const order = toggle.map((t) => (t.label || '').replace(' view', ''));
  const exploreFirst = /^explore/i.test(order[0] || '');
  const gridLast = /grid/i.test(order[order.length - 1] || '');
  const exploreDefault = toggle.some((t) => /explore/i.test(t.label || '') && t.pressed);
  const onlyActiveLabeled = toggle.filter((t) => t.hasText).length === 1 && toggle.find((t) => t.hasText)?.pressed;
  if (exploreFirst && gridLast && exploreDefault && onlyActiveLabeled) {
    record('T4', 'Explore', 'blocker', 'Explore first+default; Grid last; active-only labels', 'PASS',
      JSON.stringify({ order, toggle }), projShot);
  } else {
    record('T4', 'Explore', 'blocker', 'Explore first+default; Grid last; active-only labels', 'FAIL',
      JSON.stringify({ order, exploreFirst, gridLast, exploreDefault, onlyActiveLabeled, toggle }), projShot);
  }

  // switch to Grid — label should move
  await page.getByRole('button', { name: 'Grid view' }).click();
  await page.waitForTimeout(400);
  const afterGrid = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="group"][aria-label="Projects layout"] button')];
    return btns.map((b) => {
      const span = b.querySelector('span');
      const spanVis = span ? getComputedStyle(span).display !== 'none' : false;
      return {
        label: b.getAttribute('aria-label'),
        pressed: b.getAttribute('aria-pressed') === 'true',
        hasText: !!(span && spanVis && span.textContent.trim()),
      };
    });
  });
  const gridLabeled = afterGrid.filter((t) => t.hasText).length === 1 && afterGrid.some((t) => /grid/i.test(t.label || '') && t.pressed && t.hasText);
  record('T4b', 'Explore', 'major', 'Only Grid label shows when Grid is active',
    gridLabeled ? 'PASS' : 'FAIL', JSON.stringify(afterGrid), await shot(page, '04b-grid-label'));

  // ---- (5) overlay 2-col gallery ----
  await page.waitForSelector('[data-grid-item] button', { timeout: 10000 });
  await page.locator('[data-grid-item] button').first().click();
  const dialog = page.locator('[role="dialog"][aria-modal="true"]');
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(700);
  const gallery = await page.evaluate(() => {
    const figs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"] figure')]
      .filter((f) => !f.hasAttribute('data-overlay-hero'));
    const boxes = figs.map((f) => {
      const r = f.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
    }).filter((b) => b.w > 40 && b.h > 40);
    const vw = innerWidth;
    let sideBySide = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (Math.abs(boxes[i].y - boxes[j].y) < 80 && boxes[i].x !== boxes[j].x) sideBySide = true;
      }
    }
    const maxW = boxes.reduce((m, b) => Math.max(m, b.w), 0);
    return { count: boxes.length, boxes: boxes.slice(0, 6), sideBySide, maxW, vw, small: maxW > 0 && maxW < vw * 0.7 };
  });
  // scroll gallery into view
  await page.evaluate(() => {
    const f = [...document.querySelectorAll('[role="dialog"] figure')].find((el) => !el.hasAttribute('data-overlay-hero'));
    f?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  const ovShot = await shot(page, '05-overlay-gallery');
  if (gallery.count >= 2 && gallery.sideBySide && gallery.small) {
    record('T5', 'Overlay', 'blocker', 'Overlay gallery is smaller 2-col side-by-side', 'PASS',
      JSON.stringify(gallery), ovShot);
  } else if (gallery.count >= 2 && gallery.small && !gallery.sideBySide) {
    record('T5', 'Overlay', 'blocker', 'Overlay gallery is smaller 2-col side-by-side', 'FAIL',
      `images smaller but not side-by-side at this viewport: ${JSON.stringify(gallery)}`, ovShot);
  } else {
    record('T5', 'Overlay', 'blocker', 'Overlay gallery is smaller 2-col side-by-side', 'FAIL',
      JSON.stringify(gallery), ovShot);
  }
} catch (e) {
  record('TX', 'Tranche', 'blocker', 'Tranche 2–5 smoke crashed', 'FAIL', String(e), null);
}

await ctx.close();
await browser.close();

const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
const blockers = results.filter((r) => r.status === 'FAIL' && r.severity === 'blocker').map((r) => r.id + ' ' + r.title);
const summary = {
  title: 'Tranche 2–5 smoke — Windows WIP',
  timestamp_utc: new Date().toISOString(),
  target: BASE,
  overall: fail === 0 ? 'CLEAR' : (blockers.length ? 'FAIL (blockers)' : 'FAIL (non-blocking)'),
  pass,
  fail,
  blockerFails: blockers,
  results,
};
fs.writeFileSync(path.join(OUT, 'tranche25-smoke.json'), JSON.stringify(summary, null, 2));
console.log('\nOVERALL', summary.overall, { pass, fail, blockers });
if (fail > 0) process.exitCode = 1;
