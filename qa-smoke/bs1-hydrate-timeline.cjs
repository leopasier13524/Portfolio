const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on("pageerror", (e) => logs.push({ t: "pageerror", m: e.message, s: e.stack }));
  page.on("requestfailed", (r) => logs.push({ t: "reqfail", u: r.url(), err: r.failure()?.errorText }));
  page.on("response", async (r) => {
    if (r.status() >= 400) logs.push({ t: "http", s: r.status(), u: r.url().slice(0, 120) });
  });
  page.on("console", (m) => {
    const text = m.text();
    if (/error|hydrat|warn|fail|chunk/i.test(text)) logs.push({ t: "console-" + m.type(), m: text.slice(0, 300) });
  });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "load", timeout: 60000 });
  for (const ms of [1000, 3000, 6000, 10000]) {
    await page.waitForTimeout(ms === 1000 ? 1000 : ms - (ms === 3000 ? 1000 : ms === 6000 ? 3000 : 6000));
    const snap = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Skip introduction"]');
      const anyFiber = !!document.querySelector("*") && [...document.querySelectorAll("body *")].some((el) => Object.keys(el).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps")));
      const nextData = !!document.getElementById("__NEXT_DATA__");
      const canvas = document.querySelectorAll("canvas").length;
      return {
        anyFiber,
        btnFiber: btn ? Object.keys(btn).some((k) => k.startsWith("__react")) : false,
        nextData,
        canvas,
        counter: document.querySelector("[data-splash-counter]")?.textContent || null,
      };
    });
    console.log("t+" + ms, JSON.stringify(snap));
  }
  console.log("LOGS", JSON.stringify(logs.slice(0, 50), null, 2));
  await browser.close();
})().catch((e) => { console.error(String(e)); process.exit(1); });
