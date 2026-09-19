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
  const p = path.join(OUT, `myroad-re-${name}.png`);
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

async function openMyRoad(page) {
  await page.getByRole('button', { name: 'My Road', exact: true }).click();
  await page.getByRole('dialog', { name: 'My Road' }).waitFor({ state: 'visible', timeout: 8000 });
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

// Desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    await openMyRoad(page);
    await page.waitForTimeout(400);

    // Upwork role
    const upwork = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-road-card]')];
      const u = cards.find((c) => /Upwork/i.test(c.querySelector('h2')?.textContent || ''));
      const paras = u ? [...u.querySelectorAll('p')].map((p) => p.textContent.trim()) : [];
      return { title: u?.querySelector('h2')?.textContent?.trim(), role: paras[1], dates: paras[0] };
    });
    record('U1', 'major', 'Upwork role is UI/UX Designer',
      upwork.role === 'UI/UX Designer' ? 'PASS' : 'FAIL', JSON.stringify(upwork), await shot(page, '01-upwork'));

    // Skip → Graduation ATF
    await page.getByRole('dialog', { name: 'My Road' }).getByRole('button', { name: 'Skip', exact: true }).click();
    await page.waitForTimeout(500);
    const afterSkip = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-road-card]')];
      const first = cards[0];
      const r = first?.getBoundingClientRect();
      const vh = window.innerHeight;
      const title = first?.querySelector('h2')?.textContent?.trim();
      const activeIdx = cards.findIndex((c) => c.hasAttribute('data-active'));
      const scrub = !!document.querySelector('[aria-label="Jump along My Road"]');
      const scroller = first?.closest('.overflow-y-auto');
      return {
        title,
        activeIdx,
        scrub,
        scrollTop: scroller ? scroller.scrollTop : null,
        firstTop: r ? Math.round(r.top) : null,
        firstBottom: r ? Math.round(r.bottom) : null,
        vh,
        atf: !!(r && r.top >= 0 && r.top < vh * 0.7 && r.bottom > 80),
      };
    });
    const skipShot = await shot(page, '02-skip');
    if (afterSkip.title?.includes('Graduation') && afterSkip.activeIdx === 0 && afterSkip.atf && afterSkip.scrollTop === 0) {
      record('S1', 'blocker', 'Skip stays at top; Graduation ATF', 'PASS', JSON.stringify(afterSkip), skipShot);
    } else {
      record('S1', 'blocker', 'Skip stays at top; Graduation ATF', 'FAIL', JSON.stringify(afterSkip), skipShot);
    }

    // Skill rail visible on desktop md+
    const railDesktop = await page.evaluate(() => {
      const rail = document.querySelector('[aria-label="My Road"] .pointer-events-none.absolute.inset-x-0');
      if (!rail) return { found: false };
      const s = getComputedStyle(rail);
      return { found: true, display: s.display, visibility: s.visibility, chips: rail.querySelectorAll('[title]').length };
    });
    record('K1', 'major', 'Skill rail visible on desktop (md+)',
      railDesktop.found && railDesktop.display !== 'none' && railDesktop.chips > 0 ? 'PASS' : 'FAIL',
      JSON.stringify(railDesktop), await shot(page, '03-rail-desktop'));

    // Nav exit — real Playwright click
    let navClick = 'ok';
    try {
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click({ timeout: 4000 });
    } catch (e) {
      navClick = e.message.split('\n')[0];
    }
    await page.waitForTimeout(400);
    const afterNav = await page.evaluate(() => ({
      road: !!document.querySelector('[role="dialog"][aria-label="My Road"]'),
      navZ: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).zIndex : null; })(),
      roadZ: (() => { const d = document.querySelector('[role="dialog"][aria-label="My Road"]'); return d ? getComputedStyle(d).zIndex : null; })(),
    }));
    record('N1', 'blocker', 'Bottom nav real click exits My Road (R3f)',
      navClick === 'ok' && !afterNav.road ? 'PASS' : 'FAIL',
      JSON.stringify({ navClick, afterNav }), await shot(page, '04-nav'));
  } catch (e) {
    record('X1', 'blocker', 'Desktop re-smoke crashed', 'FAIL', String(e), null);
  }
  await ctx.close();
}

// Mobile < md — skill rail hidden
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    await openMyRoad(page);
    await page.waitForTimeout(400);
    const railMobile = await page.evaluate(() => {
      const rail = document.querySelector('[aria-label="My Road"] .pointer-events-none.absolute.inset-x-0');
      if (!rail) return { found: false };
      const s = getComputedStyle(rail);
      return { found: true, display: s.display, visibility: s.visibility };
    });
    record('K2', 'blocker', 'Skill rail hidden under md (mobile)',
      !railMobile.found || railMobile.display === 'none' ? 'PASS' : 'FAIL',
      JSON.stringify(railMobile), await shot(page, '05-rail-mobile'));
  } catch (e) {
    record('K2', 'blocker', 'Skill rail hidden under md (mobile)', 'FAIL', String(e), null);
  }
  await ctx.close();
}

await browser.close();
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
const blockers = results.filter((r) => r.status === 'FAIL' && r.severity === 'blocker').map((r) => r.id + ' ' + r.title);
const summary = {
  title: 'My Road re-smoke — Skip/skills/Upwork/nav',
  timestamp_utc: new Date().toISOString(),
  overall: fail === 0 ? 'CLEAR' : (blockers.length ? 'FAIL (blockers)' : 'FAIL (non-blocking)'),
  pass,
  fail,
  blockerFails: blockers,
  results,
};
fs.writeFileSync(path.join(OUT, 'myroad-resmoke.json'), JSON.stringify(summary, null, 2));
console.log('\nOVERALL', summary.overall, { pass, fail, blockers });
if (fail) process.exitCode = 1;
