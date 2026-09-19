import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:3000';
const results = [];

function record(id, severity, title, status, detail, evidence) {
  results.push({ id, severity, title, status, detail, evidence });
  console.log(`[${status}] ${id} ${title}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  const p = path.join(OUT, `ac-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function skipIn(page) {
  try {
    await page.getByRole('button', { name: /skip introduction/i }).waitFor({ timeout: 4000 });
    await page.keyboard.press('Escape');
  } catch {}
  await page.waitForFunction(() => {
    const n = document.querySelector('nav[aria-label="Primary"]');
    return n && getComputedStyle(n).opacity !== '0';
  }, null, { timeout: 15000 });
}

function fieldSnapshot() {
  const root = document.querySelector('.ac-home-field');
  const svg = root?.querySelector('svg');
  const lines = svg ? svg.querySelectorAll('line').length : 0;
  const nodes = svg ? svg.querySelectorAll('circle').length : 0;
  const rs = root ? getComputedStyle(root) : null;
  const edges = [...document.querySelectorAll('.ac-home-field__edge')].slice(0, 3).map((el) => getComputedStyle(el).animationName);
  const h1 = document.querySelector('h1');
  const body = [...document.querySelectorAll('[data-home-item] p')].find((p) => (p.textContent || '').length > 40);
  return {
    field: !!root,
    svg: !!svg,
    lines,
    nodes,
    fieldOp: rs ? rs.opacity : null,
    fieldVis: rs ? rs.visibility : null,
    fieldZ: rs ? rs.zIndex : null,
    edgeAnim: edges,
    h1: h1 ? h1.innerText.replace(/\s+/g, ' ').trim() : null,
    h1Color: h1 ? getComputedStyle(h1).color : null,
    h1Op: h1 ? getComputedStyle(h1).opacity : null,
    bodyColor: body ? getComputedStyle(body).color : null,
    bodyOp: body ? getComputedStyle(body).opacity : null,
  };
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

// no-JS
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(400);
  const s = await page.evaluate(fieldSnapshot);
  const ev = await shot(page, '01-nojs');
  const present = s.field && s.svg && s.lines >= 10 && s.fieldOp !== '0' && s.fieldVis !== 'hidden';
  const faded = s.fieldOp !== null && parseFloat(s.fieldOp) < 0.4;
  record('AC1', 'blocker', 'AC Field present without JS / no fade-to-gone',
    present && !faded ? 'PASS' : 'FAIL',
    JSON.stringify(s), ev);
  await ctx.close();
}

// JS + contrast
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await skipIn(page);
  await page.waitForTimeout(500);
  const s = await page.evaluate(fieldSnapshot);
  const ev = await shot(page, '02-home');
  const present = s.field && s.lines >= 10 && s.fieldOp !== '0';
  record('AC2', 'blocker', 'AC Field present behind Home after splash',
    present ? 'PASS' : 'FAIL', JSON.stringify(s), ev);

  const readable = /Hi! I'm Mateo/i.test(s.h1 || '') && parseFloat(s.h1Op || '0') > 0.9;
  const colorLooksWhite = /oklab\(0\.9|rgb\(\s*24[0-9]|255/.test(s.h1Color || '');
  record('AC3', 'blocker', 'Home contrast does not drop with field (type stays solid)',
    readable && colorLooksWhite ? 'PASS' : 'FAIL',
    `h1=${s.h1} color=${s.h1Color} op=${s.h1Op} body=${s.bodyColor}`, ev);
  await ctx.close();
}

// PRM static
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await skipIn(page); } catch {}
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => {
    const root = document.querySelector('.ac-home-field');
    const lines = root ? root.querySelectorAll('line').length : 0;
    const edgeAnims = [...document.querySelectorAll('.ac-home-field__edge')].slice(0, 4).map((el) => getComputedStyle(el).animationName);
    const nodeAnims = [...document.querySelectorAll('.ac-home-field__node')].slice(0, 4).map((el) => getComputedStyle(el).animationName);
    const none = (v) => !v || v === 'none';
    return {
      field: !!root,
      lines,
      edgeAnims,
      nodeAnims,
      staticGraph: edgeAnims.every(none) && nodeAnims.every(none),
    };
  });
  const ev = await shot(page, '03-prm');
  record('AC4', 'blocker', 'PRM shows static AC graph (no deploy/drift)',
    s.field && s.lines >= 10 && s.staticGraph ? 'PASS' : 'FAIL',
    JSON.stringify(s), ev);
  await ctx.close();
}

await browser.close();
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
const summary = {
  title: 'AC Field smoke — Windows WIP',
  timestamp_utc: new Date().toISOString(),
  overall: fail === 0 ? 'CLEAR' : 'FAIL',
  pass,
  fail,
  results,
};
fs.writeFileSync(path.join(OUT, 'ac-field-smoke.json'), JSON.stringify(summary, null, 2));
console.log('\nOVERALL', summary.overall, { pass, fail });
if (fail) process.exitCode = 1;
