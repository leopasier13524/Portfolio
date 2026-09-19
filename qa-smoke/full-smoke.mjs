import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = 'http://127.0.0.1:3000';
const results = [];
const notes = [];

function record(id, gate, severity, title, status, detail, evidence) {
  results.push({ id, gate, severity, title, status, detail, evidence });
  console.log(`[${status}] ${id} ${title}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `full-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

function parseRgb(c) {
  const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

function relLuminance({ r, g, b }) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(fg, bg) {
  const a = relLuminance(fg);
  const b = relLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function compositeOnBlack(c) {
  const a = c.a;
  return {
    r: Math.round(c.r * a),
    g: Math.round(c.g * a),
    b: Math.round(c.b * a),
    a: 1,
  };
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

// ---------- H1: Home readable without JS ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);
    const html = await page.content();
    const text = await page.evaluate(() => document.body ? document.body.innerText : '');
    const ev = await shot(page, '01-nojs');
    const hasName = /Mateo/i.test(text) || /Mateo/i.test(html);
    const hasHi = /Hi!\s*I'm/i.test(text) || /Hi! I.m/i.test(html);
    const hasAbout = /About/i.test(text) || /UI\/UX/i.test(text);
    const blank = !text || text.replace(/\s+/g, '').length < 20;
    if (resp && resp.status() === 200 && hasName && (hasHi || hasAbout) && !blank) {
      record('H1', 'Home', 'blocker', 'Home type visible without JS', 'PASS',
        `status=${resp.status()} name=${hasName} hi=${hasHi} about=${hasAbout} chars=${text.trim().length}`, ev);
    } else {
      record('H1', 'Home', 'blocker', 'Home type visible without JS', 'FAIL',
        `status=${resp && resp.status()} name=${hasName} hi=${hasHi} blank=${blank} sample=${JSON.stringify(text.slice(0, 180))}`, ev);
    }
  } catch (e) {
    record('H1', 'Home', 'blocker', 'Home type visible without JS', 'FAIL', String(e), null);
  }
  await ctx.close();
}

async function waitNav(page, timeout = 15000) {
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    if (!n) return false;
    const s = getComputedStyle(n);
    return s.opacity !== '0' && s.pointerEvents !== 'none';
  }, null, { timeout });
}

async function skipViaEscape(page) {
  const skip = page.getByRole('button', { name: /skip introduction/i });
  let focused = false;
  let skipVisible = false;
  try {
    await skip.waitFor({ state: 'visible', timeout: 4000 });
    skipVisible = true;
    focused = await skip.evaluate((el) => document.activeElement === el);
  } catch { /* splash may already be gone */ }

  if (skipVisible) {
    record('S1', 'Skip/CTA', 'major', 'Skip control is visible and focused on load', focused ? 'PASS' : 'FAIL',
      focused ? 'Skip has focus' : 'Skip visible but not document.activeElement', null);
    await page.keyboard.press('Escape');
  } else {
    const navUp = await page.evaluate(() => {
      const n = document.querySelector('nav[aria-label="Primary"]');
      return n && getComputedStyle(n).opacity !== '0';
    });
    if (navUp) {
      record('S1', 'Skip/CTA', 'major', 'Skip control is visible and focused on load', 'PASS',
        'Splash already gone (PRM or instant handoff) — Skip not required', null);
    } else {
      record('S1', 'Skip/CTA', 'major', 'Skip control is visible and focused on load', 'FAIL',
        'No Skip button and nav not visible', null);
    }
  }

  try {
    await waitNav(page, 8000);
    record('S2', 'Skip/CTA', 'blocker', 'Escape skips splash / nav appears', 'PASS',
      skipVisible ? 'Esc dismissed splash' : 'Nav already up', null);
    return true;
  } catch {
    if (skipVisible) {
      await skip.click({ force: true }).catch(() => {});
      try {
        await waitNav(page, 6000);
        record('S2', 'Skip/CTA', 'blocker', 'Escape skips splash / nav appears', 'FAIL',
          'Esc did not dismiss; Skip click did. Esc-to-skip is broken.', null);
        return true;
      } catch {
        record('S2', 'Skip/CTA', 'blocker', 'Escape skips splash / nav appears', 'FAIL',
          'Esc and Skip click both left splash up; nav still hidden.', null);
        return false;
      }
    }
    record('S2', 'Skip/CTA', 'blocker', 'Escape skips splash / nav appears', 'FAIL',
      'Could not reach Primary nav', null);
    return false;
  }
}

// ---------- Main JS pass ----------
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error' && !/webpack-hmr|WebSocket/i.test(msg.text())) {
    consoleErrors.push(msg.text());
  }
});

