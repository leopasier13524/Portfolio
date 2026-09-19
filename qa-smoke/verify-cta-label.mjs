import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
const skip = p.getByRole("button", { name: /skip/i });
if (await skip.isVisible().catch(() => false)) await skip.click();
await p.getByRole("navigation", { name: "Primary" }).waitFor({ state: "visible", timeout: 20000 });
await p.waitForTimeout(500);
await p.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /projects/i }).click();
await p.waitForTimeout(900);
const list = p.getByRole("button", { name: /list/i });
if (await list.count()) await list.first().click();
await p.waitForTimeout(600);
await p.getByText("MealLi 2.0", { exact: true }).first().click({ force: true });
await p.waitForTimeout(1800);
await p.screenshot({ path: "verify-cta-label.png" });
const info = await p.evaluate(() => {
  const links = [...document.querySelectorAll("a")].map((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const label = el.getAttribute("aria-label");
    const spans = [...el.querySelectorAll("span")].map((sp) => ({
      text: (sp.textContent || "").trim(),
      color: getComputedStyle(sp).color,
      opacity: getComputedStyle(sp).opacity,
    }));
    return {
      text: (el.textContent || "").replace(/\s+/g, " ").trim(),
      label,
      color: s.color,
      bg: s.backgroundColor,
      opacity: s.opacity,
      w: Math.round(r.width),
      h: Math.round(r.height),
      spans,
    };
  }).filter((x) => /preview|live|framer/i.test(x.text + " " + (x.label || "")) && x.w > 20);
  const h1 = document.querySelector("h1");
  return {
    links,
    h1Text: h1?.textContent?.replace(/\s+/g, " ").trim(),
    availableInH1: /available/i.test(h1?.textContent || ""),
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
