import { chromium, firefox } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.dirname(fileURLToPath(import.meta.url));

async function probe(name, launcher, launchOpts) {
  console.log('\n====', name, '====');
  try {
    const browser = await launcher.launch(launchOpts);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const resp = await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('status', resp && resp.status());
    await page.waitForTimeout(2500);
    const react = await page.evaluate(() => ({
      nextData: !!document.getElementById('__NEXT_DATA__'),
      reactRoot: !!document.querySelector('[data-reactroot], nextjs-portal') || !!document.querySelector('#__next'),
      nextRoot: !!document.querySelector('#__next'),
      hydratedHint: !!document.querySelector('next-route-announcer'),
      skipHasOnclick: (() => {
        const b = document.querySelector('[aria-label="Skip introduction"]');
        return !!(b && (b.onclick || b.getAttribute('onclick')));
      })(),
    }));
    console.log('react', react);
    await page.getByRole('button', { name: /skip introduction/i }).click({ timeout: 3000 }).catch((e) => console.log('roleClick', e.message));
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({
      skip: !!document.querySelector('[aria-label="Skip introduction"]'),
      navOp: (() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n ? getComputedStyle(n).opacity : null; })(),
    }));
    console.log('after', after, 'pageerrors', errors.slice(0, 5));
    await page.screenshot({ path: path.join(OUT, `diag3-${name}.png`) });
    await browser.close();
  } catch (e) {
    console.log('FAILED', e.message);
  }
}

await probe('chrome-headless', chromium, { headless: true, channel: 'chrome' });
await probe('chrome-headed', chromium, { headless: false, channel: 'chrome' });
await probe('ff-headless', firefox, { headless: true });
