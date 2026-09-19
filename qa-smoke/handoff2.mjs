import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

function shot(name) {
  return page.screenshot({ path: path.join(OUT, `handoff2-${name}.png`) });
}

async function state() {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const navS = nav ? getComputedStyle(nav) : null;
    const splashNames = document.querySelectorAll("[data-splash-name]").length;
    const skip = [...document.querySelectorAll("button")].find((b) => /skip/i.test(b.textContent || ""));
    const spaceWraps = [...document.querySelectorAll("div")].filter((el) => {
      const s = getComputedStyle(el);
      return s.position === "fixed" && el.querySelector("canvas") && (el.getAttribute("aria-hidden") === "true" || (el.className || "").includes("pointer-events-none"));
    }).map((el) => {
      const s = getComputedStyle(el);
      return { opacity: s.opacity, z: s.zIndex, pe: s.pointerEvents, hasCanvas: !!el.querySelector("canvas") };
    });
    const canvases = [...document.querySelectorAll("canvas")].map((c) => {
      const r = c.getBoundingClientRect();
      const s = getComputedStyle(c);
      return { cssW: Math.round(r.width), cssH: Math.round(r.height), opacity: s.opacity, visible: r.width > 50 && r.height > 50 && s.opacity !== "0" };
    });
    const homeRoot = document.querySelector("[data-home-item], [data-home-portrait]")?.closest(".absolute, .relative") || null;
    let homeOpacity = null;
    if (homeRoot) homeOpacity = getComputedStyle(homeRoot).opacity;
    // climb to the PE home layer
    let layer = document.querySelector("[data-home-item]");
    while (layer && layer !== document.body) {
      if ((layer.className || "").includes("absolute") && (layer.className || "").includes("inset-0")) break;
      layer = layer.parentElement;
    }
    const homeLayer = layer ? { opacity: getComputedStyle(layer).opacity, pe: getComputedStyle(layer).pointerEvents, z: getComputedStyle(layer).zIndex } : null;
    return {
      navInteractive: !!(navS && navS.opacity !== "0" && navS.pe !== "none"),
      splashNames,
      skipVisible: !!(skip && getComputedStyle(skip).opacity !== "0" && skip.getBoundingClientRect().width > 0),
      spaceWraps,
      canvases,
      homeLayer,
      visibleCanvasCount: canvases.filter((c) => c.visible).length,
    };
  });
}

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
const t0 = Date.now();
let navAt = null;
let samples = [];
for (let i = 0; i < 100; i++) {
  const st = await state();
  const elapsed = Date.now() - t0;
  samples.push({ elapsed, ...st });
  if (st.navInteractive && navAt == null) {
    navAt = elapsed;
    await shot("nav");
    // Immediately open Projects for dual webgl while splash/space still likely up
    await page.getByRole("button", { name: /^Projects$/i }).click({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(700);
    const stP = await state();
    samples.push({ elapsed: Date.now() - t0, phase: "projects-just-after-nav", ...stP });
    await shot("projects-after-nav");
    break;
  }
  if (elapsed > 20000) break;
  await page.waitForTimeout(150);
}

// Continue sampling a few seconds after nav for space still present
for (let i = 0; i < 40; i++) {
  const st = await state();
  samples.push({ elapsed: Date.now() - t0, phase: "post-nav", ...st });
  if (!st.spaceWraps?.length && st.splashNames === 0) break;
  await page.waitForTimeout(150);
}
await shot("after-space-gone");

// MEDIUM 5+6: ensure projects list open overlay
await page.getByRole("button", { name: /^Projects$/i }).click().catch(() => {});
await page.waitForTimeout(800);
const list = page.getByRole("button", { name: /list/i });
if (await list.count()) await list.click();
await page.waitForTimeout(700);

let closeInfo = null;
const candidates = page.locator("button:visible");
const n = await candidates.count();
for (let i = 0; i < Math.min(n, 50); i++) {
  const el = candidates.nth(i);
  const label = ((await el.innerText().catch(() => "")) || "").trim();
  if (!label || /^(home|projects|contact|wall|list|close)$/i.test(label)) continue;
  if (label.length < 2 || label.length > 80) continue;
  await el.click({ timeout: 2000 }).catch(() => {});
  // sample ASAP
  closeInfo = await page.evaluate(() => {
    const close = [...document.querySelectorAll("button")].find((b) => /close/i.test(b.textContent || ""));
    if (!close) return { found: false };
    const s = getComputedStyle(close);
    return { found: true, opacity: s.opacity, focused: document.activeElement === close, text: (close.textContent || "").trim() };
  });
  await shot("close-immediate");
  await page.waitForTimeout(1000);
  closeInfo.after = await page.evaluate(() => {
    const close = [...document.querySelectorAll("button")].find((b) => /close/i.test(b.textContent || ""));
    if (!close) return null;
    return { opacity: getComputedStyle(close).opacity, focused: document.activeElement === close };
  });
  break;
}

let gate = null;
if (closeInfo?.found) {
  await page.getByRole("button", { name: /close/i }).click();
  const tClose = Date.now();
  await page.waitForTimeout(80);
  const wall = page.getByRole("button", { name: /wall/i });
  if (await wall.count()) await wall.click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(50);
  const box = await page.locator("canvas").first().boundingBox().catch(() => null);
  let early = false, late = false;
  if (box) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.waitForTimeout(400);
    early = await page.getByRole("button", { name: /close/i }).isVisible().catch(() => false);
    if (!early) {
      await page.waitForTimeout(900);
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await page.waitForTimeout(1500);
      late = await page.getByRole("button", { name: /close/i }).isVisible().catch(() => false);
    }
  }
  gate = { ms: Date.now() - tClose, early, late };
  await shot("gate");
}

const atNav = samples.find((s) => s.elapsed === navAt) || samples.find((s) => s.navInteractive);
const afterNavWithSpace = samples.filter((s) => navAt != null && s.elapsed >= navAt && (s.spaceWraps?.length > 0 || s.splashNames > 0));
const dual = samples.some((s) => s.phase === "projects-just-after-nav" && s.visibleCanvasCount >= 2);

const report = {
  navAt,
  high1: {
    // FAIL if after nav appears, SpaceField wrap still present while home may be shown
    spaceStillAfterNav: afterNavWithSpace.length > 0,
    firstAfterNav: afterNavWithSpace[0] || null,
    durationSpaceAfterNavMs: afterNavWithSpace.length ? afterNavWithSpace[afterNavWithSpace.length - 1].elapsed - navAt : 0,
    atNav,
  },
  high2: { dualWebglJustAfterNav: dual, sample: samples.find((s) => s.phase === "projects-just-after-nav") },
  medium5: closeInfo,
  medium6: gate,
};
fs.writeFileSync(path.join(OUT, "handoff2-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
