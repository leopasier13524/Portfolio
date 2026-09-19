const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on("pageerror", (e) => logs.push("PAGEERROR " + e.message));
  page.on("console", (m) => logs.push(m.type().toUpperCase() + " " + m.text()));
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const probe = await page.evaluate(async () => {
    const root = document.querySelector("next-route-announcer") || document.getElementById("__next") || document.body;
    // Detect React fiber on splash button
    const btn = document.querySelector('button[aria-label="Skip introduction"]');
    const keys = btn ? Object.keys(btn).filter((k) => k.startsWith("__react")) : [];
    let reactProps = null;
    if (btn) {
      const fiberKey = Object.keys(btn).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
      const propsKey = Object.keys(btn).find((k) => k.startsWith("__reactProps"));
      reactProps = { fiberKey: !!fiberKey, propsKey: !!propsKey, onClickType: propsKey ? typeof btn[propsKey].onClick : null };
    }
    // Check if useEffect ran by looking for listeners / gsap style mutations
    const counter = document.querySelector("[data-splash-counter]");
    const progress = document.querySelector("[data-splash-progress]");
    const canvas = document.querySelector("canvas");
    return {
      reactProps,
      counter: counter?.textContent,
      progressTransform: progress ? getComputedStyle(progress).transform : null,
      canvasCount: document.querySelectorAll("canvas").length,
      scripts: [...document.scripts].map((s) => s.src).filter((s) => s.includes("/_next/")).slice(0, 8),
    };
  });
  // fetch a main-app chunk status
  const chunkReqs = [];
  for (const s of probe.scripts.slice(0, 3)) {
    try {
      const r = await page.request.get(s);
      chunkReqs.push({ url: s.slice(-40), status: r.status() });
    } catch (e) {
      chunkReqs.push({ url: s.slice(-40), err: String(e) });
    }
  }
  console.log(JSON.stringify({ probe, chunkReqs, logs: logs.filter(l => /error|Error|hydrat|Hydration|warn/i.test(l)).slice(0, 40) }, null, 2));
  await browser.close();
})().catch((e) => { console.error(String(e)); process.exit(1); });
