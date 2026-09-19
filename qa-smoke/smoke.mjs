import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = process.env.SMOKE_URL || 'http://localhost:3000';
const findings = [];
const passes = [];
const consoleErrors = [];
const failedRequests = [];

function fail(title, severity, steps, expected, actual, evidence) {
  findings.push({ title, severity, steps, expected, actual, evidence });
}
function pass(title) {
  passes.push(title);
}

async function waitForNavVisible(page, timeout = 90000) {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.waitFor({ state: 'visible', timeout });
  // also ensure not opacity-hidden via pointer interaction
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    if (!n) return false;
    const s = getComputedStyle(n);
    return s.opacity !== '0' && s.pointerEvents !== 'none';
  }, null, { timeout });
  return nav;
}

async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function runDesktop(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[desktop] ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[desktop pageerror] ${err.message}`));
  page.on('requestfailed', (req) => {
    failedRequests.push(`[desktop] ${req.failure()?.errorText || 'fail'} ${req.url()}`);
  });

  const t0 = Date.now();
  const resp = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!resp || resp.status() !== 200) {
    fail('Homepage HTTP status', 'blocker', [`Open ${BASE}`], '200', String(resp?.status()), null);
  } else {
    pass('Homepage returns HTTP 200');
  }

  // Splash should appear (name / loading)
  const splashName = page.locator('[data-splash-name]').first();
  try {
    await splashName.waitFor({ state: 'visible', timeout: 15000 });
    pass('Splash intro renders name');
    await shot(page, '01-splash');
  } catch (e) {
    fail('Splash intro missing', 'major', [`Open ${BASE}`, 'Look for splash name'], 'Splash name visible', e.message, await shot(page, '01-splash-missing'));
  }

  // Wait for intro handoff / bottom nav
  try {
    await waitForNavVisible(page, 120000);
    const introMs = Date.now() - t0;
    passes.push(`Intro completes and bottom nav visible (~${introMs}ms)`);
    if (introMs > 45000) {
      fail('Intro duration very long', 'minor', [`Open ${BASE}`, 'Wait for bottom nav'], 'Intro finishes within ~45s', `${introMs}ms`, await shot(page, '02-home-slow-intro'));
    }
    await shot(page, '02-home');
  } catch (e) {
    fail('Bottom nav never appears after intro', 'blocker', [`Open ${BASE}`, 'Wait up to 120s for Primary nav'], 'Bottom nav visible and interactive', e.message, await shot(page, '02-nav-timeout'));
    await context.close();
    return;
  }

  // Home content
  const homeText = await page.locator('body').innerText();
  if (homeText && homeText.trim().length > 20) {
    pass('Home view has visible text content');
  } else {
    fail('Home view empty', 'major', ['After intro', 'Inspect home'], 'Meaningful home content', 'Sparse/empty body text', await shot(page, '02-home-empty'));
  }

  // Navigate Projects
  await page.getByRole('button', { name: /^Projects$/i }).click();
  await page.waitForTimeout(1500);
  await shot(page, '03-projects');

  // Wall/list toggle
  const wallBtn = page.getByRole('button', { name: /wall/i });
  const listBtn = page.getByRole('button', { name: /list/i });
  const toggleCount = await page.locator('button').evaluateAll((btns) =>
    btns.map((b) => (b.textContent || '').trim()).filter(Boolean)
  );
  const hasWall = await wallBtn.count();
  const hasList = await listBtn.count();
  if (hasWall && hasList) {
    pass('Projects wall/list toggle present');
    await listBtn.click();
    await page.waitForTimeout(800);
    await shot(page, '03b-projects-list');
    // Open first project from list if possible
    const projectButtons = page.locator('button, a, [role="button"]').filter({ hasText: /.+/ });
    // Prefer list items / cards
    const listCards = page.locator('[data-project], article, button').filter({ hasText: /./ });
    let opened = false;
    // Try clicking something that looks like a project title from list
    const candidates = page.locator('button:visible, a:visible');
    const n = await candidates.count();
    for (let i = 0; i < Math.min(n, 40); i++) {
      const el = candidates.nth(i);
      const label = ((await el.innerText().catch(() => '')) || '').trim();
      if (!label) continue;
      if (/^(home|projects|contact|wall|list|close)$/i.test(label)) continue;
      if (label.length < 2 || label.length > 80) continue;
      try {
        await el.click({ timeout: 2000 });
        await page.waitForTimeout(1200);
        const closeBtn = page.getByRole('button', { name: /close/i });
        if (await closeBtn.count()) {
          opened = true;
          pass(`Opened project overlay via "${label.slice(0, 40)}"`);
          await shot(page, '04-project-overlay');
          // Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(900);
          const still = await closeBtn.count();
          const closeVisible = still ? await closeBtn.first().isVisible().catch(() => false) : false;
          if (!closeVisible) {
            pass('Escape closes project overlay');
          } else {
            fail('Escape does not close project overlay', 'major', ['Open a project', 'Press Escape'], 'Overlay closes', 'Close control still visible', await shot(page, '04-escape-fail'));
            await closeBtn.first().click();
            await page.waitForTimeout(800);
          }
          break;
        }
      } catch {
        /* try next */
      }
    }
    if (!opened) {
      // try wall mode click
      if (hasWall) {
        await wallBtn.click();
        await page.waitForTimeout(1000);
      }
      fail('Could not open a project detail overlay', 'major', ['Go to Projects', 'Switch to List', 'Click a project card'], 'Project detail overlay opens with Close', `No overlay after trying candidates. Buttons seen: ${toggleCount.slice(0, 20).join(' | ')}`, await shot(page, '04-no-overlay'));
    } else {
      // Re-open and close via button
      await page.getByRole('button', { name: /^Projects$/i }).click();
      await page.waitForTimeout(600);
      if (hasList) await listBtn.click();
      await page.waitForTimeout(600);
    }
  } else {
    fail('Projects layout toggle missing', 'minor', ['Open Projects view'], 'Wall/List toggle visible', `wall=${hasWall} list=${hasList}; labels=${toggleCount.slice(0, 15).join(',')}`, await shot(page, '03-no-toggle'));
  }

  // Contact
  await page.getByRole('button', { name: /^Contact$/i }).click();
  await page.waitForTimeout(1200);
  await shot(page, '05-contact');
  const mailto = page.locator('a[href^="mailto:"]');
  const social = page.locator('a[href^="http"]');
  const mailtoCount = await mailto.count();
  const socialCount = await social.count();
  if (mailtoCount > 0) {
    const href = await mailto.first().getAttribute('href');
    if (href && href.includes('@')) pass(`Contact mailto present (${href})`);
    else fail('Mailto href invalid', 'major', ['Open Contact'], 'Valid mailto href', String(href), null);
  } else {
    fail('Contact mailto missing', 'major', ['Open Contact'], 'mailto link visible', 'none', await shot(page, '05-no-mailto'));
  }
  if (socialCount >= 1) {
    const hrefs = [];
    for (let i = 0; i < socialCount; i++) hrefs.push(await social.nth(i).getAttribute('href'));
    const bad = hrefs.filter((h) => !h || !/^https?:\/\//.test(h));
    if (bad.length) fail('Social link invalid href', 'major', ['Open Contact', 'Inspect social links'], 'http(s) hrefs', JSON.stringify(bad), null);
    else pass(`Social links OK (${hrefs.length}): ${hrefs.join(', ')}`);
  } else {
    fail('Social links missing on Contact', 'minor', ['Open Contact'], 'At least one social link', 'none', null);
  }

  // Back home
  await page.getByRole('button', { name: /^Home$/i }).click();
  await page.waitForTimeout(800);
  await shot(page, '06-home-return');
  pass('Bottom nav Home/Projects/Contact clicks without crash');

  await context.close();
}

async function runMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[mobile] ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[mobile pageerror] ${err.message}`));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await waitForNavVisible(page, 120000);
    await shot(page, 'm01-home');
    await page.getByRole('button', { name: /^Projects$/i }).click();
    await page.waitForTimeout(1200);
    await shot(page, 'm02-projects');
    await page.getByRole('button', { name: /^Contact$/i }).click();
    await page.waitForTimeout(1000);
    await shot(page, 'm03-contact');
    pass('Mobile viewport: nav + Projects + Contact reachable');
  } catch (e) {
    fail('Mobile smoke failed', 'major', ['Open site at 390x844', 'Wait for nav', 'Tap Projects and Contact'], 'Flows reachable', e.message, await shot(page, 'm-fail'));
  }
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runDesktop(browser);
  await runMobile(browser);
} finally {
  await browser.close();
}

