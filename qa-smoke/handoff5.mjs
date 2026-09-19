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
await page.getByRole("button", { name: /^Projects$/i }).click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /list view/i }).click();
await page.waitForTimeout(1000);
const dump = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("button, a, [role=button]")].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
      disabled: el.disabled,
      pe: getComputedStyle(el).pointerEvents,
      opacity: getComputedStyle(el).opacity,
      w: Math.round(r.width),
      h: Math.round(r.height),
      inert: el.closest("[inert]") != null,
    };
  }).filter((n) => n.w > 0 && n.h > 0);
  return nodes.slice(0, 40);
});
fs.writeFileSync(path.join(OUT, "list-dump.json"), JSON.stringify(dump, null, 2));
// force click MealLi card button
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll("button, a, [role=button]")].find((e) => /MealLi 2\.0/i.test(e.textContent || ""));
  if (!el) return { ok: false, reason: "not found" };
  el.click();
  return { ok: true, tag: el.tagName, disabled: el.disabled, text: (el.textContent || "").slice(0, 40) };
});
await page.waitForTimeout(40);
const samples = [];
for (let i = 0; i < 15; i++) {
  samples.push(await page.evaluate(() => {
    const close = [...document.querySelectorAll("button")].find((b) => /close/i.test(b.textContent || ""));
    const root = document.querySelector('[role="dialog"]');
    if (!close) return { found: false };
    return {
      found: true,
      closeOpacity: getComputedStyle(close).opacity,
      rootOpacity: root ? getComputedStyle(root).opacity : null,
      focused: document.activeElement === close,
      active: (document.activeElement?.textContent || "").trim().slice(0, 30),
    };
  }));
  await page.waitForTimeout(40);
}
await page.screenshot({ path: path.join(OUT, "m5-force.png") });
const focusedWhileInvisible = samples.some((s) => s.found && s.focused && parseFloat(s.closeOpacity) < 0.05);
let m6 = null;
if (samples.some((s) => s.found)) {
  await page.getByRole("button", { name: /close/i }).click({ force: true });
  const t0 = Date.now();
  await page.getByRole("button", { name: /wall view/i }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(150);
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
    early = await page.getByRole("button", { name: /close/i }).isVisible().catch(() => false);
    if (!early) {
      await page.waitForTimeout(800);
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.42);
      await page.waitForTimeout(1500);
      late = await page.getByRole("button", { name: /close/i }).isVisible().catch(() => false);
    }
  }
  m6 = { ms: Date.now() - t0, early, late, dragDiff };
}
const report = { dumpSample: dump.filter((d) => /meal|wall|list|project/i.test(d.text)).slice(0, 15), clicked, focusedWhileInvisible, samples: samples.filter((s) => s.found).slice(0, 8), m6 };
fs.writeFileSync(path.join(OUT, "handoff5-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
