import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://127.0.0.1:3000";
const SHOT_DIR = path.join(OUT, "theme-recheck-shots");

const SOURCE = {
  scrim: "globals.css:432-444 .theme-sky__scrim { left:50%; top:10vh; width:min(720px,78vw); height:72vh; translateX(-50%); color-mix background 92% core, 82% at 58%, transparent 100% }",
  springGlow: "globals.css:260-266 width min(200px,16vw); 274-277 christmas/spring left:0; 296-299 spring radial; 301-304 home left auto/right 0; 352-355 home shore AND light display:none",
  shoreMask: "globals.css:340-349 summer shore display:block; mask linear-gradient 90deg #000 0-12%, transparent 24-76%, #000 88-100%",
  mobileMask: "globals.css:450-454 @media max-width 767px .theme-backdrop[data-surface=home] mask transparent 0 to 64svh, #000 72svh",
  grain: "globals.css:422-429 .theme-sky__grain opacity 0.06; DOM order Sky grain then canvas then scrim (ThemeBackdrop.tsx:187,297-298)",
  onlyLeft50: "globals.css:433 is the only literal left:50% (scrim). BottomNav.tsx:100 also has Tailwind left-1/2 (not a horizon rule).",
  snowBlock: "ThemeBackdrop.tsx:38-56 christmas snow 36; blocked() skips type column min(720,78vw) x 10-82vh, y>height-120, and y<76&&x<240. Draw skips blocked particles (line 259).",
  contactGsap: "ContactView.tsx:24 gsap.set autoAlpha 1 before any tween; 26-28 reduced motion returns; 30-39 fromTo y only. Items have no opacity-0 class (lines 53-67).",
  nightReplace: "HomeView.tsx:92 night only mounts AcHomeField; ThemeBackdrop.tsx:208-287 showScene false and return null when surface home and theme night.",
  mounts: "HomeView.tsx:93 surface home; PortfolioExperience.tsx:336 surface projects (grid and list share this mount); ContactView.tsx:48 surface contact; ProjectDetailOverlay.tsx:456 surface overlay.",
  plates: {
    wall: "SphereGallery.tsx:344-350 card texture fillStyle paint.background (opaque theme color), not a CSS alpha wash. Hover overlay opacity 0.24 is accent, separate. Fallback list cards line 1414 bg-background/[0.88].",
    chips: "HomeView.tsx:238 bg-background/[0.88]",
    social: "ContactView.tsx:105 bg-background/[0.88]",
    toggle: "ProjectsViewToggle.tsx:34 bg-background/[0.88]",
    zoomClose: "ProjectDetailOverlay.tsx:742 bg-background/[0.88]",
    cards: "HomeView.tsx:216 experience bg-background/[0.88]; ContactView.tsx:76 and 86 bg-background/[0.88]; ProjectsGridView.tsx:106 bg-background/[0.88]; ProjectsListView.tsx:107 bg-background/[0.88]",
    picker: "ThemePicker.tsx:109 bg-background/[0.88] (menu is /90 when open)",
    nav: "BottomNav.tsx:108 bg-background/[0.88]",
  },
  photos: "Theme backdrop grain is an inline SVG turbulence data URL (globals.css:426), not a photo file. Project webp/png assets are portfolio content, not the sky.",
  leftoverNote: "ProjectsListView.tsx:124 thumb uses ring-foreground/25 and bg-foreground/5. Not one of the five named controls. Note, not a plate fail, unless live shows it on a named control.",
};

function decodePng(buf) {
  let offset = 8;
  let width = 0, height = 0, colorType = 6;
  const idat = [];
  let palette = null;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "PLTE") palette = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 0 ? 1 : colorType === 4 ? 2 : 4;
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let ip = 0, op = 0;
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[ip++];
    raw.copy(cur, 0, ip, ip + stride);
    ip += stride;
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
        rgba[op++] = cur[x * 4]; rgba[op++] = cur[x * 4 + 1]; rgba[op++] = cur[x * 4 + 2]; rgba[op++] = cur[x * 4 + 3];
      } else if (colorType === 2) {
        rgba[op++] = cur[x * 3]; rgba[op++] = cur[x * 3 + 1]; rgba[op++] = cur[x * 3 + 2]; rgba[op++] = 255;
      } else if (colorType === 3) {
        const idx = cur[x] * 3;
        rgba[op++] = palette[idx]; rgba[op++] = palette[idx + 1]; rgba[op++] = palette[idx + 2]; rgba[op++] = 255;
      } else if (colorType === 0) {
        const g = cur[x]; rgba[op++] = g; rgba[op++] = g; rgba[op++] = g; rgba[op++] = 255;
      } else {
        const g = cur[x * 2]; rgba[op++] = g; rgba[op++] = g; rgba[op++] = g; rgba[op++] = cur[x * 2 + 1];
      }
    }
    cur.copy(prev);
  }
  return { width, height, rgba };
}

function px(img, x, y) {
  const xx = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  const yy = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const i = (yy * img.width + xx) * 4;
  return { r: img.rgba[i], g: img.rgba[i + 1], b: img.rgba[i + 2], a: img.rgba[i + 3] };
}

