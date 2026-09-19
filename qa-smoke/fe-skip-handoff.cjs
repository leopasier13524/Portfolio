const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(800);
  const skip = p.locator('button[aria-label="Skip introduction"]');
  const skipVisible = await skip.isVisible().catch(() => false);
  if (skipVisible) await skip.click();
  await p.waitForTimeout(1500);
  const splash = await p.locator("[data-splash-counter]").count();
  const homeText = await p.getByText("Hi!").first().isVisible().catch(() => false);
  const body = (await p.locator("body").innerText()).slice(0, 200);
  console.log(JSON.stringify({ skipVisible, splashCount: splash, homeText, body }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
