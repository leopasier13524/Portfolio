const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cons = [];
  page.on("pageerror", (e) => cons.push("pageerror:" + e.message));
  page.on("console", (m) => { if (m.type() === "error") cons.push("console:" + m.text().slice(0, 200)); });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  const before = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Skip introduction"]');
    const anyFiber = [...document.querySelectorAll("body *")].some((el) => Object.keys(el).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps")));
    return {
      anyFiber,
      btnFiber: btn ? Object.keys(btn).some((k) => k.startsWith("__react")) : false,
      counter: document.querySelector("[data-splash-counter]")?.textContent || null,
    };
  });
  const skip = page.locator('button[aria-label="Skip introduction"]');
  let clickOk = false;
  if ((await skip.count()) > 0) {
    try { await skip.click({ timeout: 5000 }); clickOk = true; } catch (e) { cons.push("clickfail:" + e.message); }
  }
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({
    skipVisible: !!document.querySelector('button[aria-label="Skip introduction"]'),
    splashInert: document.querySelector('[aria-label="Introduction"]')?.hasAttribute("inert"),
    counter: document.querySelector("[data-splash-counter]")?.textContent || null,
    navOpacity: (() => { const n = document.querySelector("nav"); return n ? getComputedStyle(n).opacity : null; })(),
  }));
  console.log(JSON.stringify({ before, clickOk, after, cons: cons.slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => { console.error(String(e)); process.exit(1); });
