import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://127.0.0.1:3000";
const SHOTS = OUT;

const gates = {};
function gate(id, status, detail, extra = {}) {
  gates[id] = { id, status, detail, ...extra };
  console.log(`[${status}] ${id}: ${detail}`);
}

function parseRgba(input) {
  if (!input || input === "transparent") return null;
  const m = String(input).match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i
  );
  if (m) {
    return {
      r: +m[1],
      g: +m[2],
      b: +m[3],
      a: m[4] !== undefined ? +m[4] : 1,
    };
  }
  // color-mix / other — try computing via canvas in page later
  return { raw: input };
}

function nearRgb(c, r, g, b, tol = 18) {
  if (!c || c.raw) return false;
  return Math.abs(c.r - r) <= tol && Math.abs(c.g - g) <= tol && Math.abs(c.b - b) <= tol;
}

async function shot(page, name) {
  const p = path.join(SHOTS, name);
  await page.screenshot({ path: p, fullPage: false });
  return path.basename(p);
}

async function skipSplash(page) {
  try {
    await page.getByRole("button", { name: /skip introduction/i }).waitFor({ timeout: 4000 });
    await page.keyboard.press("Escape");
  } catch {
    await page.keyboard.press("Escape").catch(() => {});
  }
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    return n && getComputedStyle(n).opacity !== "0";
  }, null, { timeout: 25000 });
  await page.waitForTimeout(350);
}

async function setTheme(page, label) {
  const themeBtn = page.locator('button[aria-haspopup="listbox"]').filter({ hasText: /Theme/i }).first();
  if (!(await themeBtn.count())) {
    // fallback: any expanded theme control
    const alt = page.getByRole("button", { name: /Theme/i }).first();
    if (!(await alt.count())) throw new Error("Theme picker button not found");
    await alt.click();
  } else {
    await themeBtn.click();
  }
  await page.waitForTimeout(200);
  const option = page.locator('[role="option"]').filter({ hasText: new RegExp(`^${label}$`, "i") });
  if (!(await option.count())) {
    // list may need another open
    const opts = await page.locator('[role="option"]').allTextContents();
    throw new Error(`Theme option "${label}" not found; saw: ${JSON.stringify(opts)}`);
  }
  await option.first().click();
  await page.waitForFunction(
    (lab) => {
      const t = document.documentElement.getAttribute("data-theme") || "";
      const map = { Night: "night", Christmas: "christmas", Summer: "summer", Autumn: "autumn", Spring: "spring" };
      return t === (map[lab] || lab.toLowerCase());
    },
    label,
    { timeout: 8000 }
  );
  await page.waitForTimeout(400);
}

async function goNav(page, label) {
  const nav = page.locator('nav[aria-label="Primary"]');
  await nav.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).click();
  await page.waitForTimeout(500);
}

function decodePngRgba(buf) {
  // Minimal PNG reader for 8-bit RGBA/RGB/palette/grayscale
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not png");
  let offset = 8;
  let width = 0, height = 0, bitDepth = 8, colorType = 6;
  let idat = [];
  let palette = null;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") break;
    offset += 12 + len;
  }
  const compressed = Buffer.concat(idat);
  const raw = zlib.inflateSync(compressed);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 1;
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let ip = 0;
  let op = 0;
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[ip++];
    raw.copy(cur, 0, ip, ip + stride);
    ip += stride;
    const paeth = (a, b, c) => {
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      if (pa <= pb && pa <= pc) return a;
      if (pb <= pc) return b;
      return c;
    };
    for (let i = 0; i < stride; i++) {
      const x = cur[i];
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = x;
      if (filter === 1) v = (x + a) & 255;
      else if (filter === 2) v = (x + b) & 255;
      else if (filter === 3) v = (x + ((a + b) >> 1)) & 255;
      else if (filter === 4) v = (x + paeth(a, b, c)) & 255;
      cur[i] = v;
    }
    for (let x = 0; x < width; x++) {
      if (colorType === 6) {
        rgba[op++] = cur[x * 4];
        rgba[op++] = cur[x * 4 + 1];
        rgba[op++] = cur[x * 4 + 2];
        rgba[op++] = cur[x * 4 + 3];
      } else if (colorType === 2) {
        rgba[op++] = cur[x * 3];
        rgba[op++] = cur[x * 3 + 1];
        rgba[op++] = cur[x * 3 + 2];
        rgba[op++] = 255;
      } else if (colorType === 3) {
        const idx = cur[x] * 3;
        rgba[op++] = palette[idx];
        rgba[op++] = palette[idx + 1];
        rgba[op++] = palette[idx + 2];
        rgba[op++] = 255;
      } else if (colorType === 0) {
        const g = cur[x];
        rgba[op++] = g; rgba[op++] = g; rgba[op++] = g; rgba[op++] = 255;
      } else if (colorType === 4) {
        const g = cur[x * 2];
        rgba[op++] = g; rgba[op++] = g; rgba[op++] = g; rgba[op++] = cur[x * 2 + 1];
      }
    }
    cur.copy(prev);
  }
  return { width, height, rgba };
}

function sampleBandBrightness(pngBuf, y0Frac, y1Frac) {
  const { width, height, rgba } = decodePngRgba(pngBuf);
  const y0 = Math.floor(height * y0Frac);
  const y1 = Math.max(y0 + 1, Math.floor(height * y1Frac));
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 40))) {
      const i = (y * width + x) * 4;
      sum += (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
      n++;
    }
  }
  return { avg: n ? sum / n : 0, width, height };
}

