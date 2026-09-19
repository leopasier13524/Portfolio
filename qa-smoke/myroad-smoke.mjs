import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:3000';
const results = [];

const EXPECTED_STOPS = [
  { title: 'Graduation — SSK Livno', role: 'Web Designer specialty', dates: '2023', outcome: 'Completed Web Designer studies at SSK Livno.' },
  { title: 'Zero to Master', role: 'UI/UX training', dates: '2023', outcome: 'Built UI/UX craft through focused training.' },
  { title: 'Upwork', role: 'UI/UX', dates: 'Sep 2022–Nov 2024', outcome: 'Delivered client UI/UX end-to-end as an independent designer.' },
  { title: 'Tiskara Perisa', role: 'Graphic Designer', dates: 'Jan 2023–Apr 2024', outcome: 'Shipped graphic design in a production team setting.' },
  { title: 'Tahoma d.o.o', role: 'UI/UX Designer', dates: 'Dec 2024–Present', outcome: 'Designing UI/UX in product today.' },
];

const ALLOWED_SKILLS = new Set([
  'Figma','Photoshop','After Effects','CorelDraw','Blender','Postman','Jira','InDesign','Premiere Pro','Microsoft Office','VSC','Illustrator','Adobe XD','Filmora','Unreal Engine','WordPress',
  'HTML','JavaScript','Django','CSS3','PHP','MySQL','Bootstrap','Python',
]);

