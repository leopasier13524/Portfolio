import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "qa-smoke";

const shots = [
  { at: 900, name: "flight-01-launch" },
  { at: 3200, name: "flight-02-cruise" },
  { at: 6000, name: "flight-03-icons" },
  { at: 8200, name: "flight-04-gate-one" },
  { at: 14000, name: "flight-05-chapter-two" },
  { at: 21000, name: "flight-06-chapter-three" },
];

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-gl=angle", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(`console: ${message.text()}`);
  }
});

await page.goto(BASE, { waitUntil: "domcontentloaded" });

// Leave the splash immediately.
const skip = page.getByRole("button", { name: /skip introduction/i });
await skip.click({ timeout: 15000 }).catch(() => {});

const myRoad = page.getByRole("button", { name: /^my road$/i });
await myRoad.waitFor({ state: "visible", timeout: 15000 });
await myRoad.click();

const overlay = page.locator("[data-myroad-overlay]");
await overlay.waitFor({ state: "visible", timeout: 5000 });

const started = Date.now();
for (const shot of shots) {
  const wait = shot.at - (Date.now() - started);
  if (wait > 0) {
    await page.waitForTimeout(wait);
  }
  await page.screenshot({ path: `${OUT}/${shot.name}.png` });
}

// Chapter rail jump + outro
await page.getByRole("button", { name: /tahoma/i }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/flight-07-jump-last.png` });

await page.getByRole("button", { name: /^skip$/i }).click();
await page.waitForTimeout(4500);
await page.screenshot({ path: `${OUT}/flight-08-outro.png` });

const report = await page.evaluate(() => {
  const overlayEl = document.querySelector("[data-myroad-overlay]");
  const canvas = overlayEl?.querySelector("canvas");
  return {
    overlay: Boolean(overlayEl),
    canvasPixels: canvas ? [canvas.width, canvas.height] : null,
    hasReplay: Boolean(
      Array.from(document.querySelectorAll("button")).find((b) =>
        /replay/i.test(b.textContent ?? "")
      )
    ),
  };
});

console.log(JSON.stringify({ report, errors }, null, 2));
await browser.close();
