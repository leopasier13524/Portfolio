import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "verify-p0");
import fs from "fs";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function note(ok, title, detail) {
  results.push({ ok, title, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${title}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch();

// 1) Skip path
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const skip = page.getByRole("button", { name: /skip/i });
  await skip.waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, "01-splash-with-skip.png") });
  const t0 = Date.now();
  await skip.click();
  await page.getByRole("navigation", { name: "Primary" }).waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "02-home-after-skip.png") });
  note(true, "Skip visible and reaches nav", `${Date.now() - t0}ms`);

  // Home text readability heuristics: solid DOM text visible (not zero opacity)
  const homeText = await page.evaluate(() => {
    const root = document.querySelector("[data-home-root], main, body");
    const candidates = [...document.querySelectorAll("h1, h2, p")].slice(0, 12);
    return candidates.map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || "").trim().slice(0, 60),
        opacity: s.opacity,
        visibility: s.visibility,
        color: s.color,
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }).filter((x) => x.text.length > 2);
  });
  const readable = homeText.filter((t) => Number(t.opacity) > 0.5 && t.visibility !== "hidden" && t.h > 8);
  note(readable.length >= 2, "Home DOM text readable after Skip", `visibleBlocks=${readable.length}; sample=${JSON.stringify(readable.slice(0, 3))}`);

  // Overlay CTA
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /projects/i }).click();
  await page.waitForTimeout(2500);
  // try list mode if wall hard; click first project-ish control
  const listToggle = page.getByRole("button", { name: /list/i });
  if (await listToggle.count()) {
    await listToggle.first().click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(OUT, "03-projects.png") });
  // open MealLi if present
  const meal = page.getByText(/MealLi 2\.0/i).first();
  if (await meal.count()) {
    await meal.click({ force: true });
    await page.waitForTimeout(1500);
  } else {
    // fallback: any button/link with project feel
    const any = page.locator("button, a, [role=button]").filter({ hasText: /MealLi|HBMP|Travelli|Stremio/i }).first();
    if (await any.count()) await any.click({ force: true });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(OUT, "04-overlay.png") });
  const cta = page.getByRole("link", { name: /live preview|open live/i }).first();
  if (await cta.count()) {
    const style = await cta.evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, bg: s.backgroundColor, opacity: s.opacity, visibility: s.visibility, text: el.textContent?.trim() };
    });
    const opaque = Number(style.opacity) > 0.8;
    const notTransparentBg = style.bg && !style.bg.includes("0, 0, 0, 0") && style.bg !== "rgba(0, 0, 0, 0)";
    note(opaque && (notTransparentBg || style.color.includes("0, 0, 0")), "CTA contrast/opacity OK", JSON.stringify(style));
  } else {
    note(false, "CTA link not found", "");
  }
  await ctx.close();
}

// 2) Reduced motion
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("navigation", { name: "Primary" }).waitFor({ state: "visible", timeout: 15000 });
  const ms = Date.now() - t0;
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "05-reduced-motion-home.png") });
  // projects should prefer list
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /projects/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "06-reduced-motion-projects.png") });
  const hasAllProjects = await page.getByText(/all projects/i).count();
  note(ms < 8000, "Reduced-motion reaches nav quickly", `${ms}ms`);
  note(hasAllProjects > 0, "Reduced-motion projects list-first", `allProjectsLabel=${hasAllProjects}`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, failed: failed.length }, null, 2));
process.exit(failed.length ? 1 : 0);