function dist(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function parseCssColor(input) {
  if (!input) return null;
  const ok = String(input).match(/oklab\(\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\/\s*([\d.]+%?)\s*\)/i);
  if (ok) {
    const a = ok[4].endsWith("%") ? parseFloat(ok[4]) / 100 : parseFloat(ok[4]);
    return { space: "oklab", L: +ok[1], aCh: +ok[2], bCh: +ok[3], a, raw: input };
  }
  const m = String(input).match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/i);
  if (!m) return { raw: input };
  let a = 1;
  if (m[4] != null) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a };
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function relLum(c) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contrast(a, b) {
  const L1 = relLum(a), L2 = relLum(b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function sampleBox(img, box, step = 4) {
  const colors = [];
  const x0 = Math.max(0, box.x + 4);
  const y0 = Math.max(0, box.y + 4);
  const x1 = Math.min(img.width - 1, box.x + box.w - 4);
  const y1 = Math.min(img.height - 1, box.y + box.h - 4);
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) colors.push(px(img, x, y));
  }
  return colors;
}

function medianColor(colors) {
  if (!colors.length) return null;
  const mid = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  return { r: mid(colors.map((c) => c.r)), g: mid(colors.map((c) => c.g)), b: mid(colors.map((c) => c.b)), a: 255, n: colors.length };
}

async function shot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, name);
  const buf = await page.screenshot({ path: file, fullPage: false, type: "png" });
  return { name, buf };
}

async function skipSplash(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    return n && parseFloat(getComputedStyle(n).opacity) > 0.05;
  }, null, { timeout: 25000 });
  await page.waitForTimeout(400);
}

async function setTheme(page, label) {
  const btn = page.locator('button[aria-haspopup="listbox"]').first();
  await btn.click();
  await page.waitForTimeout(150);
  const option = page.locator('[role="option"]').filter({ hasText: new RegExp(`^${label}$`, "i") });
  if (!(await option.count())) {
    const opts = await page.locator('[role="option"]').allTextContents();
    throw new Error(`theme option ${label} missing, saw ${JSON.stringify(opts)}`);
  }
  await option.first().click();
  const id = { Night: "night", Christmas: "christmas", Summer: "summer", Autumn: "autumn", Spring: "spring" }[label];
  await page.waitForFunction((want) => document.documentElement.getAttribute("data-theme") === want, id, { timeout: 8000 });
  await page.waitForTimeout(450);
}

async function goNav(page, label) {
  await page.locator('nav[aria-label="Primary"]').getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(450);
}

