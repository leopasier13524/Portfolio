import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "qa-smoke";

const browser = await chromium.launch({ channel: "chrome" });

async function run(label, options) {
  const page = await browser.newPage(options);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /skip introduction/i })
    .click({ timeout: 15000 })
    .catch(() => {});
  const cta = page.getByRole("button", { name: /^my road$/i });
  await cta.waitFor({ timeout: 15000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/home-${label}-top.png` });

  // Is the CTA clear of the floating nav at first paint?
  const overlap = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const cta = buttons.find((b) => /my road/i.test(b.textContent ?? ""));
    const nav = document.querySelector('nav, [aria-label="Primary"]');
    if (!cta || !nav) {
      return null;
    }
    const a = cta.getBoundingClientRect();
    const b = nav.getBoundingClientRect();
    return {
      ctaBottom: Math.round(a.bottom),
      navTop: Math.round(b.top),
      overlaps: a.bottom > b.top && a.top < b.bottom,
    };
  });

  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/home-${label}-about.png` });
  await page.close();
  return overlap;
}

const mobile = await run("mobile", {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const desktop = await run("desktop", { viewport: { width: 1440, height: 900 } });

console.log(JSON.stringify({ mobile, desktop }, null, 2));
await browser.close();