function measureBackdrop() {
  const bd = document.querySelector(".theme-backdrop");
  const scrim = document.querySelector(".theme-sky__scrim");
  const grain = document.querySelector(".theme-sky__grain");
  const field = document.querySelector(".ac-home-field");
  const horizon = document.querySelector(".theme-sky__horizon");
  const haze = document.querySelector(".theme-sky__haze");
  const light = document.querySelector(".theme-sky__light");
  const massL = document.querySelector(".theme-sky__mass--left");
  const massR = document.querySelector(".theme-sky__mass--right");
  const canvas = document.querySelector(".theme-sky__particles");
  const h1 = document.querySelector("h1");
  const portrait = document.querySelector("[data-home-portrait]");
  const theme = document.documentElement.getAttribute("data-theme");

  const cs = (el) => (el ? getComputedStyle(el) : null);
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
  };

  // Probe scrim alpha via a temporary read of backgroundImage / computed
  let scrimBg = scrim ? cs(scrim).backgroundImage : null;
  let scrimBgColor = scrim ? cs(scrim).backgroundColor : null;

  // Sample scrim center color using a 1x1 canvas draw of the element isn't possible;
  // instead parse color-mix from inline style sheet text if present, else use getComputedStyle.
  // Also read CSSOM for .theme-sky__scrim rule.
  let scrimRuleText = "";
  let grainRuleOpacity = null;
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules || []) {
      if (rule.selectorText === ".theme-sky__scrim") scrimRuleText = rule.cssText;
      if (rule.selectorText === ".theme-sky__grain") {
        grainRuleOpacity = rule.style.opacity || null;
      }
    }
  }

  const grainCs = cs(grain);
  const scrimCs = cs(scrim);
  const bdCs = cs(bd);
  const fieldCs = cs(field);
  const lightCs = cs(light);
  const hazeCs = cs(haze);

  // DOM paint order: Sky (grain) -> canvas -> scrim. Scrim should be last child.
  let grainBehindScrim = false;
  if (bd && grain && scrim) {
    const kids = [...bd.children];
    const gi = kids.findIndex((n) => n === grain || n.contains(grain));
    const si = kids.findIndex((n) => n === scrim);
    // grain is inside first child Sky fragment wrapper... actually Sky returns fragment, so grain is direct? 
    // React fragment flattens: light,haze,...,grain, canvas, scrim
    const all = bd.querySelectorAll(":scope > *");
    const grainIdx = [...all].indexOf(grain);
    const scrimIdx = [...all].indexOf(scrim);
    grainBehindScrim = grainIdx >= 0 && scrimIdx > grainIdx;
  }

  // Photo plate check
  const imgs = bd
    ? [...bd.querySelectorAll("img")].map((i) => i.getAttribute("src") || "")
    : [];
  const bgImgs = bd
    ? [...bd.querySelectorAll("*")].map((el) => getComputedStyle(el).backgroundImage).filter((v) => v && v !== "none")
    : [];
  const photoUrl = [...imgs, ...bgImgs].some((v) =>
    /\.(jpe?g|png|webp|avif)(\?|"|'|\))/i.test(v) && !v.includes("data:image/svg")
  );

  // Particle sampling from canvas pixels in type column vs bottom
  let snowSamples = null;
  if (canvas && theme === "christmas") {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cssW = canvas.clientWidth || 1;
    const cssH = canvas.clientHeight || 1;
    const sx = w / cssW;
    const sy = h / cssH;
    const colW = Math.min(720, cssW * 0.78);
    const left = (cssW - colW) / 2;
    const top = cssH * 0.1;
    const bottom = cssH * 0.82;
    const sampleRect = (x0, y0, x1, y1) => {
      const rx0 = Math.max(0, Math.floor(x0 * sx));
      const ry0 = Math.max(0, Math.floor(y0 * sy));
      const rw = Math.max(1, Math.floor((x1 - x0) * sx));
      const rh = Math.max(1, Math.floor((y1 - y0) * sy));
      const data = ctx.getImageData(rx0, ry0, Math.min(rw, w - rx0), Math.min(rh, h - ry0)).data;
      let bright = 0, n = 0;
      for (let i = 0; i < data.length; i += 16) {
        // white-ish snow
        if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200 && data[i + 3] > 20) bright++;
        n++;
      }
      return { bright, n, ratio: n ? bright / n : 0 };
    };
    snowSamples = {
      typeColumn: sampleRect(left + 20, top + 20, left + colW - 20, bottom - 20),
      bottomBand: sampleRect(0, cssH * 0.82, cssW, cssH),
      sideL: sampleRect(0, top, left, bottom),
      sideR: sampleRect(left + colW, top, cssW, bottom),
    };
  }

  // Alpha from background plate helpers
  const plateAlpha = (el) => {
    if (!el) return null;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (!m) return { bg, a: null };
    const parts = m[1].split(",").map((s) => s.trim());
    const a = parts.length === 4 ? parseFloat(parts[3]) : 1;
    return { bg, a, r: +parts[0], g: +parts[1], b: +parts[2] };
  };

  const pickerBtn = document.querySelector('button[aria-haspopup="listbox"]');
  const navPlate = document.querySelector('nav[aria-label="Primary"] > div');
  const card = document.querySelector('[class*="bg-background"]');
  // Experience cards / contact cards
  const experienceCard = document.querySelector("section .rounded-2xl.border") ||
    document.querySelector(".rounded-3xl.border");
  const closeBtn = document.querySelector('button[aria-label="Close project"]');

  // Caps / meta faint labels
  const faintLabels = [...document.querySelectorAll("p, span, dt")].filter((el) => {
    const c = getComputedStyle(el).color;
    // rough: look for class hints
    const cls = el.className || "";
    return /foreground\/(45|65|75|68)/.test(cls) || /text-foreground\/(45|65|75|68)/.test(cls);
  }).slice(0, 40).map((el) => {
    const cls = String(el.className);
    const r = el.getBoundingClientRect();
    // is it overlapping scrim or a plate parent?
    let onPlate = false;
    let parent = el.parentElement;
    for (let i = 0; i < 6 && parent; i++) {
      const bg = getComputedStyle(parent).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(",").map((s) => s.trim());
        const a = parts.length === 4 ? parseFloat(parts[3]) : 1;
        if (a >= 0.88) { onPlate = true; break; }
      }
      parent = parent.parentElement;
    }
    const sr = scrim ? scrim.getBoundingClientRect() : null;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const onScrim = !!(sr && cx >= sr.left && cx <= sr.right && cy >= sr.top && cy <= sr.bottom);
    return {
      text: (el.textContent || "").trim().slice(0, 48),
      cls: cls.slice(0, 120),
      onPlate,
      onScrim,
      faint75: /foreground\/75/.test(cls),
      faint65: /foreground\/65/.test(cls),
      faint45: /foreground\/45/.test(cls),
    };
  });

  return {
    theme,
    backdrop: !!bd,
    backdropScene: bd?.getAttribute("data-scene") || null,
    backdropSurface: bd?.getAttribute("data-surface") || null,
    field: !!field,
    fieldDisplay: fieldCs?.display,
    fieldVisibility: fieldCs?.visibility,
    fieldOpacity: fieldCs?.opacity,
    horizonExists: !!horizon,
    hazeRect: rect(haze),
    hazeDisplay: hazeCs?.display,
    hazeOpacity: hazeCs?.opacity,
    lightRect: rect(light),
    lightDisplay: lightCs?.display,
    lightOpacity: lightCs?.opacity,
    lightWidth: lightCs?.width,
    massL: rect(massL),
    massR: rect(massR),
    portrait: rect(portrait),
    h1Opacity: h1 ? cs(h1).opacity : null,
    h1Color: h1 ? cs(h1).color : null,
    h1Text: h1 ? (h1.innerText || "").replace(/\s+/g, " ").trim() : null,
    h1Rect: rect(h1),
    scrim: rect(scrim),
    scrimBg,
    scrimBgColor,
    scrimRuleText,
    grainOpacityComputed: grainCs ? parseFloat(grainCs.opacity) : null,
    grainRuleOpacity: grainRuleOpacity != null ? parseFloat(grainRuleOpacity) : null,
    grainZ: grainCs?.zIndex,
    scrimZ: scrimCs?.zIndex,
    grainBehindScrim,
    photoUrl,
    snowSamples,
    pickerPlate: plateAlpha(pickerBtn),
    navPlate: plateAlpha(navPlate),
    experienceCardPlate: plateAlpha(experienceCard),
    closePlate: plateAlpha(closeBtn),
    faintLabels,
    vh: window.innerHeight,
    vw: window.innerWidth,
    bdBackground: bdCs?.backgroundImage || bdCs?.background || null,
  };
}

