import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
const skip = p.getByRole("button", { name: /skip/i });
if (await skip.isVisible().catch(() => false)) await skip.click();
await p.getByRole("navigation", { name: "Primary" }).waitFor({ state: "visible", timeout: 20000 });
await p.waitForTimeout(800);
const skipStill = await skip.isVisible().catch(() => false);
const home = await p.evaluate(() => {
  const h1 = document.querySelector("h1");
  const s = h1 ? getComputedStyle(h1) : null;
  const avail = [...document.querySelectorAll("p,span")].find(el => /available/i.test(el.textContent||""));
  return {
    h1: h1?.textContent?.trim().slice(0,80),
    opacity: s?.opacity,
    color: s?.color,
    availableNear: avail ? avail.closest("div")?.innerText?.slice(0,120) : null,
  };
});
await p.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /projects/i }).click();
await p.waitForTimeout(1000);
const listBtn = p.getByRole("button", { name: /list/i });
if (await listBtn.count()) await listBtn.first().click();
await p.waitForTimeout(700);
await p.getByText("MealLi 2.0", { exact: true }).first().click({ force: true });
await p.waitForTimeout(2000);
const cta = await p.evaluate(() => {
  const links = [...document.querySelectorAll("a")].map(el => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { text: (el.textContent||"").replace(/\s+/g," ").trim(), color: s.color, bg: s.backgroundColor, opacity: s.opacity, top: Math.round(r.top), y: Math.round(r.y) };
  }).filter(x => /live preview|open live/i.test(x.text));
  return links;
});
console.log(JSON.stringify({ skipStill, home, cta }, null, 2));
await b.close();
