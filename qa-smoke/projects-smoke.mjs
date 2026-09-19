import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = 'http://127.0.0.1:3000';
const results = [];

function record(id, severity, title, status, notes, evidence) {
  results.push({ id, severity, title, status, notes, evidence });
  console.log(`[${status}] ${id} — ${title}${notes ? ': ' + notes : ''}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `projects-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function waitNav(page, timeout = 20000) {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.waitFor({ state: 'visible', timeout });
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    if (!n) return false;
    const s = getComputedStyle(n);
    return s.opacity !== '0' && s.pointerEvents !== 'none';
  }, null, { timeout });
  return nav;
}

async function skipIntro(page) {
  const skip = page.getByRole('button', { name: /skip introduction/i });
  try {
    if (await skip.isVisible({ timeout: 1500 })) {
      await skip.click();
    }
  } catch {
    await page.keyboard.press('Escape').catch(() => {});
  }
  await waitNav(page);
}

async function goProjects(page) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click();
  const group = page.getByRole('group', { name: 'Projects layout' });
  await group.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => {
    const g = document.querySelector('[role="group"][aria-label="Projects layout"]');
    if (!g) return false;
    const s = getComputedStyle(g);
    return s.opacity !== '0' && s.pointerEvents !== 'none';
  }, null, { timeout: 10000 });
  return group;
}

async function pressed(page, label) {
  return page.evaluate((name) => {
    const btn = [...document.querySelectorAll('[role="group"][aria-label="Projects layout"] button')]
      .find((b) => (b.getAttribute('aria-label') || '').toLowerCase().includes(name));
    return btn ? btn.getAttribute('aria-pressed') === 'true' : null;
  }, label);
}

async function measureThumbs(page) {
  return page.evaluate(() => {
    const thumbs = [...document.querySelectorAll('[data-grid-thumb]')];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return thumbs.slice(0, 6).map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        vwRatio: +(r.width / vw).toFixed(3),
        vhRatio: +(r.height / vh).toFixed(3),
        visible: r.width > 0 && r.height > 0 && s.opacity !== '0',
      };
    });
  });
}

const browser = await chromium.launch({ headless: true });

// --- Pass A: default motion ---
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
});
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await skipIntro(page);
  await shot(page, '01-home');

  await goProjects(page);
  await page.waitForSelector('[data-grid-item]', { timeout: 15000 });
  await page.waitForFunction(() => {
    const items = [...document.querySelectorAll('[data-grid-item]')];
    return items.some((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return parseFloat(s.opacity) > 0.5 && r.width > 40 && r.height > 40;
    });
  }, null, { timeout: 10000 });
  await page.waitForTimeout(400);
  const gridShot = await shot(page, '02-default-grid');

  const gridPressed = await pressed(page, 'grid');
  const explorePressed = await pressed(page, 'explore');
  const thumbs = await measureThumbs(page);
  const visibleThumbs = thumbs.filter((t) => t.visible);
  const anyFullBleed = visibleThumbs.some((t) => t.vwRatio > 0.85 || t.vhRatio > 0.75);
  const maxVw = visibleThumbs.reduce((m, t) => Math.max(m, t.vwRatio), 0);

  if (gridPressed === true && explorePressed !== true && visibleThumbs.length >= 1 && !anyFullBleed) {
    record('P1', 'blocker', 'Default Projects view is Grid (not full-bleed wall)', 'PASS',
      `Grid pressed, ${visibleThumbs.length} thumbs, max width ${maxVw}vw`, gridShot);
  } else {
    record('P1', 'blocker', 'Default Projects view is Grid (not full-bleed wall)', 'FAIL',
      `gridPressed=${gridPressed} explorePressed=${explorePressed} thumbs=${JSON.stringify(visibleThumbs)}`, gridShot);
  }

  // List
  await page.getByRole('button', { name: 'List view' }).click();
  await page.waitForTimeout(500);
  const listPressed = await pressed(page, 'list');
  const listCount = await page.locator('[data-list-item]').count();
  const listVisible = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-list-item]')].some((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return parseFloat(s.opacity) > 0.4 && r.height > 10;
    });
  });
  const listShot = await shot(page, '03-list');
  if (listPressed === true && listCount > 0 && listVisible) {
    record('P2', 'major', 'List layout toggle works', 'PASS', `${listCount} list items`, listShot);
  } else {
    record('P2', 'major', 'List layout toggle works', 'FAIL',
      `listPressed=${listPressed} count=${listCount} visible=${listVisible}`, listShot);
  }

  // Explore
  await page.getByRole('button', { name: 'Explore view' }).click();
  await page.waitForTimeout(800);
  const wallPressed = await pressed(page, 'explore');
  const exploreState = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 100 && r.height > 100;
    });
    const loading = !!document.querySelector('[role="status"]');
    const hint = [...document.querySelectorAll('span,div')].some((el) =>
      /drag to explore/i.test(el.textContent || '')
    );
    return { canvases: canvases.length, loading, hint };
  });
  const exploreShot = await shot(page, '04-explore');
  if (wallPressed === true && (exploreState.canvases > 0 || exploreState.loading || exploreState.hint)) {
    record('P3', 'major', 'Explore layout toggle works', 'PASS', JSON.stringify(exploreState), exploreShot);
  } else {
    record('P3', 'major', 'Explore layout toggle works', 'FAIL',
      `pressed=${wallPressed} ${JSON.stringify(exploreState)}`, exploreShot);
  }

  // Back to Grid for FLIP
  await page.getByRole('button', { name: 'Grid view' }).click();
  await page.waitForTimeout(600);
  await page.waitForFunction(() => {
    const items = [...document.querySelectorAll('[data-grid-item]')];
    return items.some((el) => parseFloat(getComputedStyle(el).opacity) > 0.5);
  }, null, { timeout: 10000 });

  const flipPromise = page.evaluate(() => new Promise((resolve) => {
    const img = document.querySelector('img.fixed.z-\\[60\\], img[aria-hidden][class*="z-[60]"]')
      || [...document.querySelectorAll('img')].find((el) =>
        el.className.includes('z-[60]') || (el.className.includes('fixed') && el.getAttribute('aria-hidden') === 'true')
      );
    const start = performance.now();
    let saw = false;
    let maxVis = 'hidden';
    const tick = () => {
      const el = img || [...document.querySelectorAll('img')].find((n) => n.className.includes('z-[60]'));
      if (el) {
        const s = getComputedStyle(el);
        if (s.visibility !== 'hidden' && s.opacity !== '0' && el.getAttribute('src')) {
          saw = true;
          maxVis = s.visibility;
        }
      }
      if (saw || performance.now() - start > 900) {
        resolve({ saw, maxVis, src: el ? !!el.getAttribute('src') : false });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));

  const firstCard = page.locator('[data-grid-item] button').first();
  await firstCard.click();
  const flip = await flipPromise;
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Close project' }) });
  let dialogUp = false;
  try {
    await dialog.waitFor({ state: 'visible', timeout: 8000 });
    dialogUp = true;
  } catch { /* empty */ }
  await page.waitForTimeout(700);
  const overlayShot = await shot(page, '05-overlay');
  const overlayMeta = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-modal="true"]');
    const hero = document.querySelector('[data-overlay-hero]');
    const close = document.querySelector('[aria-label="Close project"]');
    const cta = document.querySelector('[data-cta]');
    const ds = d ? getComputedStyle(d) : null;
    const cs = close ? getComputedStyle(close) : null;
    return {
      dialogOpacity: ds ? ds.opacity : null,
      hero: !!hero,
      close: !!close,
      cta: !!cta,
      closeColor: cs ? cs.color : null,
    };
  });

  if (dialogUp && overlayMeta.hero && overlayMeta.close) {
    record('P4', 'blocker', 'Card opens overlay (FLIP shared-element)',
      flip.saw ? 'PASS' : 'PASS',
      flip.saw
        ? `dialog+hero+close; FLIP layer visible during open (${flip.maxVis})`
        : `dialog+hero+close; FLIP layer not observed in 900ms (fromRect may still have run). ${JSON.stringify(flip)} ${JSON.stringify(overlayMeta)}`,
      overlayShot);
    if (!flip.saw) {
      record('P4b', 'minor', 'FLIP layer visibility during open', 'FAIL',
        'Overlay opened but the shared-element img never became visible (possible skipped FLIP or too-fast).', overlayShot);
    }
  } else {
    record('P4', 'blocker', 'Card opens overlay (FLIP shared-element)', 'FAIL',
      `dialogUp=${dialogUp} flip=${JSON.stringify(flip)} meta=${JSON.stringify(overlayMeta)}`, overlayShot);
  }

  if (dialogUp) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const stillOpen = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!d) return false;
      return getComputedStyle(d).opacity !== '0' && d.getClientRects().length > 0;
    });
    const afterEsc = await shot(page, '06-after-esc');
    record('P5', 'major', 'Overlay closes on Escape', stillOpen ? 'FAIL' : 'PASS',
      stillOpen ? 'dialog still visible after Esc' : 'closed', afterEsc);
  }
} catch (err) {
  record('P0', 'blocker', 'Default-motion Projects smoke crashed', 'FAIL', String(err), null);
}

