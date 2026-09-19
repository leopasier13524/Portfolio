import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false, channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })).newPage();
const failed = [];
page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', (r) => {
  if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url()}`);
});
await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.src);
  const resources = performance.getEntriesByType('resource').map((r) => ({ name: r.name, type: r.initiatorType, size: r.transferSize }));
  return {
    scripts,
    resources: resources.filter((r) => /_next|chunk|webpack/.test(r.name)).slice(0, 30),
    htmlLen: document.documentElement.outerHTML.length,
    hasSkipHandler: (() => {
      const b = document.querySelector('[aria-label="Skip introduction"]');
      if (!b) return null;
      const keys = Object.keys(b);
      return keys.filter((k) => k.startsWith('__react') || k.includes('react') || k.startsWith('__'));
    })(),
  };
});
console.log(JSON.stringify({ info, failed: failed.slice(0, 25) }, null, 2));
await browser.close();