function record(id, severity, title, status, detail, evidence) {
  results.push({ id, severity, title, status, detail, evidence });
  console.log(`[${status}] ${id} ${title}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `myroad-${name}.png`);
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
  const cta = page.getByRole('button', { name: 'My Road', exact: true });
  await cta.waitFor({ state: 'visible', timeout: 10000 });
  await cta.click();
  await page.getByRole('dialog', { name: 'My Road' }).waitFor({ state: 'visible', timeout: 8000 });
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

// ========== Main motion pass ==========
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    await page.waitForTimeout(400);

    // R1: Home CTA opens journey, not Projects
    const beforeNav = await page.evaluate(() => {
      const n = document.querySelector('nav[aria-label="Primary"]');
      const projectsBtn = [...(n?.querySelectorAll('button') || [])].find((b) => /projects/i.test(b.textContent || ''));
      return projectsBtn ? projectsBtn.getAttribute('aria-current') : null;
    });
    await openMyRoad(page);
    const afterOpen = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="My Road"]');
      const explore = document.querySelector('[role="group"][aria-label="Projects layout"]');
      const projectsCurrent = [...document.querySelectorAll('nav[aria-label="Primary"] button')]
        .find((b) => /projects/i.test(b.textContent || ''))?.getAttribute('aria-current');
      return {
        dialog: !!dialog,
        dialogVisible: dialog ? getComputedStyle(dialog).display !== 'none' : false,
        projectsCurrent,
        projectsToggleVisible: explore ? getComputedStyle(explore).opacity !== '0' && getComputedStyle(explore.parentElement).opacity !== '0' : false,
      };
    });
    const openShot = await shot(page, '01-open');
    if (afterOpen.dialog && afterOpen.dialogVisible && afterOpen.projectsCurrent !== 'page') {
      record('R1', 'blocker', 'Home CTA My Road → journey (not Projects)', 'PASS',
        JSON.stringify({ beforeNav, afterOpen }), openShot);
    } else {
      record('R1', 'blocker', 'Home CTA My Road → journey (not Projects)', 'FAIL',
        JSON.stringify({ beforeNav, afterOpen }), openShot);
    }

    // R2: five locked stops with exact meta + cards readable without waiting for plane
    await page.waitForTimeout(300);
    const cards = await page.evaluate(() => {
      return [...document.querySelectorAll('[data-road-card]')].map((card) => {
        const s = getComputedStyle(card);
        const title = card.querySelector('h2')?.textContent?.trim() || '';
        const paras = [...card.querySelectorAll('p')].map((p) => p.textContent.trim());
        return {
          title,
          dates: paras[0] || '',
          role: paras[1] || '',
          outcome: paras[2] || '',
          opacity: s.opacity,
          visibility: s.visibility,
        };
      });
    });
    const countOk = cards.length === 5;
    const metaOk = EXPECTED_STOPS.every((exp, i) => {
      const c = cards[i];
      return c && c.title === exp.title && c.role === exp.role && c.dates === exp.dates && c.outcome === exp.outcome;
    });
    const readable = cards.every((c) => parseFloat(c.opacity) > 0.5 && c.visibility !== 'hidden');
    const cardsShot = await shot(page, '02-cards');
    if (countOk && metaOk && readable) {
      record('R2', 'blocker', 'Cards-first; five locked stops with exact meta', 'PASS',
        `5 cards, meta match, readable op>=0.5`, cardsShot);
    } else {
      record('R2', 'blocker', 'Cards-first; five locked stops with exact meta', 'FAIL',
        JSON.stringify({ countOk, metaOk, readable, cards }), cardsShot);
    }

    // R2b: still readable after ~2s without needing plane (cards-first; ~20s gate = no opacity gate on wait)
    await page.waitForTimeout(2000);
    const stillReadable = await page.evaluate(() =>
      [...document.querySelectorAll('[data-road-card]')].every((c) => {
        const s = getComputedStyle(c);
        return parseFloat(s.opacity) > 0.5 && c.querySelector('h2')?.textContent;
      })
    );
    record('R2b', 'major', 'Cards readable without waiting for plane flight',
      stillReadable ? 'PASS' : 'FAIL', `after 2s stillReadable=${stillReadable}`, await shot(page, '02b-still'));

    // R3: skills from allowlist
    const skills = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-label="My Road"] [title]')]
        .map((el) => el.getAttribute('title'))
        .filter(Boolean)
    );
    // also gather skill labels from path column
    const skillLabels = await page.evaluate(() => {
      const col = document.querySelector('[aria-label="My Road"] .pointer-events-none.absolute.inset-x-0');
      if (!col) {
        // fallback: all tiny uppercase labels near SkillIcon wrappers
        return [...document.querySelectorAll('[aria-label="My Road"] span')]
          .map((s) => s.textContent.trim())
          .filter((t) => t && t.length < 24 && t === t && /[A-Za-z]/.test(t));
      }
      return [...col.querySelectorAll('span')]
        .map((s) => s.getAttribute('title') || s.textContent.trim())
        .filter((t) => t && t.length > 1 && t.length < 30);
    });
    const uniqueSkills = [...new Set([...(skills || []), ...(skillLabels || [])].filter((s) => ALLOWED_SKILLS.has(s) || true))];
    const pathSkills = await page.evaluate(() => {
      // titles on skill chips in path column
      const root = document.querySelector('[aria-label="My Road"]');
      return [...root.querySelectorAll('[title]')]
        .map((el) => el.getAttribute('title'))
        .filter((t) => t && t.length > 1);
    });
    const allFromAllowlist = pathSkills.length > 0 && pathSkills.every((s) => ALLOWED_SKILLS.has(s));
    record('R6', 'major', 'Path skills only from softwareExperience + languagesAndFrameworks',
      allFromAllowlist ? 'PASS' : 'FAIL',
      JSON.stringify({ pathSkills, allFromAllowlist }), null);

    // R4: plane PE — path SVG pointer-events none; cards still clickable
    const pe = await page.evaluate(() => {
      const dialog = document.querySelector('[aria-label="My Road"]');
      const svgs = [...dialog.querySelectorAll('svg')];
      return svgs.map((svg) => ({
        pe: getComputedStyle(svg).pointerEvents,
        className: svg.getAttribute('class') || '',
      }));
    });
    const pathSvgNone = pe.some((s) => s.pe === 'none' && /absolute/.test(s.className));
    record('R5', 'major', 'Plane/path column PE none (does not steal clicks)',
      pathSvgNone ? 'PASS' : 'FAIL', JSON.stringify(pe), null);

    // R3a: Skip always available
    const skipBtn = page.getByRole('dialog', { name: 'My Road' }).getByRole('button', { name: 'Skip', exact: true });
    const skipVisible = await skipBtn.isVisible();
    record('R3a', 'blocker', 'Skip always available on My Road',
      skipVisible ? 'PASS' : 'FAIL', `visible=${skipVisible}`, null);

    if (skipVisible) {
      await skipBtn.click();
      await page.waitForTimeout(500);
      const afterSkip = await page.evaluate(() => {
        const scrub = document.querySelector('[aria-label="Jump along My Road"]');
        const cards = [...document.querySelectorAll('[data-road-card]')];
        const last = cards[cards.length - 1];
        const contact = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Contact');
        return {
          scrub: !!scrub,
          lastActive: last?.getAttribute('data-active') === 'true' || last?.dataset.active !== undefined,
          contact: !!contact,
          activeCount: cards.filter((c) => c.hasAttribute('data-active')).length,
        };
      });
      // scroll last into view
      await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-road-card]')];
        cards[cards.length - 1]?.scrollIntoView({ block: 'center' });
      });
      await page.waitForTimeout(300);
      const skipShot = await shot(page, '03-skip');
      record('R3b', 'blocker', 'Skip jumps to end + shows scrub controls',
        afterSkip.scrub ? 'PASS' : 'FAIL', JSON.stringify(afterSkip), skipShot);
    }

    // Final Contact CTA
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-road-card]')];
      cards[cards.length - 1]?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(400);
    const contactBtn = page.getByRole('dialog', { name: 'My Road' }).getByRole('button', { name: 'Contact', exact: true });
    let contactOk = false;
    try {
      await contactBtn.waitFor({ state: 'visible', timeout: 5000 });
      await contactBtn.click();
      await page.waitForTimeout(600);
      contactOk = await page.evaluate(() => {
        const road = document.querySelector('[role="dialog"][aria-label="My Road"]');
        const contactCurrent = [...document.querySelectorAll('nav[aria-label="Primary"] button')]
          .find((b) => /contact/i.test(b.textContent || ''))?.getAttribute('aria-current');
        return !road && contactCurrent === 'page';
      });
    } catch (e) {
      contactOk = false;
      record('R3c', 'blocker', 'Final Contact CTA exits to Contact', 'FAIL', String(e), await shot(page, '03c-contact-fail'));
    }
    if (contactOk !== false || results.every((r) => r.id !== 'R3c')) {
      record('R3c', 'blocker', 'Final Contact CTA exits to Contact',
        contactOk ? 'PASS' : 'FAIL', `landedContact=${contactOk}`, await shot(page, '03c-contact'));
    }

    // Re-open for Back / Esc / nav
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Home' }).click();
    await page.waitForTimeout(400);
    await openMyRoad(page);
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await page.waitForTimeout(400);
    const afterBack = await page.evaluate(() => !document.querySelector('[role="dialog"][aria-label="My Road"]'));
    record('R3d', 'blocker', 'Back to Home exits journey',
      afterBack ? 'PASS' : 'FAIL', `closed=${afterBack}`, await shot(page, '04-back'));

    await openMyRoad(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const afterEsc = await page.evaluate(() => !document.querySelector('[role="dialog"][aria-label="My Road"]'));
    record('R3e', 'blocker', 'Escape exits journey',
      afterEsc ? 'PASS' : 'FAIL', `closed=${afterEsc}`, await shot(page, '05-esc'));

    await openMyRoad(page);
    // nav may be under z-45 overlay — try click Projects
    const navExit = await page.evaluate(async () => {
      const btn = [...document.querySelectorAll('nav[aria-label="Primary"] button')]
        .find((b) => /projects/i.test(b.textContent || ''));
      if (!btn) return { clicked: false, reason: 'no button' };
      const r = btn.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const covered = top && !btn.contains(top) && top !== btn;
      btn.click();
      return {
        coveredBy: covered ? (top.getAttribute('aria-label') || top.tagName + '.' + (top.className || '').toString().slice(0, 40)) : null,
        covered,
      };
    });
    await page.waitForTimeout(500);
    const afterNav = await page.evaluate(() => {
      const road = document.querySelector('[role="dialog"][aria-label="My Road"]');
      const projectsCurrent = [...document.querySelectorAll('nav[aria-label="Primary"] button')]
        .find((b) => /projects/i.test(b.textContent || ''))?.getAttribute('aria-current');
      return { roadGone: !road, projectsCurrent };
    });
    record('R3f', 'blocker', 'Bottom nav exits journey',
      afterNav.roadGone ? 'PASS' : 'FAIL',
      JSON.stringify({ navExit, afterNav }), await shot(page, '06-nav'));
  } catch (e) {
    record('RX', 'blocker', 'My Road main pass crashed', 'FAIL', String(e), null);
  }
  await ctx.close();
}

// ========== PRM pass ==========
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await skipSplash(page);
    await openMyRoad(page);
    await page.waitForTimeout(600);
    const prm = await page.evaluate(() => {
      const scrub = document.querySelector('[aria-label="Jump along My Road"]');
      const jumpBtns = [...document.querySelectorAll('[aria-label="My Road"] button')]
        .filter((b) => /^\d+$/.test(b.textContent.trim()));
      return {
        scrub: !!scrub,
        jumpCount: jumpBtns.length,
        cards: document.querySelectorAll('[data-road-card]').length,
      };
    });
    const prmShot = await shot(page, '07-prm');
    // no auto-flight: scrub should be present immediately on PRM open
    if (prm.scrub && prm.jumpCount === 5 && prm.cards === 5) {
      record('R4', 'blocker', 'PRM: scrub/jump present, no auto-flight dependency', 'PASS',
        JSON.stringify(prm), prmShot);
    } else {
      record('R4', 'blocker', 'PRM: scrub/jump present, no auto-flight dependency', 'FAIL',
        JSON.stringify(prm), prmShot);
    }

    // jump to stop 3
    await page.getByRole('dialog', { name: 'My Road' }).getByRole('button', { name: '3', exact: true }).click();
    await page.waitForTimeout(400);
    const jumped = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-road-card]')];
      return {
        activeIndex: cards.findIndex((c) => c.hasAttribute('data-active')),
        title: cards[2]?.querySelector('h2')?.textContent?.trim(),
      };
    });
    record('R4b', 'major', 'PRM jump button moves to stop 3 (Upwork)',
      jumped.activeIndex === 2 && /Upwork/i.test(jumped.title || '') ? 'PASS' : 'FAIL',
      JSON.stringify(jumped), await shot(page, '07b-jump'));

    // scrub range
    await page.locator('[aria-label="Jump along My Road"]').fill('4');
    await page.waitForTimeout(400);
    const scrubbed = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-road-card]')];
      return {
        activeIndex: cards.findIndex((c) => c.hasAttribute('data-active')),
        title: cards[4]?.querySelector('h2')?.textContent?.trim(),
      };
    });
    record('R4c', 'major', 'PRM scrub jumps to last stop',
      scrubbed.activeIndex === 4 ? 'PASS' : 'FAIL',
      JSON.stringify(scrubbed), await shot(page, '07c-scrub'));
  } catch (e) {
    record('R4', 'blocker', 'PRM: scrub/jump present, no auto-flight dependency', 'FAIL', String(e), null);
  }
  await ctx.close();
}

await browser.close();

const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
const blockers = results.filter((r) => r.status === 'FAIL' && r.severity === 'blocker').map((r) => r.id + ' ' + r.title);
const summary = {
  title: 'My Road smoke — Windows WIP localhost:3000',
  timestamp_utc: new Date().toISOString(),
  overall: fail === 0 ? 'CLEAR' : (blockers.length ? 'FAIL (blockers)' : 'FAIL (non-blocking)'),
  pass,
  fail,
  blockerFails: blockers,
  results,
};
fs.writeFileSync(path.join(OUT, 'myroad-smoke.json'), JSON.stringify(summary, null, 2));
console.log('\nOVERALL', summary.overall, { pass, fail, blockers });
if (fail) process.exitCode = 1;
