import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const results = [];
const rec = (id, title, status, notes) => results.push({ id, title, status, notes });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

async function navReady() {
  await page.getByRole("navigation", { name: "Primary" }).waitFor({ state: "visible", timeout: 120000 });
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    if (!n) return false;
    const s = getComputedStyle(n);
    return s.opacity !== "0" && s.pointerEvents !== "none";
  }, null, { timeout: 120000 });
}

async function snapshot() {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const navS = nav ? getComputedStyle(nav) : null;
    const splashNames = document.querySelectorAll("[data-splash-name]").length;
    const spaceWraps = [...document.querySelectorAll("div")].filter((el) => {
      const s = getComputedStyle(el);
      return s.position === "fixed" && !!el.querySelector("canvas") && (el.getAttribute("aria-hidden") === "true" || (el.className || "").includes("pointer-events-none"));
    }).map((el) => ({ opacity: getComputedStyle(el).opacity, z: getComputedStyle(el).zIndex }));
    const canvases = [...document.querySelectorAll("canvas")].map((c) => {
      const r = c.getBoundingClientRect();
      const s = getComputedStyle(c);
      return { w: Math.round(r.width), h: Math.round(r.height), opacity: s.opacity, visible: r.width > 80 && r.height > 80 && s.opacity !== "0" && s.visibility !== "hidden" };
    });
    const splashRoot = document.querySelector("[data-splash-name]")?.closest(".fixed, [class*=fixed]");
    let splash = null;
    let el = document.querySelector("[data-splash-name]");
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (s.position === "fixed") { splash = { opacity: s.opacity, pe: s.pointerEvents, inert: el.hasAttribute("inert") || el.closest("[inert]") != null, ariaHidden: el.getAttribute("aria-hidden") === "true", z: s.zIndex }; break; }
      el = el.parentElement;
    }
    const toggleRoot = document.querySelector('[aria-label="Projects layout"]')?.parentElement;
    let toggle = null;
    if (toggleRoot) {
      const s = getComputedStyle(toggleRoot);
      const btns = [...toggleRoot.querySelectorAll("button")].map((b) => ({ label: b.getAttribute("aria-label"), tabIndex: b.tabIndex }));
      toggle = { opacity: s.opacity, inert: toggleRoot.hasAttribute("inert") || toggleRoot.closest("[inert]") != null, ariaHidden: toggleRoot.getAttribute("aria-hidden") === "true", btns };
    }
    return {
      navInteractive: !!(navS && navS.opacity !== "0" && navS.pe !== "none"),
      splashNames,
      splash,
      spaceWraps,
      visibleCanvases: canvases.filter((c) => c.visible).length,
      canvases,
      toggle,
    };
  });
}

await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
const t0 = Date.now();
let atNav = null;
for (let i = 0; i < 120; i++) {
  const st = await snapshot();
  if (st.navInteractive) { atNav = { elapsed: Date.now() - t0, ...st }; break; }
  if (Date.now() - t0 > 20000) break;
  await page.waitForTimeout(100);
}
await page.screenshot({ path: path.join(OUT, "retest-01-nav.png") });

// 1 SpaceField gone at nav
if (!atNav) rec(1, "No SpaceField overlay after nav", "FAIL", "BottomNav never interactive");
else if ((atNav.spaceWraps || []).length === 0 && atNav.splashNames === 0)
  rec(1, "No SpaceField overlay after nav", "PASS", `navAt=${atNav.elapsed}ms; no space wraps; splashNames=0`);
else
  rec(1, "No SpaceField overlay after nav", "FAIL", `spaceWraps=${JSON.stringify(atNav.spaceWraps)} splashNames=${atNav.splashNames}`);

// 2 dual webgl - open Projects immediately
await page.getByRole("button", { name: /^Projects$/i }).click();
await page.waitForTimeout(800);
const afterProj = await snapshot();
await page.screenshot({ path: path.join(OUT, "retest-02-projects.png") });
if (afterProj.visibleCanvases <= 1)
  rec(2, "No dual WebGL on early Projects", "PASS", `visibleCanvases=${afterProj.visibleCanvases}`);
else
  rec(2, "No dual WebGL on early Projects", "FAIL", `visibleCanvases=${afterProj.visibleCanvases} canvases=${JSON.stringify(afterProj.canvases)}`);

// 3 splash not blocking - already clicked Projects successfully at nav; also check splash inert state if present
if (atNav && (!atNav.splash || atNav.splash.pe === "none" || atNav.splash.inert || atNav.splashNames === 0))
  rec(3, "Splash does not block nav after intro", "PASS", `Projects click at handoff worked; splash=${JSON.stringify(atNav.splash)} names=${atNav.splashNames}`);
else
  rec(3, "Splash does not block nav after intro", "FAIL", JSON.stringify(atNav?.splash));

// 4 toggle not tabbable on Home
await page.getByRole("button", { name: /^Home$/i }).click();
await page.waitForTimeout(700);
const homeSnap = await snapshot();
if (homeSnap.toggle && parseFloat(homeSnap.toggle.opacity) === 0 && homeSnap.toggle.inert && homeSnap.toggle.ariaHidden && homeSnap.toggle.btns.every((b) => b.tabIndex < 0))
  rec(4, "ProjectsViewToggle not tabbable when hidden", "PASS", JSON.stringify(homeSnap.toggle));
else if (homeSnap.toggle && homeSnap.toggle.inert && homeSnap.toggle.btns.every((b) => b.tabIndex < 0))
  rec(4, "ProjectsViewToggle not tabbable when hidden", "PASS", JSON.stringify(homeSnap.toggle));