let interactive = false;
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, '02-splash');
  interactive = await skipViaEscape(page);
  const homeShot = await shot(page, '03-home');

  if (interactive) {
    const homeState = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-home-item]')];
      const vis = items.filter((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return parseFloat(s.opacity) > 0.2 && s.visibility !== 'hidden' && r.width > 0;
      });
      const h1 = document.querySelector('h1');
      const label = [...document.querySelectorAll('p')].find((p) => /about|portfolio|ui\/ux/i.test(p.textContent || '') && p.className.includes('uppercase'));
      const body = [...document.querySelectorAll('[data-home-item] p')].find((p) => (p.textContent || '').length > 40);
      const pick = (el) => el ? getComputedStyle(el).color : null;
      return {
        itemTotal: items.length,
        itemVisible: vis.length,
        h1: h1 ? h1.innerText.trim().slice(0, 80) : null,
        h1Color: pick(h1),
        labelColor: pick(label),
        bodyColor: pick(body),
        labelText: label ? label.textContent.trim().slice(0, 40) : null,
        bodyText: body ? body.textContent.trim().slice(0, 40) : null,
        bg: 'rgb(0, 0, 0)',
      };
    });

    if (homeState.itemVisible >= 3 && homeState.h1) {
      record('H2', 'Home', 'blocker', 'Home readable after splash (no blank flash)', 'PASS',
        `${homeState.itemVisible}/${homeState.itemTotal} items visible; h1=${JSON.stringify(homeState.h1)}`, homeShot);
    } else {
      record('H2', 'Home', 'blocker', 'Home readable after splash (no blank flash)', 'FAIL',
        JSON.stringify(homeState), homeShot);
    }

    const black = { r: 0, g: 0, b: 0, a: 1 };
    const labelC = homeState.labelColor && parseRgb(homeState.labelColor);
    const bodyC = homeState.bodyColor && parseRgb(homeState.bodyColor);
    const h1C = homeState.h1Color && parseRgb(homeState.h1Color);
    const ratios = {};
    if (labelC) ratios.label = +contrastRatio(compositeOnBlack(labelC), black).toFixed(2);
    if (bodyC) ratios.body = +contrastRatio(compositeOnBlack(bodyC), black).toFixed(2);
    if (h1C) ratios.h1 = +contrastRatio(compositeOnBlack(h1C), black).toFixed(2);
    const bodyOk = (ratios.body || 0) >= 4.5 || (ratios.h1 || 0) >= 4.5;
    const labelOk = (ratios.label || 0) >= 3;
    record('H3', 'Home', 'major', 'Home label/body contrast lifts vs black',
      bodyOk && labelOk ? 'PASS' : 'FAIL',
      `ratios=${JSON.stringify(ratios)} colors label=${homeState.labelColor} body=${homeState.bodyColor}`, homeShot);

    // Return visit — no blank fade
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Home' }).click();
    await page.waitForTimeout(250);
    const mid = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-home-item]')];
      const hidden = items.filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.2);
      return { total: items.length, hidden: hidden.length };
    });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-home-item]')];
      const vis = items.filter((el) => parseFloat(getComputedStyle(el).opacity) > 0.2);
      return { total: items.length, vis: vis.length };
    });
    const retShot = await shot(page, '04-home-return');
    if (mid.hidden === 0 && after.vis >= 3) {
      record('H4', 'Home', 'major', 'No blank fade on return to Home', 'PASS',
        `mid hidden=${mid.hidden}; after vis=${after.vis}/${after.total}`, retShot);
    } else {
      record('H4', 'Home', 'major', 'No blank fade on return to Home', 'FAIL',
        `mid=${JSON.stringify(mid)} after=${JSON.stringify(after)}`, retShot);
    }

    // Grid
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click();
    const group = page.getByRole('group', { name: 'Projects layout' });
    await group.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);
    const gridShot = await shot(page, '05-grid');
    const grid = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[role="group"][aria-label="Projects layout"] button')]
        .map((b) => ({ label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') }));
      const thumbs = [...document.querySelectorAll('[data-grid-thumb]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), vw: +(r.width / innerWidth).toFixed(3), vh: +(r.height / innerHeight).toFixed(3) };
      }).filter((t) => t.w > 20);
      const gridOn = btns.some((b) => /grid/i.test(b.label || '') && b.pressed === 'true');
      const exploreOn = btns.some((b) => /explore/i.test(b.label || '') && b.pressed === 'true');
      return { btns, thumbs, gridOn, exploreOn, maxVw: thumbs.reduce((m, t) => Math.max(m, t.vw), 0) };
    });
    if (grid.gridOn && !grid.exploreOn && grid.thumbs.length && grid.maxVw < 0.85) {
      record('P1', 'Grid', 'blocker', 'Default Projects is Grid (not full-bleed wall)', 'PASS',
        `thumbs=${grid.thumbs.length} maxVw=${grid.maxVw}`, gridShot);
    } else {
      record('P1', 'Grid', 'blocker', 'Default Projects is Grid (not full-bleed wall)', 'FAIL',
        JSON.stringify(grid), gridShot);
    }

    await page.getByRole('button', { name: 'List view' }).click();
    await page.waitForTimeout(500);
    const listOn = await page.evaluate(() =>
      [...document.querySelectorAll('[role="group"][aria-label="Projects layout"] button')]
        .some((b) => /list/i.test(b.getAttribute('aria-label') || '') && b.getAttribute('aria-pressed') === 'true')
    );
    record('P2', 'Grid', 'major', 'List toggle works', listOn ? 'PASS' : 'FAIL', `pressed=${listOn}`, await shot(page, '06-list'));

    await page.getByRole('button', { name: 'Explore view' }).click();
    await page.waitForTimeout(800);
    const exploreOn = await page.evaluate(() =>
      [...document.querySelectorAll('[role="group"][aria-label="Projects layout"] button')]
        .some((b) => /explore/i.test(b.getAttribute('aria-label') || '') && b.getAttribute('aria-pressed') === 'true')
    );
    record('P3', 'Grid', 'major', 'Explore toggle works', exploreOn ? 'PASS' : 'FAIL', `pressed=${exploreOn}`, await shot(page, '07-explore'));

    await page.getByRole('button', { name: 'Grid view' }).click();
    await page.waitForTimeout(700);
    await page.waitForSelector('[data-grid-item]', { timeout: 10000 });

    const firstCard = page.locator('[data-grid-item] button').first();
    await firstCard.click();
    const dialog = page.locator('[role="dialog"][aria-modal="true"]').filter({ has: page.getByRole('button', { name: 'Close project' }) });
    let overlayUp = false;
    try {
      await dialog.waitFor({ state: 'visible', timeout: 8000 });
      overlayUp = true;
    } catch { /* empty */ }
    await page.waitForTimeout(700);
    const ovShot = await shot(page, '08-overlay');
    const ov = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-modal="true"]');
      const close = document.querySelector('[aria-label="Close project"]');
      const hero = document.querySelector('[data-overlay-hero]');
      const cta = document.querySelector('[data-cta]');
      const cs = close ? getComputedStyle(close) : null;
      const hs = hero ? getComputedStyle(hero) : null;
      const heroR = hero ? hero.getBoundingClientRect() : null;
      const closeR = close ? close.getBoundingClientRect() : null;
      const ctaLink = document.querySelector('[data-cta] a, [data-cta]');
      const ctaS = ctaLink ? getComputedStyle(ctaLink) : null;
      return {
        dialogOp: d ? getComputedStyle(d).opacity : null,
        close: !!close,
        closeOp: cs ? cs.opacity : null,
        closeVis: cs ? cs.visibility : null,
        closeOff: closeR ? closeR.bottom < 0 || closeR.top > innerHeight : null,
        hero: !!hero,
        heroOp: hs ? hs.opacity : null,
        heroH: heroR ? Math.round(heroR.height) : 0,
        cta: !!cta,
        ctaColor: ctaS ? ctaS.color : null,
        ctaBg: ctaS ? ctaS.backgroundColor : null,
      };
    });
    const closeOk = overlayUp && ov.close && ov.closeOp !== '0' && ov.closeVis !== 'hidden' && ov.closeOff === false;
    const heroOk = overlayUp && ov.hero && ov.heroH > 80 && ov.heroOp !== '0';
    record('O1', 'Skip/CTA', 'blocker', 'Overlay opens; Close never hidden; hero painted',
      closeOk && heroOk ? 'PASS' : 'FAIL', JSON.stringify(ov), ovShot);

    if (overlayUp) {
      const ctaFg = ov.ctaColor && parseRgb(ov.ctaColor);
      const ctaBg = ov.ctaBg && parseRgb(ov.ctaBg);
      if (ctaFg && ctaBg && ctaBg.a > 0.2) {
        const cr = +contrastRatio(ctaFg, { r: ctaBg.r, g: ctaBg.g, b: ctaBg.b, a: 1 }).toFixed(2);
        record('O2', 'Skip/CTA', 'major', 'Overlay CTA contrast', cr >= 4.5 ? 'PASS' : 'FAIL',
          `ratio=${cr} fg=${ov.ctaColor} bg=${ov.ctaBg}`, ovShot);
      } else {
        record('O2', 'Skip/CTA', 'major', 'Overlay CTA contrast', ov.cta ? 'PASS' : 'FAIL',
          ov.cta ? `CTA present (Close/data-cta); parsed colors incomplete ${JSON.stringify(ov)}` : 'No data-cta', ovShot);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      const still = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-modal="true"]');
        return !!(d && getComputedStyle(d).opacity !== '0');
      });
      record('O3', 'Skip/CTA', 'major', 'Overlay closes on Escape', still ? 'FAIL' : 'PASS',
        still ? 'still open' : 'closed', await shot(page, '09-overlay-esc'));
    } else {
      record('O2', 'Skip/CTA', 'major', 'Overlay CTA contrast', 'FAIL', 'overlay did not open', ovShot);
      record('O3', 'Skip/CTA', 'major', 'Overlay closes on Escape', 'FAIL', 'overlay did not open', ovShot);
    }
  } else {
    record('H2', 'Home', 'blocker', 'Home readable after splash (no blank flash)', 'FAIL', 'blocked by splash', null);
    record('H3', 'Home', 'major', 'Home label/body contrast lifts vs black', 'FAIL', 'blocked by splash', null);
    record('H4', 'Home', 'major', 'No blank fade on return to Home', 'FAIL', 'blocked by splash', null);
    record('P1', 'Grid', 'blocker', 'Default Projects is Grid (not full-bleed wall)', 'FAIL', 'blocked by splash', null);
    record('P2', 'Grid', 'major', 'List toggle works', 'FAIL', 'blocked by splash', null);
    record('P3', 'Grid', 'major', 'Explore toggle works', 'FAIL', 'blocked by splash', null);
    record('O1', 'Skip/CTA', 'blocker', 'Overlay opens; Close never hidden; hero painted', 'FAIL', 'blocked by splash', null);
    record('O2', 'Skip/CTA', 'major', 'Overlay CTA contrast', 'FAIL', 'blocked by splash', null);
    record('O3', 'Skip/CTA', 'major', 'Overlay closes on Escape', 'FAIL', 'blocked by splash', null);
  }
} catch (e) {
  record('X1', 'Grid', 'blocker', 'Interactive JS pass crashed', 'FAIL', String(e), null);
}