const report = {
  base: BASE,
  generatedAt: new Date().toISOString(),
  passCount: passes.length,
  failCount: findings.length,
  passes,
  findings,
  consoleErrors: [...new Set(consoleErrors)].slice(0, 50),
  failedRequests: [...new Set(failedRequests)].slice(0, 50),
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const md = [
  `# Portfolio smoke report`,
  ``,
  `- Target: ${BASE}`,
  `- When: ${report.generatedAt}`,
  `- Passes: ${report.passCount}`,
  `- Failures: ${report.failCount}`,
  ``,
  `## Failures`,
  ...(findings.length
    ? findings.map(
        (f, i) =>
          `### ${i + 1}. ${f.title} (${f.severity})\n- Steps: ${f.steps.join(' → ')}\n- Expected: ${f.expected}\n- Actual: ${f.actual}\n- Evidence: ${f.evidence || 'n/a'}`
      )
    : ['None']),
  ``,
  `## Passes`,
  ...passes.map((p) => `- ${p}`),
  ``,
  `## Console errors`,
  ...(report.consoleErrors.length ? report.consoleErrors.map((e) => `- ${e}`) : ['None']),
  ``,
  `## Failed requests`,
  ...(report.failedRequests.length ? report.failedRequests.map((e) => `- ${e}`) : ['None']),
].join('\n');
fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
console.log(JSON.stringify({ passCount: report.passCount, failCount: report.failCount, findings: report.findings.map(f => ({ title: f.title, severity: f.severity })), consoleErrors: report.consoleErrors.slice(0, 10) }, null, 2));
