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
  const p = path.join(OUT, `myroad-re2-${name}.png`);
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

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    await openMyRoad(page);
    await page.waitForTimeout(300);

    const z = await page.evaluate(() => ({
      navZ: getComputedStyle(document.querySelector('nav[aria-label="Primary"]')).zIndex,
      roadZ: getComputedStyle(document.querySelector('[role="dialog"][aria-label="My Road"]')).zIndex,
    }));
    record('Z1', 'blocker', 'BottomNav elevated to z-50 while My Road open',
      z.navZ === '50' && Number(z.roadZ) <= 50 ? 'PASS' : (z.navZ === '50' ? 'PASS' : 'FAIL'),
      JSON.stringify(z), null);

    // Upwork
    const upwork = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-road-card]')];
      const u = cards.find((c) => /Upwork/i.test(c.querySelector('h2')?.textContent || ''));
      const paras = u ? [...u.querySelectorAll('p')].map((p) => p.textContent.trim()) : [];
      return { role: paras[1] };
    });
    record('U1', 'major', 'Upwork role is UI/UX Designer',
      upwork.role === 'UI/UX Designer' ? 'PASS' : 'FAIL', JSON.stringify(upwork), null);

    // Skip ATF
    await page.getByRole('dialog', { name: 'My Road' }).getByRole('button', { name: 'Skip', exact: true }).click();
    await page.waitForTimeout(400);
    const afterSkip = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-road-card]')];
      const first = cards[0];
      const r = first.getBoundingClientRect();
      const scroller = first.closest('.overflow-y-auto');
      return {
        title: first.querySelector('h2')?.textContent?.trim(),
        scrollTop: scroller.scrollTop,
        atf: r.top >= 0 && r.top < window.innerHeight * 0.7 && r.bottom > 80,
        firstTop: Math.round(r.top),
      };
    });
    record('S1', 'blocker', 'Skip stay/top; Graduation ATF',
      /Graduation/i.test(afterSkip.title || '') && afterSkip.scrollTop === 0 && afterSkip.atf ? 'PASS' : 'FAIL',
      JSON.stringify(afterSkip), await shot(page, 'skip'));

    // Real nav click
    let navClick = 'ok';
    try {
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Projects' }).click({ timeout: 4000 });
    } catch (e) {
      navClick = e.message.split('\n')[0];
    }
    await page.waitForTimeout(400);
    const afterNav = await page.evaluate(() => !document.querySelector('[role="dialog"][aria-label="My Road"]'));
    record('N1', 'blocker', 'R3f real pointer nav click exits My Road',
      navClick === 'ok' && afterNav ? 'PASS' : 'FAIL',
      JSON.stringify({ navClick, afterNav, z }), await shot(page, 'nav'));
  } catch (e) {
    record('X1', 'blocker', 'Desktop re-smoke crashed', 'FAIL', String(e), null);
  }
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    await openMyRoad(page);
    const rail = await page.evaluate(() => {
      const el = document.querySelector('[aria-label="My Road"] .pointer-events-none.absolute.inset-x-0');
      return el ? getComputedStyle(el).display : 'missing';
    });
    record('K2', 'blocker', 'Skill rail hidden under md',
      rail === 'none' || rail === 'missing' ? 'PASS' : 'FAIL', `display=${rail}`, await shot(page, 'mobile'));
  } catch (e) {
    record('K2', 'blocker', 'Skill rail hidden under md', 'FAIL', String(e), null);
  }
  await ctx.close();
}

await browser.close();
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
const blockers = results.filter((r) => r.status === 'FAIL' && r.severity === 'blocker').map((r) => r.id + ' ' + r.title);
const summary = { title: 'My Road re-smoke 2 — Skip + nav z-50', timestamp_utc: new Date().toISOString(), overall: fail === 0 ? 'CLEAR' : 'FAIL', pass, fail, blockerFails: blockers, results };
fs.writeFileSync(path.join(OUT, 'myroad-resmoke2.json'), JSON.stringify(summary, null, 2));
console.log('\nOVERALL', summary.overall, { pass, fail, blockers });
if (fail) process.exitCode = 1;
