import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "qa-smoke";
const errors = [];

const browser = await chromium.launch({ channel: "chrome" });

async function newPage(options = {}) {
  const page = await browser.newPage(options);
  page.on("pageerror", (e) => errors.push(`[${options.label ?? "page"}] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors.push(`[${options.label ?? "page"}] console: ${m.text()}`);
    }
  });
  return page;
}

async function enterHome(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /skip introduction/i })
    .click({ timeout: 15000 })
    .catch(() => {});
  await page.getByRole("button", { name: /^my road$/i }).waitFor({ timeout: 15000 });
}

// 1. Mobile flight
const mobile = await newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  label: "mobile",
});
await enterHome(mobile);
await mobile.screenshot({ path: `${OUT}/fc-01-mobile-home.png` });
await mobile.getByRole("button", { name: /^my road$/i }).click();
await mobile.waitForTimeout(9000);
await mobile.screenshot({ path: `${OUT}/fc-02-mobile-flight.png` });
await mobile.close();

// 2. Reduced motion fallback
const reduced = await newPage({
  viewport: { width: 1280, height: 860 },
  reducedMotion: "reduce",
  label: "reduced",
});
await reduced.goto(BASE, { waitUntil: "domcontentloaded" });
await reduced.getByRole("button", { name: /^my road$/i }).waitFor({ timeout: 15000 });
await reduced.getByRole("button", { name: /^my road$/i }).click();
await reduced.waitForTimeout(800);
const reducedHasCanvas = await reduced
  .locator("[data-myroad-overlay] canvas")
  .count();
await reduced.screenshot({ path: `${OUT}/fc-03-reduced-road.png` });
await reduced.close();

// 3. Project overlay grid + lightbox
const desktop = await newPage({ viewport: { width: 1440, height: 900 }, label: "desktop" });
await enterHome(desktop);
await desktop
  .getByRole("navigation", { name: "Primary" })
  .getByRole("button", { name: "Projects" })
  .click();
await desktop.waitForTimeout(1200);
await desktop
  .getByRole("group", { name: "Projects layout" })
  .getByRole("button", { name: /grid/i })
  .click();
await desktop.waitForTimeout(1200);
// MealLi (not 2.0) has two boards plus a brand mark — best grid test case.
await desktop.locator("[data-grid-item] button").nth(1).click();
await desktop.waitForTimeout(2400);
await desktop.mouse.wheel(0, 2600);
await desktop.waitForTimeout(1400);
await desktop.screenshot({ path: `${OUT}/fc-04-project-boards.png` });

const tile = desktop.getByRole("button", { name: /^Enlarge /i }).first();
const boardBox = await tile.boundingBox();
await tile.click();
await desktop.waitForTimeout(900);
await desktop.screenshot({ path: `${OUT}/fc-05-lightbox.png` });
await desktop.keyboard.press("Escape");
await desktop.waitForTimeout(600);
const overlayStillOpen = await desktop.locator('[role="dialog"]').count();
await desktop.screenshot({ path: `${OUT}/fc-06-after-escape.png` });
await desktop.close();

console.log(
  JSON.stringify(
    {
      reducedHasCanvas,
      boardTileSize: boardBox && [Math.round(boardBox.width), Math.round(boardBox.height)],
      overlayStillOpen,
      errors,
    },
    null,
    2
  )
);

await browser.close();