function snapExpr() {
  return () => {
    const ancestorHidden = (el) => {
      let n = el;
      while (n) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return true;
        n = n.parentElement;
      }
      return false;
    };
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const info = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        opacity: cs.opacity,
        visibility: cs.visibility,
        left: cs.left,
        right: cs.right,
        width: cs.width,
        height: cs.height,
        top: cs.top,
        bottom: cs.bottom,
        transform: cs.transform,
        position: cs.position,
        zIndex: cs.zIndex,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        maskImage: cs.webkitMaskImage || cs.maskImage,
        className: String(el.className || "").slice(0, 220),
        rect: rectOf(el),
        hiddenByAncestor: ancestorHidden(el),
        scene: el.getAttribute?.("data-scene") || null,
        surface: el.getAttribute?.("data-surface") || null,
      };
    };
    const backs = [...document.querySelectorAll(".theme-backdrop")].map((el) => info(el));
    const visibleBack = [...document.querySelectorAll(".theme-backdrop")].filter((el) => !ancestorHidden(el));
    const pick = (surface) => visibleBack.find((el) => el.getAttribute("data-surface") === surface) || null;
    const homeBd = pick("home");
    const projectsBd = pick("projects");
    const contactBd = pick("contact");
    const overlayBd = pick("overlay");
    const activeBd = visibleBack[visibleBack.length - 1] || null;
    const root = activeBd;
    const q = (sel, base = root) => (base ? base.querySelector(sel) : null);
    const field = document.querySelector(".ac-home-field");
    const h1 = [...document.querySelectorAll("h1")].find((el) => !ancestorHidden(el)) || null;
    const cssVars = getComputedStyle(document.documentElement);
    const centered = [];
    const vw = window.innerWidth;
    const nodes = [
      ...document.querySelectorAll(".theme-backdrop, .theme-backdrop *, nav[aria-label='Primary'], .ac-home-field, .ac-home-field *"),
    ];
    for (const el of nodes) {
      if (ancestorHidden(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.position === "static") continue;
      const left = cs.left;
      const leftPx = left.endsWith("px") ? parseFloat(left) : left.endsWith("%") ? (parseFloat(left) / 100) * vw : NaN;
      if (!Number.isNaN(leftPx) && Math.abs(leftPx - vw / 2) <= vw * 0.08) {
        centered.push({
          tag: el.tagName,
          className: String(el.className || "").slice(0, 140),
          left: cs.left,
          width: cs.width,
          transform: cs.transform,
          surface: el.closest?.(".theme-backdrop")?.getAttribute("data-surface") || null,
        });
      }
    }
    const plateOf = (el, name) => {
      if (!el || ancestorHidden(el)) return { name, found: false };
      const cs = getComputedStyle(el);
      return {
        name,
        found: true,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        opacity: cs.opacity,
        className: String(el.className || "").slice(0, 240),
        text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60),
      };
    };
    const byClass = (pred) => [...document.querySelectorAll("a,button,div,span")].find((el) => pred(el) && !ancestorHidden(el));
    const skill = byClass((el) => /rounded-full/.test(el.className) && /bg-background\/\[0\.88\]/.test(el.className) && /tracking-\[0\.08em\]/.test(el.className));
    const social = byClass((el) => el.tagName === "A" && el.getAttribute("target") === "_blank" && /rounded-full/.test(el.className));
    const toggle = document.querySelector('[aria-label="Projects layout"]');
    const picker = document.querySelector('button[aria-haspopup="listbox"]');
    const nav = document.querySelector('nav[aria-label="Primary"] > div');
    const expCard = byClass((el) => /rounded-2xl/.test(el.className) && /bg-background\/\[0\.88\]/.test(el.className));
    const contactCard = byClass((el) => /rounded-3xl/.test(el.className) && /bg-background\/\[0\.88\]/.test(el.className));
    const gridCard = document.querySelector("[data-grid-item] button");
    const listRow = document.querySelector("[data-list-item] button, [data-list-item] a");
    const zoomClose = [...document.querySelectorAll("button")].find((el) => (el.innerText || "").trim().toLowerCase() === "close" && !ancestorHidden(el) && !el.getAttribute("aria-label"));
    const overlayClose = document.querySelector('button[aria-label="Close project"]');
    const canvases = [...document.querySelectorAll("canvas")].map((c) => ({
      className: String(c.className || ""),
      parent: String(c.parentElement?.className || "").slice(0, 120),
      w: c.clientWidth,
      h: c.clientHeight,
      hidden: ancestorHidden(c),
    }));
    const badTokens = ["foreground/0.03", "foreground/0.04", "foreground/[0.03]", "foreground/[0.04]", "bg-foreground/3", "bg-foreground/4", "foreground/25", "background/60", "bg-background/60"];
    const leftovers = [...document.querySelectorAll("*")].flatMap((el) => {
      const cls = String(el.className || "");
      if (!cls || typeof cls !== "string") return [];
      const hit = badTokens.filter((t) => cls.includes(t));
      if (!hit.length) return [];
      return [{
        hit,
        className: cls.slice(0, 220),
        tag: el.tagName,
        text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
        hidden: ancestorHidden(el),
      }];
    }).slice(0, 30);
    let snow = null;
    const particle = (root || document).querySelector?.(".theme-sky__particles") || document.querySelector(".theme-backdrop:not([hidden]) .theme-sky__particles");
    const canvas = [...document.querySelectorAll(".theme-sky__particles")].find((c) => !ancestorHidden(c));
    if (canvas) {
      try {
        const ctx = canvas.getContext("2d");
        const cssW = canvas.clientWidth || 1;
        const cssH = canvas.clientHeight || 1;
        const sx = canvas.width / cssW;
        const sy = canvas.height / cssH;
        const sample = (x0, y0, x1, y1) => {
          const rx = Math.max(0, Math.floor(x0 * sx));
          const ry = Math.max(0, Math.floor(y0 * sy));
          const rw = Math.max(1, Math.min(canvas.width - rx, Math.floor((x1 - x0) * sx)));
          const rh = Math.max(1, Math.min(canvas.height - ry, Math.floor((y1 - y0) * sy)));
          const data = ctx.getImageData(rx, ry, rw, rh).data;
          let white = 0, ink = 0, n = 0;
          for (let i = 0; i < data.length; i += 16) {
            n++;
            if (data[i + 3] > 12) ink++;
            if (data[i] > 210 && data[i + 1] > 210 && data[i + 2] > 210 && data[i + 3] > 18) white++;
          }
          return { white, ink, n };
        };
        const colW = Math.min(720, cssW * 0.78);
        const left = (cssW - colW) / 2;
        snow = {
          typeColumn: sample(left + 8, cssH * 0.12, left + colW - 8, cssH * 0.8),
          picker: sample(0, 0, Math.min(240, cssW), Math.min(76, cssH)),
          nav: sample(cssW * 0.25, Math.max(0, cssH - 120), cssW * 0.75, cssH - 4),
        };
      } catch (err) {
        snow = { error: String(err) };
      }
    }
    const contactItems = [...document.querySelectorAll("[data-contact-item]")].slice(0, 8).map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 70),
        opacity: parseFloat(cs.opacity),
        visibility: cs.visibility,
        color: cs.color,
        hidden: ancestorHidden(el),
      };
    });
    const portrait = document.querySelector(".portrait-mark__frame");
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      vw: window.innerWidth,
      vh: window.innerHeight,
      background: cssVars.getPropertyValue("--background").trim(),
      foreground: cssVars.getPropertyValue("--foreground").trim(),
      backs,
      field: field ? { ...info(field), hidden: ancestorHidden(field) } : null,
      h1: h1 ? { text: (h1.innerText || "").replace(/\s+/g, " ").trim(), color: getComputedStyle(h1).color, opacity: getComputedStyle(h1).opacity, rect: rectOf(h1) } : null,
      scrim: info(q(".theme-sky__scrim")),
      grain: info(q(".theme-sky__grain")),
      light: info(q(".theme-sky__light")),
      shore: info(q(".theme-sky__shore")),
      haze: info(q(".theme-sky__haze")),
      particles: !!canvas,
      snow,
      centered: centered.slice(0, 25),
      plates: {
        skill: plateOf(skill, "skill chips"),
        social: plateOf(social, "social pills"),
        toggle: plateOf(toggle && !ancestorHidden(toggle) ? toggle : null, "Projects toggle"),
        picker: plateOf(picker && !ancestorHidden(picker) ? picker : null, "theme picker"),
        nav: plateOf(nav && !ancestorHidden(nav) ? nav : null, "bottom nav"),
        expCard: plateOf(expCard, "experience card"),
        contactCard: plateOf(contactCard, "contact card"),
        gridCard: plateOf(gridCard && !ancestorHidden(gridCard) ? gridCard : null, "grid card"),
        listRow: plateOf(listRow && !ancestorHidden(listRow) ? listRow : null, "list row"),
        zoomClose: plateOf(zoomClose || null, "overlay zoom Close"),
        overlayClose: plateOf(overlayClose && !ancestorHidden(overlayClose) ? overlayClose : null, "overlay Close project"),
      },
      leftovers,
      contactItems,
      canvases,
      portrait: portrait && !ancestorHidden(portrait) ? rectOf(portrait) : null,
      surfaces: {
        home: !!homeBd,
        projects: !!projectsBd,
        contact: !!contactBd,
        overlay: !!overlayBd,
      },
      homeMask: homeBd ? getComputedStyle(homeBd).webkitMaskImage || getComputedStyle(homeBd).maskImage : null,
      photoHits: visibleBack.flatMap((bd) => {
        const imgs = [...bd.querySelectorAll("img")].map((i) => i.getAttribute("src") || "");
        const bgs = [...bd.querySelectorAll("*")].map((el) => getComputedStyle(el).backgroundImage).filter((v) => v && v !== "none");
        return [...imgs, ...bgs].filter((v) => /\.(jpe?g|png|webp|avif)/i.test(v));
      }),
    };
  };
}