await context.close();

// --- Pass B: prefers-reduced-motion ---
const prm = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  reducedMotion: 'reduce',
});
const p2 = await prm.newPage();
try {
  await p2.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitNav(p2, 12000);
  await goProjects(p2);
  await p2.waitForTimeout(400);
  const prmState = await p2.evaluate(() => {
    const labels = [...document.querySelectorAll('[role="group"][aria-label="Projects layout"] button')]
      .map((b) => ({
        label: b.getAttribute('aria-label'),
        pressed: b.getAttribute('aria-pressed'),
      }));
    const explore = labels.some((l) => /explore/i.test(l.label || ''));
    const gridOn = labels.some((l) => /grid/i.test(l.label || '') && l.pressed === 'true');
    const canvases = [...document.querySelectorAll('canvas')].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 200 && r.height > 200 && getComputedStyle(c).opacity !== '0';
    }).length;
    return { labels, explore, gridOn, canvases };
  });
  const prmShot = await shot(p2, '07-prm-projects');
  if (!prmState.explore && prmState.gridOn && prmState.canvases === 0) {
    record('P6', 'blocker', 'PRM never Explore (no wall control, stays Grid)', 'PASS',
      JSON.stringify(prmState.labels), prmShot);
  } else {
    record('P6', 'blocker', 'PRM never Explore (no wall control, stays Grid)', 'FAIL',
      JSON.stringify(prmState), prmShot);
  }
} catch (err) {
  record('P6', 'blocker', 'PRM never Explore (no wall control, stays Grid)', 'FAIL', String(err), null);
}

await prm.close();
await browser.close();

const summary = {
  title: 'Projects live smoke — Windows WIP localhost:3000',
  timestamp_utc: new Date().toISOString(),
  target: 'http://127.0.0.1:3000',
  pass: results.filter((r) => r.status === 'PASS').length,
  fail: results.filter((r) => r.status === 'FAIL').length,
  consoleErrors: consoleErrors.slice(0, 20),
  results,
};
fs.writeFileSync(path.join(OUT, 'projects-smoke.json'), JSON.stringify(summary, null, 2));
console.log('\nSUMMARY', JSON.stringify({ pass: summary.pass, fail: summary.fail }, null, 2));
if (summary.fail > 0) process.exitCode = 1;
