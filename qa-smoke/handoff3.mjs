import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.getByRole("navigation", { name: "Primary" }).waitFor({ state: "visible", timeout: 120000 });
await page.waitForFunction(() => {
  const n = document.querySelector('nav[aria-label="Primary"]');
  if (!n) return false;
  const s = getComputedStyle(n);
  return s.opacity !== "0" && s.pointerEvents !== "none";
}, null, { timeout: 120000 });
await page.waitForTimeout(500);

// MEDIUM 4 static+live
const m4 = await page.evaluate(() => {
  const group = document.querySelector('[aria-label="Projects layout"]');
  if (!group) return { found: false };
  const root = group.parentElement;
  const s = getComputedStyle(root);
  const btns = [...group.querySelectorAll("button")].map((b) => ({
    label: b.getAttribute("aria-label") || b.textContent,
    tabIndex: b.tabIndex,
  }));
  return {
    found: true,
    opacity: s.opacity,
    pe: s.pointerEvents,
    inert: root.hasAttribute("inert") || root.closest("[inert]") != null,
    ariaHidden: root.getAttribute("aria-hidden") === "true" || group.getAttribute("aria-hidden") === "true",
    btns,
  };
});

await page.getByRole("button", { name: /^Projects$/i }).click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /list view/i }).click().catch(async () => {
  await page.getByRole("button", { name: /^List$/i }).click();
});
await page.waitForTimeout(800);

// open first project card in list
const opened = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("button, a, [role='button']")];
  for (const el of cards) {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || /^(home|projects|contact|wall|list|close|wall view|list view)$/i.test(t)) continue;
    if (t.length < 3 || t.length > 60) continue;
    el.click();
    return t.slice(0, 40);
  }
  return null;
});
await page.waitForTimeout(50);
const closeImmediate = await page.evaluate(() => {
  const close = [...document.querySelectorAll("button")].find((b) => /close/i.test(b.textContent || ""));
  if (!close) return { found: false };
  const s = getComputedStyle(close);
  return { found: true, opacity: s.opacity, focused: document.activeElement === close, active: (document.activeElement?.textContent || "").trim().slice(0, 30) };
});
await page.screenshot({ path: path.join(OUT, "m5-immediate.png") });
await page.waitForTimeout(500);
const closeLater = await page.evaluate(() => {
  const close = [...document.querySelectorAll("button")].find((b) => /close/i.test(b.textContent || ""));
  if (!close) return null;
  const s = getComputedStyle(close);
  return { opacity: s.opacity, focused: document.activeElement === close };
});

// MEDIUM 6
let m6 = null;
if (closeImmediate.found) {
  await page.getByRole("button", { name: /close/i }).click();
  const t0 = Date.now();
  await page.getByRole("button", { name: /wall view/i }).click().catch(async () => {
    await page.getByRole("button", { name: /^Wall$/i }).click().catch(() => {});
  });
  await page.waitForTimeout(100);
  const box = await page.locator("canvas").first().boundingBox().catch(() => null);
  let early = false, late = false, dragEarly = null;
  if (box) {
    const before = await page.screenshot();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width / 2 + i * 24, box.y + box.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await page.screenshot();
    let diff = 0; const n = Math.min(before.length, after.length);
    for (let i = 0; i < n; i++) if (before[i] !== after[i]) diff++;
    dragEarly = { diff, ms: Date.now() - t0 };
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.waitForTimeout(500);
    early = await page.getByRole("button", { name: /close/i }).isVisible().catch(() => false);
    if (!early) {
      await page.waitForTimeout(800);
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await page.waitForTimeout(1500);
      late = await page.getByRole("button", { name: /close/i }).isVisible().catch(() => false);
    }
  }
  m6 = { early, late, dragEarly };
  await page.screenshot({ path: path.join(OUT, "m6-gate.png") });
}

// Splash root PE check (static via DOM after reload mid-intro is hard); code skim separately
const report = { m4, opened, closeImmediate, closeLater, m6 };
fs.writeFileSync(path.join(OUT, "handoff3-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
