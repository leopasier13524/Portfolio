import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = 'http://localhost:3000';
const results = [];

function record(id, severity, title, status, notes, evidence) {
  results.push({ id, severity, title, status, notes, evidence });
}

async function shot(page, name) {
  const p = path.join(OUT, `handoff-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function navReady(page, timeout = 120000) {
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

async function sampleOverlayState(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const splash = document.querySelector('[aria-hidden][class*="z-[100]"], .z-\\[100\\], [class*="z-[100]"]')
      || document.querySelector('[data-splash-name]')?.closest('div[aria-hidden]');
    const splashRoot = document.querySelector('[data-splash-name]')?.parentElement?.parentElement?.parentElement?.parentElement
      || document.querySelector('[data-splash-name]')?.closest('[aria-hidden]');
    // find splash via data-splash-name ancestor with fixed inset
    let splashEl = document.querySelector('[data-splash-name]');
    while (splashEl && splashEl !== document.body) {
      const s = getComputedStyle(splashEl);
      if (s.position === 'fixed' && (splashEl.className || '').includes('inset-0')) break;
      splashEl = splashEl.parentElement;
    }
    const canvases = [...document.querySelectorAll('canvas')].map((c) => {
      const r = c.getBoundingClientRect();
      const s = getComputedStyle(c);
      return {
        w: c.width, h: c.height,
        cssW: Math.round(r.width), cssH: Math.round(r.height),
        visible: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0' && s.display !== 'none',
        opacity: s.opacity,
        pe: s.pointerEvents,
      };
    });
    const webglContexts = canvases.filter((c) => c.visible && c.cssW > 100 && c.cssH > 100).length;
    const homeSolidish = (() => {
      // heuristic: look for home portrait / text content opacity
      const homeItems = document.querySelectorAll('[data-home-item], [data-home-portrait]');
      let visible = 0;
      homeItems.forEach((el) => {
        const s = getComputedStyle(el);
        if (parseFloat(s.opacity) > 0.2 && s.visibility !== 'hidden') visible++;
      });
      return { homeItemVisible: visible, homeItemTotal: homeItems.length };
    })();
    const spaceWrap = (() => {
      // PortfolioExperience wraps SpaceField in a fixed inset div
      const fixed = [...document.querySelectorAll('div.fixed, div[class*="fixed"]')].filter((el) => {
        const s = getComputedStyle(el);
        return s.position === 'fixed' && el.querySelector('canvas');
      });
      return fixed.map((el) => {
        const s = getComputedStyle(el);
        return { opacity: s.opacity, pe: s.pointerEvents, z: s.zIndex, className: el.className.slice(0, 120) };
      });
    })();
    const navS = nav ? getComputedStyle(nav) : null;
    const splashS = splashEl ? getComputedStyle(splashEl) : null;
    return {
      t: performance.now(),
      nav: navS ? { opacity: navS.opacity, pe: navS.pointerEvents, z: navS.zIndex } : null,
      splash: splashS ? {
        opacity: splashS.opacity,
        pe: splashS.pointerEvents,
        z: splashS.zIndex,
        display: splashS.display,
        className: (splashEl.className || '').toString().slice(0, 160),
        inDom: true,
      } : { inDom: !!document.querySelector('[data-splash-name]') },
      canvases,
      webglLikeVisible: webglContexts,
      homeSolidish,
      spaceWrap,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const timeline = [];
const t0 = Date.now();

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Poll during intro for HIGH1/HIGH2/MEDIUM3
let navAppearedAt = null;
let introDoneAt = null;
let midWindowProjectsOpened = false;
let dualWebglObserved = false;
let splashBlockingNav = false;
let spaceOverlayAfterNav = false;

for (let i = 0; i < 80; i++) {
  const st = await sampleOverlayState(page);
  const elapsed = Date.now() - t0;
  timeline.push({ elapsed, ...st });

  const navInteractive = st.nav && st.nav.opacity !== '0' && st.nav.pe !== 'none';
  if (navInteractive && navAppearedAt === null) {
    navAppearedAt = elapsed;
    await shot(page, '01-nav-appeared');
    // HIGH1: after nav, is SpaceField still fully opaque overlaying home?
    const spaceOpaque = (st.spaceWrap || []).some((w) => parseFloat(w.opacity) > 0.9);
    const homeWeak = st.homeSolidish.homeItemVisible === 0;
    if (spaceOpaque) {
      spaceOverlayAfterNav = true;
    }
    // MEDIUM3: can we click nav while splash still in DOM with high z?
    if (st.splash?.inDom && st.splash.opacity !== '0') {
      // try clicking Projects immediately
      const before = elapsed;
      try {
        await page.getByRole('button', { name: /^Projects$/i }).click({ timeout: 800, force: false });
        await page.waitForTimeout(200);
        // if still on home-ish and click didn't register - hard to know; check aria
        splashBlockingNav = false; // click succeeded
        // go back home for continued sampling if we switched
        const projectsActive = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('nav[aria-label="Primary"] button')];
          const p = btns.find((b) => /projects/i.test(b.textContent || ''));
          return p && (getComputedStyle(p).color === 'rgb(0, 0, 0)' || (p.className || '').includes('text-black'));
        });
        if (projectsActive) {
          // switched during intro window - HIGH2 check canvases
          midWindowProjectsOpened = true;
          const st2 = await sampleOverlayState(page);
          if (st2.webglLikeVisible >= 2) dualWebglObserved = true;
          await shot(page, '02-projects-during-intro-window');
          await page.getByRole('button', { name: /^Home$/i }).click({ timeout: 2000 }).catch(() => {});
        }
      } catch (e) {
        splashBlockingNav = true;
        await shot(page, '02-nav-click-blocked');
      }
    }
  }

  // detect splash gone / intro finished roughly when splash leaves DOM or opacity 0 and home items visible
  if (navAppearedAt !== null && introDoneAt === null) {
    if (!st.splash?.inDom || st.splash.opacity === '0') {
      // splash unmounted when data-splash-name gone
    }
    if (!st.splash?.inDom) {
      // handled below
    }
    const splashGone = !(await page.locator('[data-splash-name]').count());
    if (splashGone && st.homeSolidish.homeItemVisible > 0) {
      introDoneAt = elapsed;
      await shot(page, '03-intro-done');
    }
  }

  // dedicated HIGH2 attempt: if nav up and splash still present, open Projects and count canvases
  if (navAppearedAt !== null && introDoneAt === null && !midWindowProjectsOpened && elapsed - navAppearedAt < 3000) {
    const splashStill = await page.locator('[data-splash-name]').count();
    if (splashStill > 0) {
      try {
        await page.getByRole('button', { name: /^Projects$/i }).click({ timeout: 500 });
        await page.waitForTimeout(600);
        midWindowProjectsOpened = true;
        const st2 = await sampleOverlayState(page);
        if (st2.webglLikeVisible >= 2) dualWebglObserved = true;
        await shot(page, '02b-dual-webgl-check');
        timeline.push({ elapsed: Date.now() - t0, dualCheck: st2 });
      } catch {}
    }
  }

  if (introDoneAt !== null && elapsed > introDoneAt + 500) break;
  if (elapsed > 20000) break;
  await page.waitForTimeout(200);
}

// Ensure we end on a settled home/projects for remaining checks
await page.waitForTimeout(500);
await navReady(page, 30000).catch(() => {});

// MEDIUM 4: ProjectsViewToggle tabbable when hidden (on Home, toggle should be hidden)
await page.getByRole('button', { name: /^Home$/i }).click().catch(() => {});
await page.waitForTimeout(800);
const toggleA11yHome = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')].filter((b) => /wall|list/i.test(b.textContent || '') || /wall|list/i.test(b.getAttribute('aria-label') || ''));
  // also look for toggle container near bottom-left
  const all = [...document.querySelectorAll('button, [role="tab"], [role="radio"]')];
  const candidates = all.filter((el) => {
    const t = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
    return t.includes('wall') || t.includes('list') || el.closest('[class*="bottom"]');
  });
  // Find visually hidden toggle buttons via opacity on self or ancestor
  const findings = [];
  for (const el of all) {
    let cur = el;
    let hiddenVisual = false;
    let inert = el.hasAttribute('inert') || el.closest('[inert]') != null;
    let ariaHidden = el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]') != null;
    let tabIndex = el.tabIndex;
    while (cur && cur !== document.body) {
      const s = getComputedStyle(cur);
      if (parseFloat(s.opacity) === 0 || s.visibility === 'hidden') hiddenVisual = true;
      cur = cur.parentElement;
    }
    const label = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40);
    if (hiddenVisual && /wall|list/i.test(label + (el.getAttribute('aria-label') || ''))) {
      findings.push({ label, tabIndex, inert, ariaHidden, disabled: el.disabled });
    }
  }
  // broader: any button with opacity-0 ancestor that looks like view toggle
  const toggleRoot = [...document.querySelectorAll('div, nav, section')].find((el) => {
    const txt = el.textContent || '';
    return /wall/i.test(txt) && /list/i.test(txt) && el.querySelectorAll('button').length >= 2;
  });
  let toggleInfo = null;
  if (toggleRoot) {
    const s = getComputedStyle(toggleRoot);
    const btns = [...toggleRoot.querySelectorAll('button')].map((b) => ({
      label: (b.textContent || '').trim(),
      tabIndex: b.tabIndex,
      disabled: b.disabled,
    }));
    toggleInfo = {
      opacity: s.opacity,
      pe: s.pointerEvents,
      inert: toggleRoot.hasAttribute('inert') || toggleRoot.closest('[inert]') != null,
      ariaHidden: toggleRoot.getAttribute('aria-hidden') === 'true',
      btns,
    };
  }
  return { findings, toggleInfo };
});
await shot(page, '04-home-toggle-hidden');

// MEDIUM 5: open project overlay, check Close opacity at focus moment
await page.getByRole('button', { name: /^Projects$/i }).click();
await page.waitForTimeout(1000);
const list = page.getByRole('button', { name: /list/i });
if (await list.count()) { await list.click(); await page.waitForTimeout(600); }
let closeFocusInfo = null;
{
  const candidates = page.locator('button:visible');
  const n = await candidates.count();
  for (let i = 0; i < Math.min(n, 40); i++) {
    const el = candidates.nth(i);
    const label = ((await el.innerText().catch(() => '')) || '').trim();
    if (!label || /^(home|projects|contact|wall|list|close)$/i.test(label)) continue;
    if (label.length < 2 || label.length > 80) continue;
    await el.click({ timeout: 2000 }).catch(() => {});
    // immediately sample close button opacity vs focus
    closeFocusInfo = await page.evaluate(() => {
      const close = [...document.querySelectorAll('button')].find((b) => /close/i.test(b.textContent || ''));
      if (!close) return { found: false };
      const s = getComputedStyle(close);
      return {
        found: true,
        opacity: s.opacity,
        focused: document.activeElement === close,
        activeTag: document.activeElement?.tagName,
        activeText: (document.activeElement?.textContent || '').trim().slice(0, 20),
      };
    });
    await shot(page, '05-close-focus');
    // wait a bit and sample again after intro anim
    await page.waitForTimeout(1100);
    const after = await page.evaluate(() => {
      const close = [...document.querySelectorAll('button')].find((b) => /close/i.test(b.textContent || ''));
      if (!close) return null;
      const s = getComputedStyle(close);
      return { opacity: s.opacity, focused: document.activeElement === close };
    });
    closeFocusInfo.afterAnim = after;
    break;
  }
}

// MEDIUM 6: close overlay, immediately try drag/click within ~0.35s
let gateInfo = null;
{
  const closeBtn = page.getByRole('button', { name: /close/i });
  if (await closeBtn.count()) {
    await closeBtn.click();
    const tClose = Date.now();
    // switch to wall quickly
    const wall = page.getByRole('button', { name: /wall/i });
    // may already be closing
    await page.waitForTimeout(50);
    if (await wall.count()) await wall.click({ timeout: 500 }).catch(() => {});
    // attempt pointerdown immediately
    const early = await page.evaluate(() => {
      const mount = document.querySelector('[aria-label="Interactive project wall gallery"], .cursor-grab');
      return {
        mountFound: !!mount,
        pe: mount ? getComputedStyle(mount).pointerEvents : null,
        parentPe: mount?.parentElement ? getComputedStyle(mount.parentElement).pointerEvents : null,
      };
    });
    const box = await page.locator('canvas').first().boundingBox().catch(() => null);
    let reopenEarly = false;
    let reopenLate = false;
    if (box) {
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await page.waitForTimeout(300);
      reopenEarly = await page.getByRole('button', { name: /close/i }).isVisible().catch(() => false);
      // wait past settle
      await page.waitForTimeout(800);
      if (!reopenEarly) {
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
        await page.waitForTimeout(1500);
        reopenLate = await page.getByRole('button', { name: /close/i }).isVisible().catch(() => false);
      }
    }
    gateInfo = {
      msSinceClose: Date.now() - tClose,
      early,
      reopenEarly,
      reopenLate,
    };
    await shot(page, '06-after-close-gate');
  }
}

// Finalize HIGH judgments from timeline
const afterNavSamples = timeline.filter((s) => navAppearedAt != null && s.elapsed >= navAppearedAt && (introDoneAt == null || s.elapsed <= introDoneAt));
const spaceOpaqueWhileNav = afterNavSamples.some((s) => (s.spaceWrap || []).some((w) => parseFloat(w.opacity) > 0.85));
const homeWeakWhileNav = afterNavSamples.some((s) => s.homeSolidish?.homeItemVisible === 0);

// HIGH1: SpaceField still overlays until finishIntro after nav appears
if (navAppearedAt != null && (introDoneAt == null || introDoneAt - navAppearedAt > 800) && spaceOpaqueWhileNav) {
  record(1, 'HIGH', 'SpaceField overlays home after BottomNav appears until finishIntro', 'FAIL',
    `navAt=${navAppearedAt}ms introDoneAt=${introDoneAt}ms gap=${introDoneAt && navAppearedAt ? introDoneAt - navAppearedAt : 'n/a'}ms; space opaque while nav up observed=${spaceOpaqueWhileNav}; homeWeak=${homeWeakWhileNav}`,
    'handoff-01-nav-appeared.png');
} else if (navAppearedAt == null) {
  record(1, 'HIGH', 'SpaceField overlays home after BottomNav appears until finishIntro', 'INCONCLUSIVE', 'BottomNav never became interactive in 20s', null);
} else {
  record(1, 'HIGH', 'SpaceField overlays home after BottomNav appears until finishIntro', 'PASS',
    `navAt=${navAppearedAt}ms introDoneAt=${introDoneAt}ms; no strong space-opaque-after-nav gap observed (gap=${introDoneAt && navAppearedAt ? introDoneAt - navAppearedAt : 0}ms)`,
    null);
}

// HIGH2 dual WebGL
if (dualWebglObserved) {
  record(2, 'HIGH', 'Dual WebGL if Projects opened before finishIntro', 'FAIL',
    `Opened Projects in intro window; visible webgl-like canvases >= 2. midWindowProjectsOpened=${midWindowProjectsOpened}`,
    'handoff-02b-dual-webgl-check.png');
} else if (midWindowProjectsOpened) {
  record(2, 'HIGH', 'Dual WebGL if Projects opened before finishIntro', 'PASS',
    'Opened Projects during intro window; did not observe >=2 large visible canvases',
    null);
} else {
  record(2, 'HIGH', 'Dual WebGL if Projects opened before finishIntro', 'INCONCLUSIVE',
    `Could not open Projects in the nav-before-finishIntro window (navAt=${navAppearedAt}, introDoneAt=${introDoneAt})`,
    null);
}

// MEDIUM3 splash blocks nav
if (splashBlockingNav) {
  record(3, 'MEDIUM', 'Splash z-100 briefly blocks nav clicks at handoff', 'FAIL',
    'Projects click failed while splash still present after nav appeared',
    'handoff-02-nav-click-blocked.png');
} else if (navAppearedAt != null) {
  record(3, 'MEDIUM', 'Splash z-100 briefly blocks nav clicks at handoff', 'PASS',
    'Nav click succeeded (or splash already pointer-events-none) at handoff',
    null);
} else {
  record(3, 'MEDIUM', 'Splash z-100 briefly blocks nav clicks at handoff', 'INCONCLUSIVE', 'No nav handoff', null);
}

// MEDIUM4 toggle tabbable when hidden
if (toggleA11yHome.toggleInfo && parseFloat(toggleA11yHome.toggleInfo.opacity) === 0) {
  const tabbable = toggleA11yHome.toggleInfo.btns.some((b) => b.tabIndex >= 0 && !b.disabled);
  const protected_ = toggleA11yHome.toggleInfo.inert || toggleA11yHome.toggleInfo.ariaHidden;
  if (tabbable && !protected_) {
    record(4, 'MEDIUM', 'ProjectsViewToggle tabbable when visually hidden', 'FAIL',
      `On Home, toggle opacity=0 but still tabbable; inert=${toggleA11yHome.toggleInfo.inert} ariaHidden=${toggleA11yHome.toggleInfo.ariaHidden}; btns=${JSON.stringify(toggleA11yHome.toggleInfo.btns)}`,
      'handoff-04-home-toggle-hidden.png');
  } else {
    record(4, 'MEDIUM', 'ProjectsViewToggle tabbable when visually hidden', 'PASS',
      `Hidden toggle protected or not tabbable: ${JSON.stringify(toggleA11yHome.toggleInfo)}`,
      null);
  }
} else if (toggleA11yHome.findings?.length) {
  const bad = toggleA11yHome.findings.filter((f) => f.tabIndex >= 0 && !f.inert && !f.ariaHidden && !f.disabled);
  record(4, 'MEDIUM', 'ProjectsViewToggle tabbable when visually hidden', bad.length ? 'FAIL' : 'PASS',
    JSON.stringify(toggleA11yHome.findings), 'handoff-04-home-toggle-hidden.png');
} else {
  record(4, 'MEDIUM', 'ProjectsViewToggle tabbable when visually hidden', 'INCONCLUSIVE',
    `Could not locate wall/list toggle on Home: ${JSON.stringify(toggleA11yHome)}`, null);
}

// MEDIUM5 close focus while opacity 0
if (closeFocusInfo?.found) {
  const op = parseFloat(closeFocusInfo.opacity);
  if (closeFocusInfo.focused && op < 0.1) {
    record(5, 'MEDIUM', 'Overlay Close focused while still opacity-0', 'FAIL',
      `Close focused at opacity=${closeFocusInfo.opacity}; afterAnim=${JSON.stringify(closeFocusInfo.afterAnim)}`,
      'handoff-05-close-focus.png');
  } else {
    record(5, 'MEDIUM', 'Overlay Close focused while still opacity-0', 'PASS',
      `focused=${closeFocusInfo.focused} opacity=${closeFocusInfo.opacity} after=${JSON.stringify(closeFocusInfo.afterAnim)}`,
      null);
  }
} else {
  record(5, 'MEDIUM', 'Overlay Close focused while still opacity-0', 'INCONCLUSIVE', 'Could not open project overlay', null);
}

// MEDIUM6 focusTimeline gate after close
if (gateInfo) {
  if (!gateInfo.reopenEarly && gateInfo.reopenLate) {
    record(6, 'MEDIUM', 'After wall open→close, focusTimeline gates pointer briefly', 'FAIL',
      `Immediate reopen failed; later reopen worked. ${JSON.stringify(gateInfo)}`,
      'handoff-06-after-close-gate.png');
  } else if (gateInfo.reopenEarly || gateInfo.reopenLate) {
    record(6, 'MEDIUM', 'After wall open→close, focusTimeline gates pointer briefly', 'PASS',
      `reopenEarly=${gateInfo.reopenEarly} reopenLate=${gateInfo.reopenLate}`,
      null);
  } else {
    record(6, 'MEDIUM', 'After wall open→close, focusTimeline gates pointer briefly', 'FAIL',
      `Could not reopen after close (early or late). ${JSON.stringify(gateInfo)}`,
      'handoff-06-after-close-gate.png');
  }
} else {
  record(6, 'MEDIUM', 'After wall open→close, focusTimeline gates pointer briefly', 'INCONCLUSIVE', 'No overlay close performed', null);
}

const report = {
  generatedAt: new Date().toISOString(),
  navAppearedAt,
  introDoneAt,
  midWindowProjectsOpened,
  dualWebglObserved,
  splashBlockingNav,
  results,
  consoleErrors: [...new Set(consoleErrors)].slice(0, 30),
  timelineSummary: {
    samples: timeline.length,
    first: timeline[0],
    atNav: timeline.find((s) => navAppearedAt && Math.abs(s.elapsed - navAppearedAt) < 300),
  },
};
fs.writeFileSync(path.join(OUT, 'handoff-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ results, navAppearedAt, introDoneAt, dualWebglObserved, consoleErrors: report.consoleErrors.slice(0, 5) }, null, 2));
await browser.close();
