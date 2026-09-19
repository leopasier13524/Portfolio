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
await page.waitForTimeout(800);
await page.getByText("MealLi 2.0", { exact: true }).first().click({ timeout: 5000 });
await page.waitForTimeout(30);
const immediate = await page.evaluate(() => {
  const close = [...document.querySelectorAll("button")].find((b) => /close/i.test(b.textContent || ""));
  if (!close) return { found: false };
  return {
    found: true,
    opacity: getComputedStyle(close).opacity,
    focused: document.activeElement === close,
    activeText: (document.activeElement?.textContent || "").trim().slice(0, 40),
    rootOpacity: (() => {
      const root = document.querySelector('[role="dialog"]');
      return root ? getComputedStyle(root).opacity : null;
    })(),
  };
});
await page.screenshot({ path: path.join(OUT, "m5a.png") });
// poll focus vs opacity for ~600ms
const samples = [immediate];
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(50);
  samples.push(await page.evaluate(() => {
    const close = [...document.querySelectorAll("button")].find((b) => /close/i.test(b.textContent || ""));
    const root = document.querySelector('[role="dialog"]');
    if (!close) return { found: false };
    return {
      found: true,
      opacity: getComputedStyle(close).opacity,
      focused: document.activeElement === close,
      rootOpacity: root ? getComputedStyle(root).opacity : null,
    };
  }));
}
await page.screenshot({ path: path.join(OUT, "m5b.png") });

const focusedWhileInvisible = samples.some((s) => s.found && s.focused && parseFloat(s.opacity) < 0.05 && (s.rootOpacity == null || parseFloat(s.rootOpacity) < 0.05));
const focusedWhenVisible = samples.some((s) => s.found && s.focused && parseFloat(s.opacity) > 0.2);

await page.getByRole("button", { name: /close/i }).click();
const t0 = Date.now();
await page.getByRole("button", { name: /wall view/i }).click();
await page.waitForTimeout(120);
const box = await page.locator("canvas").first().boundingBox();
let early = false, late = false, dragDiff = 0;
if (box) {
  const before = await page.screenshot();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width / 2 + i * 22, box.y + box.height / 2 + 2);
  await page.mouse.up();
  await page.waitForTimeout(250);
  const after = await page.screenshot();
  const n = Math.min(before.length, after.length);
  for (let i = 0; i < n; i++) if (before[i] !== after[i]) dragDiff++;
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
  await page.waitForTimeout(600);
  early = await page.getByRole("button", { name: /close/i }).isVisible().catch(() => false);
  if (!early) {
    await page.waitForTimeout(700);
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
    await page.waitForTimeout(1400);
    late = await page.getByRole("button", { name: /close/i }).isVisible().catch(() => false);
  }
}
await page.screenshot({ path: path.join(OUT, "m6.png") });
const report = {
  m5: { focusedWhileInvisible, focusedWhenVisible, samples: samples.slice(0, 8) },
  m6: { ms: Date.now() - t0, early, late, dragDiff },
};
fs.writeFileSync(path.join(OUT, "handoff4-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
