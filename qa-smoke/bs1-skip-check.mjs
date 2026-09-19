const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cons = [];
  page.on("pageerror", (e) => cons.push("pageerror:" + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") cons.push("console:" + m.text());
  });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => ({
    skip: !!document.querySelector('button[aria-label="Skip introduction"]'),
    counter: document.querySelector("[data-splash-counter]")?.textContent || null,
    splash: !!document.querySelector('[aria-label="Introduction"]'),
  }));
  const skip = page.locator('button[aria-label="Skip introduction"]');
  let clickOk = false;
  if ((await skip.count()) > 0) {
    try {
      await skip.click({ timeout: 5000, force: true });
      clickOk = true;
    } catch (e) {
      cons.push("clickfail:" + e.message);
    }
  }
  await page.waitForTimeout(2000);
  const afterClick = await page.evaluate(() => ({
    skipVisible: !!document.querySelector('button[aria-label="Skip introduction"]'),
    splashAriaHidden: document.querySelector('[aria-label="Introduction"]')?.getAttribute("aria-hidden"),
    splashInert: document.querySelector('[aria-label="Introduction"]')?.hasAttribute("inert"),
    counter: document.querySelector("[data-splash-counter]")?.textContent || null,
    navButtons: [...document.querySelectorAll("nav button, nav a")].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 6),
  }));
  await browser.close();

  const browser2 = await chromium.launch({ headless: true });
  const page2 = await browser2.newPage();
  await page2.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page2.waitForTimeout(10000);
  const afterTimeout = await page2.evaluate(() => ({
    skipVisible: !!document.querySelector('button[aria-label="Skip introduction"]'),
    splashAriaHidden: document.querySelector('[aria-label="Introduction"]')?.getAttribute("aria-hidden"),
    splashInert: document.querySelector('[aria-label="Introduction"]')?.hasAttribute("inert"),
    counter: document.querySelector("[data-splash-counter]")?.textContent || null,
  }));
  await browser2.close();

  console.log(JSON.stringify({ before, clickOk, afterClick, afterTimeout, cons }, null, 2));
})().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
