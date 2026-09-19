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
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Projects$/i }).click();
await page.waitForTimeout(900);
await page.getByRole("button", { name: /list view/i }).click();
await page.waitForTimeout(900);

const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll("button")].find((e) => {
    const t = (e.textContent || "").replace(/\s+/g, " ");
    const r = e.getBoundingClientRect();
    return /MealLi 2\.0/i.test(t) && !e.disabled && e.closest("[inert]") == null && r.width > 400;
  });
  if (!el) return { ok: false };
  el.click();
  return { ok: true, text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) };
});

const samples = [];
for (let i = 0; i < 20; i++) {
  samples.push(await page.evaluate(() => {
    const close = [...document.querySelectorAll("button")].find((b) => /^\\s*Close\\s*$/i.test((b.textContent || "").trim()) || (b.textContent || "").trim() === "Close");
    // broader
    const close2 = close || [...document.querySelectorAll("button")].find((b) => /close/i.test(b.textContent || "") && !/projects|contact|home/i.test(b.textContent || ""));
    const root = document.querySelector('[role="dialog"]');
    if (!close2) return { found: false, hasDialog: !!root };
    return {
      found: true,
      closeOpacity: getComputedStyle(close2).opacity,
      rootOpacity: root ? getComputedStyle(root).opacity : null,
      focused: document.activeElement === close2,
      active: (document.activeElement?.textContent || "").trim().slice(0, 40),
    };
  }));
  await page.waitForTimeout(40);
}
await page.screenshot({ path: path.join(OUT, "m5-final.png") });

const focusedWhileInvisible = samples.some((s) => s.found && s.focused && parseFloat(s.closeOpacity) < 0.05);
const anyFound = samples.some((s) => s.found);

let m6 = null;
if (anyFound) {
  await page.locator('button:has-text("Close")').first().click({ force: true });
  const t0 = Date.now();
  await page.getByRole("button", { name: /wall view/i }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  const box = await page.locator("canvas").first().boundingBox();
  let early = false, late = false, dragDiff = 0;
  if (box) {
    const before = await page.screenshot();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width / 2 + i * 22, box.y + box.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(250);
    const after = await page.screenshot();
    const n = Math.min(before.length, after.length);
    for (let i = 0; i < n; i++) if (before[i] !== after[i]) dragDiff++;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.42);
    await page.waitForTimeout(700);
    early = await page.locator('button:has-text("Close")').first().isVisible().catch(() => false);
    if (!early) {
      await page.waitForTimeout(900);
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.42);
      await page.waitForTimeout(1500);
      late = await page.locator('button:has-text("Close")').first().isVisible().catch(() => false);
    }
  }
  m6 = { ms: Date.now() - t0, early, late, dragDiff };
  await page.screenshot({ path: path.join(OUT, "m6-final.png") });
}

// Splash PE static
const splashCode = await page.evaluate(() => null);
const report = {
  clicked,
  focusedWhileInvisible,
  anyFound,
  firstFound: samples.find((s) => s.found) || samples[0],
  samples: samples.filter((s)=>s.found).slice(0,10),
  m6,
};
fs.writeFileSync(path.join(OUT, "handoff6-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