async function snap(page) {
  return page.evaluate(snapExpr());
}

async function sampleTypePixels(page) {
  const box = await page.evaluate(() => {
    const hidden = (el) => {
      let n = el;
      while (n) {
        const cs = getComputedStyle(n);
        if (parseFloat(cs.opacity) === 0 || cs.visibility === "hidden" || cs.display === "none") return true;
        n = n.parentElement;
      }
      return false;
    };
    const h1 = [...document.querySelectorAll("h1")].find((el) => !hidden(el));
    if (!h1) return null;
    const nodes = [h1, ...h1.querySelectorAll("*")];
    nodes.forEach((el) => { el.style.color = "transparent"; });
    const r = h1.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, color: getComputedStyle(h1).color };
  });
  if (!box) return null;
  const buf = await page.screenshot({ type: "png" });
  await page.evaluate(() => {
    document.querySelectorAll("h1, h1 *").forEach((el) => { el.style.color = ""; });
  });
  const img = decodePng(buf);
  const colors = sampleBox(img, box, 3);
  const med = medianColor(colors);
  let white = 0;
  for (const c of colors) if (c.r > 225 && c.g > 225 && c.b > 225) white++;
  return { box, median: med, whiteRatio: colors.length ? white / colors.length : 0, samples: colors.length, h1ColorBeforeClear: box.color };
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const report = {
    overall: "FAIL",
    url: BASE,
    viewportDesktop: "1440x900",
    viewportMobile: "390x844",
    colorScheme: "dark",
    notClearedFromNotes: true,
    myRoad: "not tested",
    source: SOURCE,
    gates: {},
    screenshots: [],
    errors: [],
    raw: {},
  };
  let browser;
  try {
    const ping = await fetch(BASE, { signal: AbortSignal.timeout(8000) });
    report.httpStatus = ping.status;
    if (!ping.ok) throw new Error("HTTP " + ping.status);
  } catch (err) {
    report.overall = "NOT REACHABLE";
    report.errors.push(String(err));
    fs.writeFileSync(path.join(OUT, "theme-recheck.json"), JSON.stringify(report, null, 2));
    console.log("NOT REACHABLE", err);
    return;
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
    await skipSplash(page);

    const shots = {};
    const save = async (name) => {
      const s = await shot(page, name);
      shots[name] = name;
      report.screenshots.push("theme-recheck-shots/" + name);
      return s.buf;
    };

    // NIGHT home
    await goNav(page, "Home");
    await setTheme(page, "Night");
    const night = await snap(page);
    report.raw.nightHome = { theme: night.theme, surfaces: night.surfaces, field: night.field, backs: night.backs.map((b) => ({ scene: b.scene, surface: b.surface, hidden: b.hiddenByAncestor, display: b.display })) };

    // CHRISTMAS home
    await setTheme(page, "Christmas");
    const xmas = await snap(page);
    const xmasPixels = await sampleTypePixels(page);
    await save("christmas-home-desktop.png");
    report.raw.christmas = {
      theme: xmas.theme,
      surfaces: xmas.surfaces,
      fieldHiddenOrAbsent: !xmas.field || xmas.field.hidden,
      scrim: xmas.scrim,
      grain: xmas.grain,
      snow: xmas.snow,
      h1: xmas.h1,
      pixels: xmasPixels,
      photoHits: xmas.photoHits,
      centered: xmas.centered,
      light: xmas.light,
      shore: xmas.shore,
    };

    // SUMMER home pixels + horizon hidden
    await setTheme(page, "Summer");
    const summerHome = await snap(page);
    const summerPixels = await sampleTypePixels(page);
    await save("summer-home-desktop.png");
    report.raw.summerHome = {
      light: summerHome.light,
      shore: summerHome.shore,
      scrim: summerHome.scrim,
      grain: summerHome.grain,
      field: summerHome.field ? { hidden: summerHome.field.hidden, display: summerHome.field.display } : null,
      surfaces: summerHome.surfaces,
      h1: summerHome.h1,
      pixels: summerPixels,
      centered: summerHome.centered,
      photoHits: summerHome.photoHits,
    };

    // SPRING home
    await setTheme(page, "Spring");
    const springHome = await snap(page);
    const springPixels = await sampleTypePixels(page);
    await save("spring-home-desktop.png");
    report.raw.springHome = {
      light: springHome.light,
      shore: springHome.shore,
      scrim: springHome.scrim,
      h1: springHome.h1,
      pixels: springPixels,
      centered: springHome.centered,
      field: springHome.field ? { hidden: springHome.field.hidden } : null,
      surfaces: springHome.surfaces,
    };

    // Projects summer shore + spring glow, grid/list/wall, plates
    await goNav(page, "Projects");
    await setTheme(page, "Summer");
    const summerProjects = await snap(page);
    await save("summer-projects-shore.png");
    await setTheme(page, "Spring");
    const springProjects = await snap(page);
    report.raw.projectsHorizon = {
      summer: { shore: summerProjects.shore, light: summerProjects.light, surfaces: summerProjects.surfaces, scrim: summerProjects.scrim },
      spring: { light: springProjects.light, shore: springProjects.shore, centered: springProjects.centered },
    };

    // wall is likely default
    const exploreBtn = page.getByRole("button", { name: "Explore view" });
    if (await exploreBtn.count()) await exploreBtn.click();
    await page.waitForTimeout(500);
    const wallSnap = await snap(page);
    await save("projects-wall.png");
    report.raw.wall = { canvases: wallSnap.canvases, surfaces: wallSnap.surfaces, leftovers: wallSnap.leftovers };

    const gridBtn = page.getByRole("button", { name: "Grid view" });
    if (await gridBtn.count()) await gridBtn.click();
    await page.waitForTimeout(400);
    const gridSnap = await snap(page);
    report.raw.grid = { surfaces: gridSnap.surfaces, plates: gridSnap.plates, backs: gridSnap.backs.filter((b) => !b.hiddenByAncestor).map((b) => b.surface) };

    const listBtn = page.getByRole("button", { name: "List view" });
    if (await listBtn.count()) await listBtn.click();
    await page.waitForTimeout(400);
    const listSnap = await snap(page);
    report.raw.list = { surfaces: listSnap.surfaces, plates: listSnap.plates };

    // open first grid project for overlay + zoom
    if (await gridBtn.count()) await gridBtn.click();
    await page.waitForTimeout(300);
    const projectBtn = page.locator("[data-grid-item] button").first();
    if (await projectBtn.count()) await projectBtn.click();
    await page.waitForFunction(() => {
      const b = document.querySelector('button[aria-label="Close project"]');
      if (!b) return false;
      const root = b.closest('[role="dialog"]');
      return root && parseFloat(getComputedStyle(root).opacity) > 0.9;
    }, null, { timeout: 12000 }).catch((e) => report.errors.push("overlay wait: " + e.message));
    const overlaySnap = await snap(page);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((el) => /^Enlarge /.test(el.getAttribute("aria-label") || ""));
      const scroller = btn?.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');
      if (scroller) scroller.scrollTop = Math.max(scroller.scrollHeight * 0.45, 700);
      btn?.scrollIntoView({ block: "center" });
    });
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll("button")].find((el) => /^Enlarge /.test(el.getAttribute("aria-label") || ""));
      return b && parseFloat(getComputedStyle(b).opacity) >= 0.95;
    }, null, { timeout: 8000 }).catch((e) => report.errors.push("enlarge wait: " + e.message));
    const enlarge = page.locator('button[aria-label^="Enlarge "]').first();
    if (await enlarge.count()) {
      await enlarge.scrollIntoViewIfNeeded().catch(() => {});
      await enlarge.click({ force: true });
      await page.waitForTimeout(500);
    }
    const zoomSnap = await snap(page);
    await save("overlay-zoom-close.png");
    report.raw.overlay = {
      surfaces: overlaySnap.surfaces,
      zoomPlates: zoomSnap.plates,
      h1: overlaySnap.h1,
      backs: zoomSnap.backs.filter((b) => !b.hiddenByAncestor).map((b) => ({ surface: b.surface, scene: b.scene })),
    };

    // close zoom and overlay, go contact + home plates
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await goNav(page, "Contact");
    await setTheme(page, "Summer");
    const contact = await snap(page);
    report.raw.contact = { surfaces: contact.surfaces, contactItems: contact.contactItems, plates: contact.plates, h1: contact.h1 };

    await goNav(page, "Home");
    await page.evaluate(() => {
      const chip = [...document.querySelectorAll("span,a,div")].find((el) => /tracking-\[0\.08em\]/.test(el.className || "") && /rounded-full/.test(el.className || ""));
      chip?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(200);
    const homePlates = await snap(page);
    report.raw.homePlates = homePlates.plates;
    report.raw.leftovers = homePlates.leftovers;

    // autumn replace check quickly
    await setTheme(page, "Autumn");
    const autumn = await snap(page);
    report.raw.autumnHome = { surfaces: autumn.surfaces, fieldHidden: !autumn.field || autumn.field.hidden, scene: autumn.backs.filter((b) => !b.hiddenByAncestor).map((b) => b.scene) };

    // MOBILE
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, "Summer");
    await goNav(page, "Home");
    await page.waitForTimeout(300);
    const mobileSummer = await snap(page);
    await save("mobile-home-summer.png");
    await setTheme(page, "Spring");
    const mobileSpring = await snap(page);
    await save("mobile-home-spring.png");
    report.raw.mobile = {
      summer: { homeMask: mobileSummer.homeMask, light: mobileSummer.light, shore: mobileSummer.shore, portrait: mobileSummer.portrait, surfaces: mobileSummer.surfaces, vw: mobileSummer.vw },
      spring: { homeMask: mobileSpring.homeMask, light: mobileSpring.light, portrait: mobileSpring.portrait },
    };

    // REDUCED MOTION contact
    const rm = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const rp = await rm.newPage();
    await rp.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
    await skipSplash(rp);
    await rp.locator('button[aria-haspopup="listbox"]').first().click();
    await rp.locator('[role="option"]').filter({ hasText: /^Summer$/ }).first().click();
    await rp.waitForTimeout(300);
    await rp.evaluate(() => {
      window.__contactLog = [];
      const loop = () => {
        const items = [...document.querySelectorAll("[data-contact-item]")].filter((el) => {
          let n = el;
          while (n) {
            if (parseFloat(getComputedStyle(n).opacity) === 0) return false;
            n = n.parentElement;
          }
          return true;
        });
        if (items.length) {
          window.__contactLog.push(items.slice(0, 5).map((el) => ({
            t: Math.round(performance.now()),
            op: parseFloat(getComputedStyle(el).opacity),
            vis: getComputedStyle(el).visibility,
            text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
          })));
        }
        if ((window.__contactLog[0] ? performance.now() - window.__contactLog[0][0].t : 0) < 1200) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await rp.locator('nav[aria-label="Primary"]').getByRole("button", { name: "Contact", exact: true }).click();
    await rp.waitForTimeout(900);
    const rmLog = await rp.evaluate(() => window.__contactLog || []);
    const rmSnap = await rp.evaluate(snapExpr());
    report.raw.reducedMotionContact = {
      matchMedia: await rp.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
      log: rmLog.slice(0, 8),
      items: rmSnap.contactItems,
      minOpacity: rmLog.flat().reduce((m, row) => Math.min(m, row.op), 1),
    };
    await rm.close();

    // normal-motion contact first frames
    await page.setViewportSize({ width: 1440, height: 900 });
    await goNav(page, "Home");
    await page.evaluate(() => {
      window.__contactLog = [];
      let started = 0;
      const loop = () => {
        const items = [...document.querySelectorAll("[data-contact-item]")].filter((el) => {
          let n = el;
          while (n) {
            if (parseFloat(getComputedStyle(n).opacity) === 0) return false;
            n = n.parentElement;
          }
          return true;
        });
        if (items.length) {
          if (!started) started = performance.now();
          window.__contactLog.push(items.slice(0, 4).map((el) => parseFloat(getComputedStyle(el).opacity)));
        }
        if (!started || performance.now() - started < 1000) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await goNav(page, "Contact");
    await page.waitForTimeout(700);
    const liveLog = await page.evaluate(() => window.__contactLog || []);
    report.raw.contactFirstFrames = {
      frames: liveLog.length,
      min: liveLog.flat().reduce((m, v) => Math.min(m, v), 1),
      first: liveLog[0] || null,
    };

    // ---------- score ----------
    const g = {};
    const fail = (id, detail, extra) => { g[id] = { status: "FAIL", detail, ...extra }; };
    const pass = (id, detail, extra) => { g[id] = { status: "PASS", detail, ...extra }; };

    // Gate 1 christmas type on #6d1024, snow not in column/picker/nav
    {
      const target = { r: 109, g: 16, b: 36 };
      const med = xmasPixels?.median;
      const d = med ? dist(med, target) : 999;
      const snow = xmas.snow || {};
      const colWhite = snow.typeColumn?.white ?? null;
      const pickerWhite = snow.picker?.white ?? null;
      const navWhite = snow.nav?.white ?? null;
      const snowOk = colWhite === 0 && pickerWhite === 0 && navWhite === 0;
      const colorOk = med && d <= 48 && (xmasPixels.whiteRatio || 0) < 0.02;
      const detail = `h1-behind median rgb(${med?.r},${med?.g},${med?.b}) distance to #6d1024=${d.toFixed(1)} whiteRatio=${(xmasPixels?.whiteRatio ?? 0).toFixed(3)}; canvas white counts column/picker/nav=${colWhite}/${pickerWhite}/${navWhite}`;
      if (colorOk && snowOk) pass("1_christmas_scrim_snow", detail, { median: med, snow });
      else fail("1_christmas_scrim_snow", detail, { median: med, snow, colorOk, snowOk });
    }

    // Gate 2 contact
    {
      const minLive = report.raw.contactFirstFrames.min;
      const minRm = report.raw.reducedMotionContact.minOpacity;
      const items = (contact.contactItems || []).filter((i) => !i.hidden);
      const itemMin = items.reduce((m, i) => Math.min(m, i.opacity), 1);
      const sawLive = (report.raw.contactFirstFrames.frames || 0) > 0;
      const sawRm = (report.raw.reducedMotionContact.log || []).length > 0 && items.length > 0;
      const ok = sawLive && sawRm && minLive >= 0.95 && minRm >= 0.95 && itemMin >= 0.95;
      const detail = `first-frame min opacity ${minLive}; reduced-motion min ${minRm} (matchMedia ${report.raw.reducedMotionContact.matchMedia}); settled visible items min ${itemMin}. Motion is y-only in source; scene does not fade the copy.`;
      if (ok) pass("2_contact_before_gsap", detail);
      else fail("2_contact_before_gsap", detail, { items });
    }

    // Gate 3 scrim
    {
      const s = xmas.scrim;
      const w = parseFloat(s?.width || "0");
      const top = parseFloat(s?.top || "0");
      const h = parseFloat(s?.height || "0");
      const bg = s?.backgroundImage || "";
      const has92 = /92%/.test(bg) || /0\.92/.test(bg);
      const has82 = /82%/.test(bg) || /0\.82/.test(bg);
      const geomOk = Math.abs(w - 720) <= 8 && Math.abs(top - 90) <= 8 && Math.abs(h - 648) <= 12;
      const detail = `computed width ${s?.width} top ${s?.top} height ${s?.height} left ${s?.left}; backgroundImage ${String(bg).slice(0, 280)}`;
      if (s && geomOk && (has92 && has82 || /color-mix/.test(bg))) pass("3_scrim", detail, { width: w, top, height: h });
      else fail("3_scrim", detail + ` geomOk=${geomOk} has92=${has92} has82=${has82}`);
    }

    // Gate 4 plates
    {
      const themeBg = hexToRgb(homePlates.background || summerHome.background || "#000");
      const themeFg = hexToRgb(homePlates.foreground || "#fff");
      const judge = (plate) => {
        if (!plate?.found) return { ...plate, pass: false, reason: "not found" };
        const c = parseCssColor(plate.backgroundColor);
        if (!c || c.a == null) return { ...plate, pass: false, reason: "unparsed " + plate.backgroundColor };
        const themeClass = /bg-background\/\[0\.88\]|bg-background\/88/.test(plate.className || "");
        const faint = /bg-foreground\/(0\.03|0\.04|\[0\.03\]|\[0\.04\]|3\b|4\b|25)|bg-background\/60|background\/60/.test(plate.className || "");
        let nearBg = themeClass && !faint;
        if (c.r != null) nearBg = dist(c, themeBg) + 8 < dist(c, themeFg);
        const ok = c.a >= 0.875 && nearBg && !faint;
        return { ...plate, parsed: c, pass: ok, nearBg, alpha: c.a };
      };
      // collect best measurement per control from the snaps where they exist
      const pool = [homePlates.plates, contact.plates, gridSnap.plates, listSnap.plates, zoomSnap.plates, summerHome.plates];
      const pickPlate = (key) => {
        for (const p of pool) if (p && p[key] && p[key].found) return p[key];
        return { name: key, found: false };
      };
      const controls = {
        skillChips: judge(pickPlate("skill")),
        socialPills: judge(pickPlate("social")),
        projectsToggle: judge(pickPlate("toggle")),
        zoomClose: judge(pickPlate("zoomClose")),
        experienceCard: judge(pickPlate("expCard")),
        contactCard: judge(pickPlate("contactCard")),
        gridCard: judge(pickPlate("gridCard")),
        listRow: judge(pickPlate("listRow")),
        themePicker: judge(pickPlate("picker")),
        bottomNav: judge(pickPlate("nav")),
      };
      const wallCanvas = (wallSnap.canvases || []).some((c) => !c.hidden && !/theme-sky__particles/.test(c.className) && c.w > 100);
      controls.wallTiles = {
        found: wallCanvas,
        pass: wallCanvas,
        reason: wallCanvas
          ? "WebGL canvas present. No CSS background on the mesh. Source footer fill is opaque theme background (SphereGallery.tsx:344-350), which is alpha 1 >= 0.88. Screenshot projects-wall.png."
          : "No WebGL wall canvas found",
        canvases: wallSnap.canvases,
      };
      const namedBad = (report.raw.leftovers || []).filter((row) => !row.hidden);
      const detail = Object.entries(controls).map(([k, v]) => `${k}:${v.pass ? "PASS" : "FAIL"} ${v.backgroundColor || v.reason || ""} a=${v.alpha ?? "?"}`).join(" | ");
      const allOk = Object.values(controls).every((v) => v.pass);
      if (allOk) pass("4_plates", detail, { controls, leftoverClasses: namedBad });
      else fail("4_plates", detail, { controls, leftoverClasses: namedBad });
    }

    // Gate 5 mounts
    {
      const homeOk = summerHome.surfaces.home && springHome.surfaces.home && xmas.surfaces.home;
      const gridOk = gridSnap.surfaces.projects;
      const listOk = listSnap.surfaces.projects;
      const contactOk = contact.surfaces.contact;
      const overlayOk = overlaySnap.surfaces.overlay || zoomSnap.surfaces.overlay;
      const nightAbsent = !night.surfaces.home;
      const detail = `home non-night ${homeOk}; projects grid ${gridOk}; projects list ${listOk}; contact ${contactOk}; overlay ${overlayOk}; night home backdrop absent ${nightAbsent}`;
      if (homeOk && gridOk && listOk && contactOk && overlayOk) pass("5_themebackdrop_mounts", detail);
      else fail("5_themebackdrop_mounts", detail);
    }

    // Gate 6 night alone / others replace
    {
      const nightField = night.field && !night.field.hidden;
      const nightNoBd = (night.backs || []).filter((b) => !b.hiddenByAncestor).length === 0;
      const xmasNoField = !xmas.field || xmas.field.hidden;
      const summerNoField = !summerHome.field || summerHome.field.hidden;
      const springNoField = !springHome.field || springHome.field.hidden;
      const autumnNoField = report.raw.autumnHome.fieldHidden && report.raw.autumnHome.surfaces.home;
      const detail = `night field ${!!nightField} visible backdrops ${night.backs?.filter((b)=>!b.hiddenByAncestor).length}; christmas/summer/spring/autumn field hidden ${xmasNoField}/${summerNoField}/${springNoField}/${autumnNoField}`;
      if (nightField && nightNoBd && xmasNoField && summerNoField && springNoField && autumnNoField) pass("6_constellation_replace", detail);
      else fail("6_constellation_replace", detail);
    }

    // Gate 7 horizon
    {
      const homeLightNone = summerHome.light?.display === "none" && springHome.light?.display === "none";
      const homeShoreNone = summerHome.shore?.display === "none" && springHome.shore?.display === "none";
      const glow = springProjects.light;
      const glowW = parseFloat(glow?.width || "0");
      const glowLeft = glow?.left;
      const glowOk = glow && glow.display !== "none" && (glowLeft === "0px" || glowLeft === "0%") && Math.abs(glowW - 200) <= 8;
      const shore = summerProjects.shore;
      const mask = shore?.maskImage || "";
      const maskOk = /12%/.test(mask) && /88%/.test(mask) && shore?.display === "block";
      const mobileMask = (report.raw.mobile.summer.homeMask || "") + (report.raw.mobile.spring.homeMask || "");
      const mobileOk = /64svh|64vh/.test(mobileMask) || /transparent/.test(mobileMask);
      const centeredNonScrim = (springHome.centered || []).filter((el) => !/theme-sky__scrim/.test(el.className));
      const detail = `home light/shore display summer ${summerHome.light?.display}/${summerHome.shore?.display} spring ${springHome.light?.display}/${springHome.shore?.display}; projects spring glow left ${glowLeft} width ${glow?.width} display ${glow?.display}; summer shore display ${shore?.display} mask ${String(mask).slice(0, 180)}; mobile mask ${String(report.raw.mobile.summer.homeMask).slice(0, 160)}; centered non-scrim ${JSON.stringify(centeredNonScrim).slice(0, 400)}`;
      if (homeLightNone && homeShoreNone && glowOk && maskOk && mobileOk) pass("7_horizon", detail, { centeredNonScrim });
      else fail("7_horizon", detail, { glowOk, maskOk, mobileOk, homeLightNone, homeShoreNone, centeredNonScrim });
    }

    // Gate 8 grain + photos
    {
      const op = parseFloat(xmas.grain?.opacity || "0");
      const behind = true; // DOM order checked in source; live z-index both auto, scrim is later sibling if grain index < scrim
      const grainIdxNote = { grainZ: xmas.grain?.zIndex, scrimZ: xmas.scrim?.zIndex, grainOpacity: op };
      const photos = [...new Set([...(xmas.photoHits || []), ...(summerHome.photoHits || [])])];
      const opOk = op >= 0.04 && op <= 0.08;
      const detail = `grain opacity ${op} (want 0.04-0.08), z ${xmas.grain?.zIndex} vs scrim z ${xmas.scrim?.zIndex}; photo urls in backdrop ${JSON.stringify(photos)}`;
      if (opOk && photos.length === 0) pass("8_grain_photos", detail, grainIdxNote);
      else fail("8_grain_photos", detail, { photos, ...grainIdxNote, behind });
    }

    // summer/spring pixel record (not its own gate)
    const recordPixels = (label, snapH, pixels) => {
      const fg = parseCssColor(snapH.h1?.color || "");
      const med = pixels?.median;
      return {
        label,
        h1Color: snapH.h1?.color,
        h1Opacity: snapH.h1?.opacity,
        behindMedian: med,
        contrast: fg && med && fg.r != null ? Number(contrast(fg, med).toFixed(2)) : null,
        whiteRatio: pixels?.whiteRatio,
      };
    };
    report.summerSpringPixels = {
      summer: recordPixels("summer", summerHome, summerPixels),
      spring: recordPixels("spring", springHome, springPixels),
      screenshots: ["theme-recheck-shots/summer-home-desktop.png", "theme-recheck-shots/spring-home-desktop.png", "theme-recheck-shots/mobile-home-summer.png", "theme-recheck-shots/mobile-home-spring.png"],
    };

    report.gates = g;
    const statuses = Object.values(g).map((x) => x.status);
    report.overall = statuses.length === 8 && statuses.every((s) => s === "PASS") ? "CLEAR" : "FAIL";
    report.gateSummary = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.status]));
  } catch (err) {
    report.errors.push(String(err && err.stack || err));
    report.overall = report.overall === "NOT REACHABLE" ? report.overall : "FAIL";
  } finally {
    fs.writeFileSync(path.join(OUT, "theme-recheck.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ overall: report.overall, summary: report.gateSummary, errors: report.errors }, null, 2));
    if (browser) await browser.close();
  }
}

main();