else
  rec(4, "ProjectsViewToggle not tabbable when hidden", "FAIL", JSON.stringify(homeSnap.toggle));

// 5 Close focus after visible
await page.getByRole("button", { name: /^Projects$/i }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /list view/i }).click();
await page.waitForTimeout(800);
const opened = await page.evaluate(() => {
  const el = [...document.querySelectorAll("button")].find((e) => {
    const t = (e.textContent || "");
    const r = e.getBoundingClientRect();
    return /MealLi 2\.0/i.test(t) && !e.disabled && !e.closest("[inert]") && r.width > 400;
  });
  if (!el) return false;
  el.click();
  return true;
});
const samples = [];
for (let i = 0; i < 25; i++) {
  samples.push(await page.evaluate(() => {
    const close = [...document.querySelectorAll("button")].find((b) => ((b.textContent || "").trim() === "Close" || /^Close$/i.test((b.textContent || "").trim())));
    // button whose visible label is Close
    const closeBtn = [...document.querySelectorAll("button")].find((b) => {
      const span = b.querySelector("span");
      return span && span.textContent?.trim() === "Close";
    });
    const btn = closeBtn || close;
    const root = document.querySelector('[role="dialog"]');
    if (!btn) return { found: false };
    return {
      found: true,
      closeOpacity: parseFloat(getComputedStyle(btn).opacity),
      rootOpacity: root ? parseFloat(getComputedStyle(root).opacity) : null,
      focused: document.activeElement === btn,
    };
  }));
  await page.waitForTimeout(30);
}
await page.screenshot({ path: path.join(OUT, "retest-05-close.png") });
const badFocus = samples.some((s) => s.found && s.focused && s.closeOpacity < 0.05);
const goodFocus = samples.some((s) => s.found && s.focused && s.closeOpacity > 0.2);
if (!opened) rec(5, "Overlay Close focus waits until visible", "INCONCLUSIVE", "Could not open MealLi 2.0");
else if (badFocus) rec(5, "Overlay Close focus waits until visible", "FAIL", `focused while opacity~0; samples=${JSON.stringify(samples.filter(s=>s.found).slice(0,6))}`);
else rec(5, "Overlay Close focus waits until visible", "PASS", `no focus while invisible; laterFocused=${goodFocus}; first=${JSON.stringify(samples.find(s=>s.found))}`);

// 6 wall interactive immediately after close
let r6 = { opened: false };
if (samples.some((s) => s.found)) {
  await page.locator("button").filter({ hasText: /^Close$/ }).first().click({ force: true });
  const tClose = Date.now();
  await page.getByRole("button", { name: /wall view/i }).click({ force: true }).catch(() => {});
  // immediate attempts within ~150ms
  await page.waitForTimeout(50);
  const box = await page.locator("canvas").first().boundingBox();
  let dragDiffImmediate = 0;
  let reopenImmediate = false;
  let reopenAfter250 = false;
  if (box) {
    const before = await page.screenshot();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width / 2 + i * 26, box.y + box.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(120);
    const after = await page.screenshot();
    const n = Math.min(before.length, after.length);
    for (let i = 0; i < n; i++) if (before[i] !== after[i]) dragDiffImmediate++;
    // try open immediately
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.42);
    await page.waitForTimeout(500);
    reopenImmediate = await page.locator("button").filter({ hasText: /^Close$/ }).first().isVisible().catch(() => false);
    if (!reopenImmediate) {
      await page.waitForTimeout(200);
      await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.4);
      await page.waitForTimeout(1200);
      reopenAfter250 = await page.locator("button").filter({ hasText: /^Close$/ }).first().isVisible().catch(() => false);
    }
  }
  r6 = { ms: Date.now() - tClose, dragDiffImmediate, reopenImmediate, reopenAfter250 };
  await page.screenshot({ path: path.join(OUT, "retest-06-wall.png") });
  if (dragDiffImmediate > 5000 || reopenImmediate || reopenAfter250)
    rec(6, "Wall interactive right after overlay close", "PASS", JSON.stringify(r6));
  else
    rec(6, "Wall interactive right after overlay close", "FAIL", JSON.stringify(r6));
} else {
  // fallback wall-stuck path
  await page.getByRole("button", { name: /wall view/i }).click().catch(() => {});
  await page.waitForTimeout(800);
  const box = await page.locator("canvas").first().boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.waitForTimeout(2000);
    const openedWall = await page.locator("button").filter({ hasText: /^Close$/ }).first().isVisible().catch(() => false);
    if (openedWall) {
      await page.locator("button").filter({ hasText: /^Close$/ }).first().click();
      await page.waitForTimeout(80);
      const before = await page.screenshot();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width / 2 + i * 26, box.y + box.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(150);
      const after = await page.screenshot();
      let diff = 0; const n = Math.min(before.length, after.length);
      for (let i = 0; i < n; i++) if (before[i] !== after[i]) diff++;
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await page.waitForTimeout(1500);
      const reopen = await page.locator("button").filter({ hasText: /^Close$/ }).first().isVisible().catch(() => false);
      r6 = { path: "wall-only", diff, reopen };
      rec(6, "Wall interactive right after overlay close", reopen || diff > 5000 ? "PASS" : "FAIL", JSON.stringify(r6));
    } else rec(6, "Wall interactive right after overlay close", "INCONCLUSIVE", "could not open via wall");
  } else rec(6, "Wall interactive right after overlay close", "INCONCLUSIVE", "no canvas");
}

const report = { results, atNavElapsed: atNav?.elapsed, r6, consoleErrors: [...new Set(consoleErrors)].slice(0, 20) };
fs.writeFileSync(path.join(OUT, "retest-6-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