async function collectContactOpacity(page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll("[data-contact-item]")];
    return items.slice(0, 6).map((el) => {
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        text: (el.textContent || "").trim().slice(0, 60),
        opacity: parseFloat(s.opacity),
        visibility: s.visibility,
        color: s.color,
      };
    });
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const shots = {};
  const blockers = [];

  // Reachability
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    const report = {
      overall: "NOT REACHABLE",
      error: String(e),
      gates: {},
      shots: {},
      blockers: ["SERVER_NOT_REACHABLE"],
    };
    fs.writeFileSync(path.join(OUT, "theme-contrast-smoke.json"), JSON.stringify(report, null, 2));
    console.error("NOT REACHABLE", e);
    await browser.close();
    process.exit(2);
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  });
  // Clear theme storage so default is night
  await context.addInitScript(() => {
    try { localStorage.removeItem("portfolio-theme"); } catch {}
  });

  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await skipSplash(page);

  // Default theme
  const defaultTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  gate(
    "DEFAULT",
    defaultTheme === "night" ? "PASS" : "FAIL",
    `data-theme=${defaultTheme}`
  );
  if (defaultTheme !== "night") blockers.push("DEFAULT_NOT_NIGHT");

  // --- Night Home: constellation only ---
  let m = await page.evaluate(measureBackdrop);
  shots.night_home = await shot(page, "night-home.png");
  const nightOk =
    !m.backdrop &&
    m.field &&
    m.fieldDisplay !== "none" &&
    parseFloat(m.fieldOpacity || "1") > 0;
  gate(
    "C7_NIGHT_HOME",
    nightOk ? "PASS" : "FAIL",
    `Night Home: backdrop=${m.backdrop} field=${m.field} fieldDisplay=${m.fieldDisplay} fieldOp=${m.fieldOpacity}`,
    { measured: m }
  );
  if (!nightOk) blockers.push("C7_NIGHT_HOME");

  // Horizon element must not exist (FE claim)
  // Will re-check on christmas/summer after theme switch

  // --- Christmas ---
  try {
    await setTheme(page, "Christmas");
  } catch (e) {
    gate("C1", "FAIL", `Theme switcher failed: ${e.message}`);
    blockers.push("C1_THEME_SWITCH");
  }

  m = await page.evaluate(measureBackdrop);
  shots.christmas_home = await shot(page, "christmas-home.png");

  // Scrim geometry + rule text
  const scrimW = m.scrim?.width ?? 0;
  const expectedW = Math.min(720, m.vw * 0.78);
  const scrimTopOk = m.scrim && Math.abs(m.scrim.top - m.vh * 0.1) < m.vh * 0.05;
  const scrimBottom = m.scrim ? m.scrim.top + m.scrim.height : 0;
  const scrimBottomTarget = m.vh * 0.82; // 10vh + 72vh = 82vh
  const scrimBottomOk = Math.abs(scrimBottom - scrimBottomTarget) < m.vh * 0.08;
  const scrimWidthOk = Math.abs(scrimW - expectedW) < 24;
  const hasFeather =
    /radial-gradient|mask-image/i.test(m.scrimRuleText || "") ||
    /radial-gradient/i.test(m.scrimBg || "");
  const has92 = /92%/.test(m.scrimRuleText || "") || /0\.92|92%/.test(m.scrimBg || "");
  const has82 = /82%/.test(m.scrimRuleText || "") || /0\.82|82%/.test(m.scrimBg || "");

  // Sample computed color under h1 via elementsFromPoint behind text
  const underType = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    if (!h1) return null;
    const r = h1.getBoundingClientRect();
    const x = r.left + Math.min(40, r.width / 2);
    const y = r.top + r.height / 2;
    const stack = document.elementsFromPoint(x, y).map((el) => ({
      tag: el.tagName,
      cls: String(el.className).slice(0, 80),
      bg: getComputedStyle(el).backgroundColor,
      bgImg: getComputedStyle(el).backgroundImage?.slice(0, 160),
    }));
    const scrim = document.querySelector(".theme-sky__scrim");
    const scs = scrim ? getComputedStyle(scrim) : null;
    // Read --background
    const bgVar = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    return { x, y, stack, bgVar, scrimBg: scs?.backgroundImage, scrimColor: scs?.backgroundColor };
  });

  const christmasBg = underType?.bgVar === "#6d1024" || underType?.bgVar === "#6D1024";
  const typeOnScrim = !!(underType?.stack || []).some((s) => /theme-sky__scrim/.test(s.cls));
  // Fail if white opaque plate under type
  const whiteUnder = (underType?.stack || []).some((s) => {
    const p = parseRgba(s.bg);
    return p && !p.raw && p.a > 0.5 && p.r > 240 && p.g > 240 && p.b > 240;
  });

  // Snow particle count from source-equivalent: inspect canvas draw — count nontransparent white pixels clusters is hard;
  // instead read particle count by evaluating ThemeBackdrop internals isn't exposed.
  // FE claim: 36 particles. Measure canvas white-dot approximate count + blocked type column.
  const snowMetric = await page.evaluate(() => {
    const canvas = document.querySelector(".theme-sky__particles");
    if (!canvas) return { error: "no canvas" };
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const sx = w / cssW, sy = h / cssH;
    const colW = Math.min(720, cssW * 0.78);
    const left = (cssW - colW) / 2;
    const top = cssH * 0.1;
    const bottom = cssH * 0.82;
    // Count bright pixels and cluster roughly
    let bright = 0;
    let inType = 0;
    let inBottom = 0;
    let inPickerZone = 0;
    let inNavZone = 0;
    const nav = document.querySelector('nav[aria-label="Primary"]')?.getBoundingClientRect();
    const picker = document.querySelector('button[aria-haspopup="listbox"]')?.getBoundingClientRect();
    // Downsample scan
    for (let py = 0; py < h; py += 2) {
      for (let px = 0; px < w; px += 2) {
        const i = (py * w + px) * 4;
        if (data[i + 3] < 30) continue;
        if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) continue;
        bright++;
        const x = px / sx, y = py / sy;
        if (x > left && x < left + colW && y > top && y < bottom) inType++;
        if (y > cssH * 0.82) inBottom++;
        if (picker && x >= picker.left - 8 && x <= picker.right + 8 && y >= picker.top - 8 && y <= picker.bottom + 8) inPickerZone++;
        if (nav && x >= nav.left - 8 && x <= nav.right + 8 && y >= nav.top - 8 && y <= nav.bottom + 8) inNavZone++;
      }
    }
    // Estimate particle count: connected-ish by sampling seed points every few px
    // Use a simple blob estimate: bright pixels / avg particle footprint (~4-12 px at dpr)
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const estParticles = Math.round(bright / (6 * dpr));
    return { bright, inType, inBottom, inPickerZone, inNavZone, estParticles, cssW, cssH, dpr };
  });

  // Source check for snow count — we also embed expected from FE
  const snowCountSource = 36; // from ThemeBackdrop countFor christmas desktop

  const c1Pass =
    christmasBg &&
    typeOnScrim &&
    !whiteUnder &&
    has82 &&
    has92 &&
    hasFeather &&
    (snowMetric.inType || 0) === 0 &&
    (snowMetric.inPickerZone || 0) === 0 &&
    (snowMetric.inNavZone || 0) === 0;

  gate(
    "C1",
    c1Pass ? "PASS" : "FAIL",
    `Christmas type on #6d1024 scrim=${typeOnScrim} bgVar=${underType?.bgVar} whiteUnder=${whiteUnder} snowInType=${snowMetric.inType} snowPicker=${snowMetric.inPickerZone} snowNav=${snowMetric.inNavZone} estParticles=${snowMetric.estParticles} sourceCount=${snowCountSource} scrim92=${has92} scrim82=${has82}`,
    { underType, snowMetric, scrim: m.scrim }
  );
  if (!c1Pass) blockers.push("C1_CHRISTMAS");

  // C3 Scrim
  const c3Pass = scrimWidthOk && scrimTopOk && scrimBottomOk && hasFeather && has82 && has92 && m.backdrop;
  gate(
    "C3",
    c3Pass ? "PASS" : "FAIL",
    `scrim w=${scrimW?.toFixed?.(1)} expected~${expectedW.toFixed(1)} top=${m.scrim?.top?.toFixed?.(1)} (0.1vh=${(m.vh * 0.1).toFixed(1)}) bottom=${scrimBottom.toFixed(1)} (0.82vh=${scrimBottomTarget.toFixed(1)}) feather=${hasFeather} core92=${has92} edge82=${has82}`,
    { scrimRuleText: m.scrimRuleText, scrim: m.scrim }
  );
  if (!c3Pass) blockers.push("C3_SCRIM");

  // C4 Grain
  const grainOp = m.grainOpacityComputed;
  const grainInRange = grainOp != null && grainOp >= 0.04 && grainOp <= 0.08;
  const c4Pass = grainInRange && m.grainBehindScrim;
  gate(
    "C4",
    c4Pass ? "PASS" : "FAIL",
    `grainOpacity=${grainOp} rule=${m.grainRuleOpacity} behindScrim=${m.grainBehindScrim} (range 0.04–0.08)`,
    { grainOpacityComputed: grainOp, grainBehindScrim: m.grainBehindScrim }
  );
  if (!c4Pass) blockers.push("C4_GRAIN");

  // Horizon / glow claim
  const glowEdgeOk =
    m.lightRect &&
    m.lightRect.width > 0 &&
    // soft radial ~16vw — check computed width near 16vw
    Math.abs(parseFloat(m.lightWidth) - m.vw * 0.16) < m.vw * 0.08;
  // On home christmas, light is left:6% per CSS — FE claim says right side on Home.
  // Re-read FE: "Glow is a soft radial at one outer edge (16vw), right side on Home, off the portrait."
  // Christmas CSS: left: 6%. Summer: right: 4%. Night: right: 8%.
  // So "right side on Home" may mean generally edge — verify not through portrait center.
  const portraitCenterY = m.portrait ? m.portrait.top + m.portrait.height / 2 : null;
  const hazeCrossesPortrait =
    m.hazeRect &&
    m.portrait &&
    m.hazeRect.top < portraitCenterY &&
    m.hazeRect.bottom > portraitCenterY &&
    m.hazeRect.left < m.portrait.right &&
    m.hazeRect.right > m.portrait.left &&
    // mask punches center — still check geometry overlap
    true;

  // Better: sample screenshot brightness across portrait center horizontal band of backdrop only (sides)
  const portraitClip = m.portrait
    ? await page.screenshot({
        clip: {
          x: Math.max(0, m.portrait.left),
          y: Math.max(0, m.portrait.top),
          width: Math.min(m.portrait.width, 1440 - m.portrait.left),
          height: Math.min(m.portrait.height, 900 - m.portrait.top),
        },
      })
    : null;
  let horizonBand = null;
  if (portraitClip) {
    // Mid horizontal strip of portrait — if a bright horizon band crosses, mid rows brighter than face?
    // Actually portrait is a photo; check area BEHIND portrait is masked on mobile.
    // For desktop, scene is beside/behind via mask. Sample full page center line.
    const full = await page.screenshot();
    const { width, height, rgba } = decodePngRgba(full);
    const midX0 = Math.floor(width * 0.35);
    const midX1 = Math.floor(width * 0.65);
    const rowBright = [];
    for (let y = 0; y < height; y += 2) {
      let s = 0, n = 0;
      for (let x = midX0; x < midX1; x += 3) {
        const i = (y * width + x) * 4;
        s += (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
        n++;
      }
      rowBright.push(s / n);
    }
    // Find brightest row in lower 50–85% (old fail ~71%)
    let maxY = 0, maxB = 0;
    for (let i = Math.floor(rowBright.length * 0.5); i < Math.floor(rowBright.length * 0.9); i++) {
      if (rowBright[i] > maxB) { maxB = rowBright[i]; maxY = i * 2; }
    }
    const maxFrac = maxY / height;
    // Compare to upper sky avg
    let upper = 0, un = 0;
    for (let i = Math.floor(rowBright.length * 0.05); i < Math.floor(rowBright.length * 0.25); i++) {
      upper += rowBright[i]; un++;
    }
    upper /= un || 1;
    horizonBand = { maxY, maxFrac, maxB, upper, spike: maxB - upper };
  }

  gate(
    "C6_HORIZON",
    !m.horizonExists && (horizonBand ? horizonBand.spike < 40 || horizonBand.maxFrac > 0.85 || horizonBand.maxFrac < 0.55 : true)
      ? "PASS"
      : "FAIL",
    `horizonEl=${m.horizonExists} glowW=${m.lightWidth} glowRect=${JSON.stringify(m.lightRect)} hazeCrossesPortraitGeom=${hazeCrossesPortrait} band=${JSON.stringify(horizonBand)}`,
    { horizonExists: m.horizonExists, glowEdgeOk, horizonBand, hazeCrossesPortrait }
  );
  if (gates.C6_HORIZON.status === "FAIL") blockers.push("C6_HORIZON");

  // C5 plates on home christmas
  const plateOk = (p) => p && p.a != null && p.a >= 0.88;
  // Find more plates: experience cards, skill chips
  const platesHome = await page.evaluate(() => {
    const analyze = (el) => {
      if (!el) return null;
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (!m) return { bg, a: null };
      const parts = m[1].split(",").map((s) => s.trim());
      return { bg, a: parts.length === 4 ? parseFloat(parts[3]) : 1, cls: String(el.className).slice(0, 100) };
    };
    const cards = [...document.querySelectorAll(".rounded-2xl.border, .rounded-3xl.border")].map(analyze);
    const chips = [...document.querySelectorAll("span.rounded-full.border, a.rounded-full.border")].slice(0, 8).map(analyze);
    const picker = analyze(document.querySelector('button[aria-haspopup="listbox"]'));
    const nav = analyze(document.querySelector('nav[aria-label="Primary"] > div'));
    return { cards, chips, picker, nav };
  });

  const cardsPass = platesHome.cards.length === 0 || platesHome.cards.every((c) => c.a >= 0.88);
  const pickerPass = plateOk(platesHome.picker);
  const navPass = plateOk(platesHome.nav);
  // Chips may be foreground/0.04 intentionally for skill pills — FE says "including chips and explore fallback cards"
  const chipFail = platesHome.chips.filter((c) => c.a != null && c.a < 0.88 && c.a > 0);
  // Skill chips use bg-foreground/[0.04] — those are NOT plates; FE said plates are bg-background at 0.88 including chips
  // Re-read: "Plates are bg-background at 0.88, including chips and explore fallback cards"
  // So chips that are meant as plates should be 0.88. Skill chips at 0.04 would FAIL if counted as plates.
  // Check only elements with bg-background in class
  const bgBackgroundPlates = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      const cls = String(el.className || "");
      if (!/bg-background\/(?:\[)?0?\.?(?:88|90|\[0\.88\])/.test(cls) && !/bg-background\/\[0\.88\]/.test(cls) && !/bg-background\/90/.test(cls) && !/bg-background\/\[0\.88\]/.test(cls)) {
        if (!cls.includes("bg-background/[0.88]") && !cls.includes("bg-background/90") && !cls.includes("bg-background/[0.88]")) {
          // also match Tailwind arbitrary
          if (!/bg-background\/\[0\.88\]/.test(cls) && !cls.includes("bg-background/[0.88]")) {
            if (!(cls.includes("bg-background/") && /0\.88|\/90|\/\[0\.88\]/.test(cls))) continue;
          }
        }
      }
      if (!cls.includes("bg-background")) continue;
      if (!(/0\.88|\/90\b|\[0\.88\]/.test(cls))) continue;
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      const a = m ? (m[1].split(",").length === 4 ? parseFloat(m[1].split(",")[3]) : 1) : null;
      out.push({ cls: cls.slice(0, 90), a, bg });
    }
    return out.slice(0, 30);
  });

  const c5Pass = pickerPass && navPass && cardsPass && bgBackgroundPlates.every((p) => p.a == null || p.a >= 0.87);
  gate(
    "C5",
    c5Pass ? "PASS" : "FAIL",
    `picker.a=${platesHome.picker?.a} nav.a=${platesHome.nav?.a} cards=${JSON.stringify(platesHome.cards.map(c=>c.a))} bgBackgroundPlates=${JSON.stringify(bgBackgroundPlates.map(p=>p.a))} chipAlphas=${JSON.stringify(platesHome.chips.map(c=>c.a))}`,
    { platesHome, bgBackgroundPlates }
  );
  if (!c5Pass) blockers.push("C5_PLATES");

  // C7/C8 christmas replaces constellation
  const c8Pass = m.backdrop && m.backdropScene === "christmas" && (!m.field || m.fieldDisplay === "none" || parseFloat(m.fieldOpacity || "0") === 0);
  gate(
    "C8",
    c8Pass ? "PASS" : "FAIL",
    `christmas replaces field: backdrop=${m.backdrop} scene=${m.backdropScene} field=${m.field} fieldDisplay=${m.fieldDisplay}`,
  );
  if (!c8Pass) blockers.push("C8_REPLACE");

  // C11 no photo files in backdrop
  gate(
    "C11",
    !m.photoUrl ? "PASS" : "FAIL",
    `photoUrl=${m.photoUrl}`,
  );
  if (m.photoUrl) blockers.push("C11_PHOTO");

  // C12 board hint / faint labels
  const faintOff = (m.faintLabels || []).filter(
    (f) => (f.faint65 || f.faint45 || f.faint75) && !f.onPlate && !f.onScrim
  );
  // Board hint specifically
  const boardHint = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div, span, p")].find((n) =>
      /Drag to explore|Click card to enter/i.test(n.textContent || "")
    );
    if (!el) return { found: false };
    const cls = String(el.className || "");
    const bg = getComputedStyle(el).backgroundColor;
    const color = getComputedStyle(el).color;
    let onPlate = false;
    let p = el.parentElement;
    for (let i = 0; i < 5 && p; i++) {
      const b = getComputedStyle(p).backgroundColor;
      const m = b.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(",");
        const a = parts.length === 4 ? parseFloat(parts[3]) : 1;
        if (a >= 0.88) onPlate = true;
      }
      p = p.parentElement;
    }
    return { found: true, cls: cls.slice(0, 120), color, onPlate, text: (el.textContent || "").trim().slice(0, 80) };
  });
  // On Home, board hint not visible — check when on projects later
  gate(
    "C12_HOME_FAINT",
    faintOff.filter((f) => f.faint65 || f.faint45).length === 0 ? "PASS" : "FAIL",
    `faintOffPlateOrScrim=${JSON.stringify(faintOff.slice(0, 8))} boardHintHome=${JSON.stringify(boardHint)}`,
    { faintOff, boardHint }
  );
  if (gates.C12_HOME_FAINT.status === "FAIL") blockers.push("C12_FAINT");

  // --- Contact ---
  await goNav(page, "Contact");
  // Capture opacity ASAP
  const contactImmediate = await collectContactOpacity(page);
  await page.waitForTimeout(50);
  const contactSoon = await collectContactOpacity(page);
  shots.contact = await shot(page, "contact.png");
  const contactBd = await page.evaluate(measureBackdrop);
  const contactItemsOk = contactImmediate.length > 0 && contactImmediate.every((i) => i.opacity >= 0.95 && i.visibility !== "hidden");
  const contactBdOk = !!contactBd.backdrop;

  gate(
    "C2",
    contactItemsOk ? "PASS" : "FAIL",
    `Contact first-paint opacities=${JSON.stringify(contactImmediate.map(i=>i.opacity))} soon=${JSON.stringify(contactSoon.map(i=>i.opacity))}`,
    { contactImmediate, contactSoon }
  );
  if (!contactItemsOk) blockers.push("C2_CONTACT");

  gate(
    "C7_CONTACT",
    contactBdOk ? "PASS" : "FAIL",
    `ThemeBackdrop on Contact: ${contactBdOk} scene=${contactBd.backdropScene}`,
  );
  if (!contactBdOk) blockers.push("C7_CONTACT");

  // Reduced motion Contact
  const prmContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  await prmContext.addInitScript(() => {
    try { localStorage.removeItem("portfolio-theme"); } catch {}
  });
  const prmPage = await prmContext.newPage();
  await prmPage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await skipSplash(prmPage);
  await setTheme(prmPage, "Christmas").catch(() => {});
  await goNav(prmPage, "Contact");
  const prmContact = await collectContactOpacity(prmPage);
  shots.contact_prm = await shot(prmPage, "contact-prm.png");
  const prmOk = prmContact.length > 0 && prmContact.every((i) => i.opacity >= 0.95);
  gate(
    "C2_PRM",
    prmOk ? "PASS" : "FAIL",
    `reduced-motion Contact opacities=${JSON.stringify(prmContact.map(i=>i.opacity))}`,
    { prmContact }
  );
  if (!prmOk) blockers.push("C2_PRM");
  await prmContext.close();

  // --- Projects grid + list + overlay ---
  await goNav(page, "Projects");
  await page.waitForTimeout(600);
  // Switch to grid
  const gridBtn = page.getByRole("button", { name: /Grid view/i });
  if (await gridBtn.count()) await gridBtn.click();
  await page.waitForTimeout(500);
  const projectsGrid = await page.evaluate(measureBackdrop);
  shots.projects = await shot(page, "projects.png");
  const gridBdOk = !!projectsGrid.backdrop;
  gate(
    "C7_PROJECTS_GRID",
    gridBdOk ? "PASS" : "FAIL",
    `ThemeBackdrop on Projects grid: ${gridBdOk} scene=${projectsGrid.backdropScene} surface=${projectsGrid.backdropSurface}`,
  );
  if (!gridBdOk) blockers.push("C7_PROJECTS_GRID");

  // Board hint on projects
  const boardHintProjects = await page.evaluate(() => {
    const hintRoot = document.querySelector("[class*='bottom-[calc(6.25rem']") ||
      [...document.querySelectorAll("div")].find((n) => /Drag to explore/i.test(n.textContent || ""));
    // find text-foreground/68 or /75
    const el = [...document.querySelectorAll("div")].find((n) =>
      /Drag to explore/i.test(n.textContent || "")
    );
    if (!el) return { found: false };
    const cs = getComputedStyle(el);
    const cls = String(el.className);
    const op = parseFloat(cs.opacity);
    let onPlate = false;
    let p = el.parentElement;
    for (let i = 0; i < 5 && p; i++) {
      const b = getComputedStyle(p).backgroundColor;
      const m = b.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(",");
        const a = parts.length === 4 ? parseFloat(parts[3]) : 1;
        if (a >= 0.88) onPlate = true;
      }
      p = p.parentElement;
    }
    // hint uses text-foreground/68 — not /75; still a faint label
    const isFaint = /foreground\/(65|68|75|45)/.test(cls);
    return { found: true, cls: cls.slice(0, 140), opacity: op, onPlate, isFaint, color: cs.color, display: cs.display };
  });
  // If found and visible and faint without plate — fail C12
  const boardHintFail =
    boardHintProjects.found &&
    boardHintProjects.opacity > 0.2 &&
    boardHintProjects.display !== "none" &&
    boardHintProjects.isFaint &&
    !boardHintProjects.onPlate;
  gate(
    "C12_BOARD_HINT",
    !boardHintFail ? "PASS" : "FAIL",
    `boardHint=${JSON.stringify(boardHintProjects)} (must not be faint label off plate)`,
  );
  if (boardHintFail) blockers.push("C12_BOARD_HINT");

  // List view
  const listBtn = page.getByRole("button", { name: /List view/i });
  if (await listBtn.count()) await listBtn.click();
  await page.waitForTimeout(500);
  const projectsList = await page.evaluate(measureBackdrop);
  const listBdOk = !!projectsList.backdrop;
  gate(
    "C7_PROJECTS_LIST",
    listBdOk ? "PASS" : "FAIL",
    `ThemeBackdrop on Projects list: ${listBdOk}`,
  );
  if (!listBdOk) blockers.push("C7_PROJECTS_LIST");

  // List card plates
  const listPlates = await page.evaluate(() => {
    return [...document.querySelectorAll("ul li button, ul button")].slice(0, 5).map((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      const a = m ? (m[1].split(",").length === 4 ? parseFloat(m[1].split(",")[3]) : 1) : null;
      return { a, bg, cls: String(el.className).slice(0, 80) };
    });
  });
  const listPlatePass = listPlates.length === 0 || listPlates.every((p) => p.a >= 0.88);
  gate(
    "C5_LIST_CARDS",
    listPlatePass ? "PASS" : "FAIL",
    `list card alphas=${JSON.stringify(listPlates.map(p=>p.a))}`,
  );
  if (!listPlatePass) blockers.push("C5_LIST_CARDS");

  // Open overlay from list
  const projectRow = page.locator("ul button, ul li button").first();
  if (await projectRow.count()) {
    await projectRow.click();
  } else {
    // try grid card
    await page.getByRole("button", { name: /Grid view/i }).click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator("button.group, [class*='cursor-pointer']").first().click();
  }
  await page.waitForSelector('button[aria-label="Close project"]', { timeout: 10000 });
  await page.waitForTimeout(200);
  const overlayEarly = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const title = dialog?.querySelector("h2");
    const close = document.querySelector('button[aria-label="Close project"]');
    const bd = document.querySelector('.theme-backdrop[data-surface="overlay"]');
    const dcs = dialog ? getComputedStyle(dialog) : null;
    const bg = dcs?.backgroundColor;
    const m = bg?.match(/rgba?\(([^)]+)\)/);
    const a = m ? (m[1].split(",").length === 4 ? parseFloat(m[1].split(",")[3]) : 1) : null;
    const closeBg = close ? getComputedStyle(close).backgroundColor : null;
    const cm = closeBg?.match(/rgba?\(([^)]+)\)/);
    const ca = cm ? (cm[1].split(",").length === 4 ? parseFloat(cm[1].split(",")[3]) : 1) : null;
    return {
      dialogOpacity: dcs ? parseFloat(dcs.opacity) : null,
      dialogBg: bg,
      dialogBgA: a,
      titleOpacity: title ? parseFloat(getComputedStyle(title).opacity) : null,
      titleText: title?.textContent?.trim() || null,
      backdrop: !!bd,
      closeA: ca,
    };
  });
  // Wait for enter animation to settle a bit but title itself should not be GSAP-gated
  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return d && parseFloat(getComputedStyle(d).opacity) > 0.9;
  }, null, { timeout: 5000 }).catch(() => {});
  const overlayLate = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const title = dialog?.querySelector("h2");
    const dcs = dialog ? getComputedStyle(dialog) : null;
    const bg = dcs?.backgroundColor;
    const m = bg?.match(/rgba?\(([^)]+)\)/);
    const a = m ? (m[1].split(",").length === 4 ? parseFloat(m[1].split(",")[3]) : 1) : null;
    return {
      dialogOpacity: dcs ? parseFloat(dcs.opacity) : null,
      dialogBgA: a,
      titleOpacity: title ? parseFloat(getComputedStyle(title).opacity) : null,
    };
  });
  shots.overlay = await shot(page, "overlay.png");

  const c9Pass =
    overlayLate.dialogBgA != null &&
    overlayLate.dialogBgA >= 0.99 &&
    overlayLate.titleOpacity >= 0.95 &&
    overlayEarly.titleOpacity >= 0.95;
  gate(
    "C9",
    c9Pass ? "PASS" : "FAIL",
    `overlay bgA=${overlayLate.dialogBgA} titleOpEarly=${overlayEarly.titleOpacity} titleOpLate=${overlayLate.titleOpacity} dialogOp=${overlayLate.dialogOpacity}`,
    { overlayEarly, overlayLate }
  );
  if (!c9Pass) blockers.push("C9_OVERLAY");

  gate(
    "C7_OVERLAY",
    overlayEarly.backdrop ? "PASS" : "FAIL",
    `ThemeBackdrop on overlay: ${overlayEarly.backdrop}`,
  );
  if (!overlayEarly.backdrop) blockers.push("C7_OVERLAY");

  gate(
    "C5_CLOSE",
    overlayEarly.closeA >= 0.88 ? "PASS" : "FAIL",
    `Close plate alpha=${overlayEarly.closeA}`,
  );
  if (!(overlayEarly.closeA >= 0.88)) blockers.push("C5_CLOSE");

  await page.locator('button[aria-label="Close project"]').click();
  await page.waitForTimeout(400);

  // --- Summer pixel check ---
  await goNav(page, "Home");
  await setTheme(page, "Summer");
  await page.waitForTimeout(600);
  const summer = await page.evaluate(measureBackdrop);
  shots.summer_home = await shot(page, "summer-home.png");
  const summerPng = fs.readFileSync(path.join(SHOTS, "summer-home.png"));
  const summerBright = sampleBandBrightness(summerPng, 0.55, 0.95);
  const summerSky = sampleBandBrightness(summerPng, 0.0, 0.35);
  // Summer scene should be light / painted, not night-dark
  const summerPainted = summerSky.avg > 140 || summerBright.avg > 100;
  const summerTypeOk = summer.h1Opacity != null && parseFloat(summer.h1Opacity) >= 0.95;
  // Light theme: foreground should be dark
  const summerColor = parseRgba(summer.h1Color);
  const summerContrastOk =
    summerColor && !summerColor.raw && (summerColor.r + summerColor.g + summerColor.b) / 3 < 80;
  const summerReplace = summer.backdrop && summer.backdropScene === "summer" && (!summer.field || summer.fieldDisplay === "none");
  gate(
    "C10_SUMMER",
    summerPainted && summerTypeOk && summerContrastOk && summerReplace ? "PASS" : "FAIL",
    `painted skyAvg=${summerSky.avg.toFixed(1)} shoreAvg=${summerBright.avg.toFixed(1)} h1Op=${summer.h1Opacity} h1Color=${summer.h1Color} contrastDarkType=${summerContrastOk} replace=${summerReplace} scene=${summer.backdropScene}`,
    { summerSky, summerBright, h1Color: summer.h1Color }
  );
  if (gates.C10_SUMMER.status === "FAIL") blockers.push("C10_SUMMER");

  // --- Spring pixel check ---
  await setTheme(page, "Spring");
  await page.waitForTimeout(600);
  const spring = await page.evaluate(measureBackdrop);
  shots.spring_home = await shot(page, "spring-home.png");
  const springPng = fs.readFileSync(path.join(SHOTS, "spring-home.png"));
  const springSky = sampleBandBrightness(springPng, 0.0, 0.4);
  const springBright = sampleBandBrightness(springPng, 0.5, 0.95);
  const springPainted = springSky.avg > 140 || springBright.avg > 100;
  const springTypeOk = spring.h1Opacity != null && parseFloat(spring.h1Opacity) >= 0.95;
  const springColor = parseRgba(spring.h1Color);
  const springContrastOk =
    springColor && !springColor.raw && (springColor.r + springColor.g + springColor.b) / 3 < 80;
  const springReplace = spring.backdrop && spring.backdropScene === "spring" && (!spring.field || spring.fieldDisplay === "none");
  gate(
    "C10_SPRING",
    springPainted && springTypeOk && springContrastOk && springReplace ? "PASS" : "FAIL",
    `painted skyAvg=${springSky.avg.toFixed(1)} lowAvg=${springBright.avg.toFixed(1)} h1Op=${spring.h1Opacity} h1Color=${spring.h1Color} contrastDarkType=${springContrastOk} replace=${springReplace}`,
    { springSky, springBright, h1Color: spring.h1Color }
  );
  if (gates.C10_SPRING.status === "FAIL") blockers.push("C10_SPRING");

  // --- Autumn quick replace check ---
  await setTheme(page, "Autumn");
  await page.waitForTimeout(400);
  const autumn = await page.evaluate(measureBackdrop);
  gate(
    "C8_AUTUMN",
    autumn.backdrop && autumn.backdropScene === "autumn" && (!autumn.field || autumn.fieldDisplay === "none") ? "PASS" : "FAIL",
    `autumn backdrop=${autumn.backdrop} scene=${autumn.backdropScene} field=${autumn.field}`,
  );
  if (gates.C8_AUTUMN.status === "FAIL") blockers.push("C8_AUTUMN");

  // --- Mobile portrait 390x844 ---
  await setTheme(page, "Christmas");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobile = await page.evaluate(measureBackdrop);
  shots.mobile_portrait = await shot(page, "mobile-portrait.png");
  // On mobile home, theme-backdrop is masked to below ~64svh — scene should stay below portrait
  const mobileSceneBelow =
    mobile.portrait &&
    // backdrop mask starts visible ~64svh; portrait bottom should be above that
    mobile.portrait.bottom <= mobile.vh * 0.72 + 40;
  // Also check haze/light vs portrait
  const mobileHorizonOk = !mobile.horizonExists;
  gate(
    "C6_MOBILE",
    mobileSceneBelow && mobileHorizonOk ? "PASS" : "FAIL",
    `portraitBottom=${mobile.portrait?.bottom?.toFixed?.(1)} vh=${mobile.vh} sceneBelowOk=${mobileSceneBelow} horizonEl=${mobile.horizonExists} maskExpected~64–72svh`,
    { portrait: mobile.portrait }
  );
  if (gates.C6_MOBILE.status === "FAIL") blockers.push("C6_MOBILE");

  // Aggregate C6
  const c6pass = gates.C6_HORIZON.status === "PASS" && gates.C6_MOBILE.status === "PASS";
  gate("C6", c6pass ? "PASS" : "FAIL", `horizon=${gates.C6_HORIZON.status} mobile=${gates.C6_MOBILE.status}`);

  // FE claim summary numbers
  const feClaims = {
    grainOpacity: grainOp,
    grainBehindScrim: m.grainBehindScrim,
    horizonElementExists: m.horizonExists,
    scrimCore92: has92,
    scrimFeather82: has82,
    scrimWidth: scrimW,
    scrimExpectedWidth: expectedW,
    snowSourceCount: snowCountSource,
    snowInTypeColumn: snowMetric.inType,
    contactAutoAlphaImmediate: contactImmediate.map((i) => i.opacity),
  };

  const failed = Object.values(gates).filter((g) => g.status === "FAIL");
  const overall = failed.length ? "FAIL" : "CLEAR";

  const report = {
    overall,
    blockers: [...new Set(blockers)],
    failedIds: failed.map((g) => g.id),
    gates,
    shots,
    feClaims,
    measured: {
      grainOpacity: grainOp,
      scrim: { width: scrimW, top: m.scrim?.top, height: m.scrim?.height, rule: m.scrimRuleText },
      snowMetric,
      defaultTheme,
    },
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "theme-contrast-smoke.json"), JSON.stringify(report, null, 2));
  console.log("\n=== OVERALL", overall, "===");
  console.log("blockers:", report.blockers.join(", ") || "(none)");
  console.log("feClaims:", JSON.stringify(feClaims));
  await browser.close();
  process.exit(overall === "CLEAR" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  try {
    fs.writeFileSync(
      path.join(OUT, "theme-contrast-smoke.json"),
      JSON.stringify({ overall: "FAIL", error: String(e), stack: e.stack, gates, blockers: ["SCRIPT_ERROR"] }, null, 2)
    );
  } catch {}
  process.exit(1);
});