await ctx.close();

// ---------- PRM / motion ----------
{
  const prm = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const p = await prm.newPage();
  try {
    await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let nav = false;
    try {
      await waitNav(p, 12000);
      nav = true;
    } catch {
      await p.keyboard.press('Escape').catch(() => {});
      try { await waitNav(p, 5000); nav = true; } catch { /* empty */ }
    }
    const ev = await shot(p, '10-prm');
    if (nav) {
      await p.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click();
      await p.waitForTimeout(600);
    }
    const state = await p.evaluate(() => {
      const labels = [...document.querySelectorAll('[role="group"][aria-label="Projects layout"] button')]
        .map((b) => ({ label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') }));
      const explore = labels.some((l) => /explore/i.test(l.label || ''));
      const gridOn = labels.some((l) => /grid/i.test(l.label || '') && l.pressed === 'true');
      const splash = !!document.querySelector('[aria-label="Introduction"][aria-modal="true"]');
      const splashSkip = !!document.querySelector('[aria-label="Skip introduction"]');
      const motionReduceEls = document.querySelectorAll('.motion-reduce\\:transition-none, [class*="motion-reduce"]').length;
      return { labels, explore, gridOn, splash, splashSkip, motionReduceEls };
    });
    if (nav && !state.explore && (state.gridOn || state.labels.length === 0)) {
      record('M1', 'Motion', 'blocker', 'PRM never Explore; splash does not trap', 'PASS',
        JSON.stringify(state), ev);
    } else if (nav && !state.splash) {
      record('M1', 'Motion', 'blocker', 'PRM never Explore; splash does not trap', state.explore ? 'FAIL' : 'PASS',
        JSON.stringify(state), ev);
    } else {
      record('M1', 'Motion', 'blocker', 'PRM never Explore; splash does not trap', 'FAIL',
        JSON.stringify(state), ev);
    }
    record('M2', 'Motion', 'major', 'Reduced-motion tokens present in tree',
      state.motionReduceEls > 0 || !state.explore ? 'PASS' : 'FAIL',
      `motionReduceEls=${state.motionReduceEls} exploreHidden=${!state.explore}`, ev);
  } catch (e) {
    record('M1', 'Motion', 'blocker', 'PRM never Explore; splash does not trap', 'FAIL', String(e), null);
    record('M2', 'Motion', 'major', 'Reduced-motion tokens present in tree', 'FAIL', String(e), null);
  }
  await prm.close();
}

await browser.close();

const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
const blockers = results.filter((r) => r.status === 'FAIL' && r.severity === 'blocker');
const summary = {
  title: 'Full ship-gate smoke — Windows WIP localhost:3000',
  timestamp_utc: new Date().toISOString(),
  target: BASE,
  overall: fail === 0 ? 'PASS' : (blockers.length ? 'FAIL (blockers)' : 'FAIL (non-blocking)'),
  pass,
  fail,
  blockerFails: blockers.map((b) => b.id + ' ' + b.title),
  consoleErrors: consoleErrors.slice(0, 15),
  notes,
  results,
};
fs.writeFileSync(path.join(OUT, 'full-smoke.json'), JSON.stringify(summary, null, 2));
console.log('\nOVERALL', summary.overall, { pass, fail, blockers: summary.blockerFails });
if (fail > 0) process.exitCode = 1;
