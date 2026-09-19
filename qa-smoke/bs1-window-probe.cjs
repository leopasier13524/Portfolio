const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const scripts = [...document.scripts].map((s) => ({ type: s.type, src: (s.src || "").slice(-60), inline: !s.src && s.textContent.slice(0, 80) }));
    const htmlHasCanvas = document.documentElement.outerHTML.includes("<canvas");
    const next = typeof window.next;
    const keys = Object.keys(window).filter((k) => /next|react|__NEXT/i.test(k)).slice(0, 30);
    // try event listener count on skip
    const btn = document.querySelector('button[aria-label="Skip introduction"]');
    let listenerHint = null;
    if (btn && typeof getEventListeners === "function") {
      listenerHint = "devtools-only";
    }
    // dispatch click and see if anything changes via MutationObserver summary
    return { scripts: scripts.slice(0, 20), htmlHasCanvas, next, keys, btnTag: btn?.outerHTML?.slice(0, 120) };
  });
  console.log(JSON.stringify(info, null, 2));
  // capture first 2kb of body text
  const text = await page.innerText("body");
  console.log("BODY_START", text.slice(0, 300));
  await browser.close();
})().catch((e) => { console.error(String(e)); process.exit(1); });
