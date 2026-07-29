"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { portfolioOwner } from "@/content/portfolio";

type SpaceFieldProps = {
  splashRootRef: RefObject<HTMLElement | null>;
  homeRootRef: RefObject<HTMLElement | null>;
  playIntro: boolean;
  active: boolean;
  /** Home content + nav can appear while particles finish assembling. */
  onHandoff: () => void;
  /** Splash UI can unmount; particle field is now in home drift mode. */
  onIntroComplete: () => void;
};

const COUNT_DESKTOP = 4800;
const COUNT_MOBILE = 2200;
const FIELD_DEPTH = 260;
const FIELD_SPREAD_X = 58;
const FIELD_SPREAD_Y = 36;
const DRIFT_RIGHT = 0.0065;
const DRIFT_TOWARD = 0.0035;

function getCount() {
  return window.innerWidth < 768 ? COUNT_MOBILE : COUNT_DESKTOP;
}

function createTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Texture();
  }
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.7)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.15)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function fillCloud(target: Float32Array, count: number, spread: number) {
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    target[i3] = (Math.random() - 0.5) * spread;
    target[i3 + 1] = (Math.random() - 0.5) * spread;
    target[i3 + 2] = (Math.random() - 0.5) * spread;
  }
}

function fillSphere(target: Float32Array, count: number, radius: number) {
  for (let i = 0; i < count; i += 1) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    // Thin shell — avoids a solid glowing orb
    const r = radius * (0.92 + Math.random() * 0.12);
    const i3 = i * 3;
    target[i3] = r * Math.sin(phi) * Math.cos(theta);
    target[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    target[i3 + 2] = r * Math.cos(phi);
  }
}

function fillRing(target: Float32Array, count: number, radius: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const wobble = (Math.random() - 0.5) * 0.35;
    const r = radius + (Math.random() - 0.5) * 0.45;
    const i3 = i * 3;
    target[i3] = Math.cos(angle) * r;
    target[i3 + 1] = wobble;
    target[i3 + 2] = Math.sin(angle) * r;
  }
}

function fillHomeField(
  target: Float32Array,
  colors: Float32Array,
  count: number
) {
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const depthT = Math.random();
    target[i3] = (Math.random() - 0.5) * FIELD_SPREAD_X * 2;
    target[i3 + 1] = (Math.random() - 0.5) * FIELD_SPREAD_Y * 2;
    target[i3 + 2] = -8 - depthT * FIELD_DEPTH;

    // Brighter field — far stars stay luminous, near stars near white
    const shade = 0.78 + depthT * 0.28 + Math.random() * 0.1;
    const cool = Math.random() > 0.92;
    colors[i3] = cool ? shade * 0.94 : shade;
    colors[i3 + 1] = cool ? shade * 0.96 : shade;
    colors[i3 + 2] = Math.min(1, shade);
  }
}

function placeHomeStar(
  positions: Float32Array,
  colors: Float32Array,
  index: number
) {
  const i3 = index * 3;
  const depthT = Math.random();
  positions[i3] = -FIELD_SPREAD_X * (0.95 + Math.random() * 0.55);
  positions[i3 + 1] = (Math.random() - 0.5) * FIELD_SPREAD_Y * 2;
  positions[i3 + 2] = -8 - depthT * FIELD_DEPTH;
  const shade = 0.78 + depthT * 0.28 + Math.random() * 0.1;
  const cool = Math.random() > 0.92;
  colors[i3] = cool ? shade * 0.94 : shade;
  colors[i3 + 1] = cool ? shade * 0.96 : shade;
  colors[i3 + 2] = Math.min(1, shade);
}

function paintVignette(canvas: HTMLCanvasElement, lightweight: boolean) {
  const width = Math.max(1, Math.round(window.innerWidth));
  const height = Math.max(1, Math.round(window.innerHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, lightweight ? 1 : 1.5);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const cx = width * 0.5;
  const cy = height * 0.48;
  const radius = Math.max(width, height) * 0.78;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.4, "rgba(0,0,0,0.14)");
  gradient.addColorStop(0.7, "rgba(0,0,0,0.5)");
  gradient.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function screenToWorld(
  sx: number,
  sy: number,
  camera: THREE.PerspectiveCamera,
  planeZ: number
) {
  const ndcX = (sx / window.innerWidth) * 2 - 1;
  const ndcY = -(sy / window.innerHeight) * 2 + 1;
  const origin = camera.position.clone();
  const unproj = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const dir = unproj.sub(origin).normalize();
  const t = (planeZ - origin.z) / dir.z;
  return origin.add(dir.multiplyScalar(t));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

type Sample = { x: number; y: number; r: number; g: number; b: number };

async function samplePortraitPixels(
  src: string,
  maxSamples: number
): Promise<Sample[]> {
  try {
    const img = await loadImage(src);
    const w = 96;
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = Math.max(1, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return [];
    }
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const samples: Sample[] = [];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const a = data[i + 3];
        if (a < 40) {
          continue;
        }
        // Bias toward brighter / more saturated pixels so the form reads
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = (r + g + b) / 3;
        if (luma < 18 && Math.random() > 0.15) {
          continue;
        }
        samples.push({
          x: x / (w - 1),
          y: y / (h - 1),
          r: r / 255,
          g: g / 255,
          b: b / 255,
        });
      }
    }
    if (samples.length <= maxSamples) {
      return samples;
    }
    // Fisher-Yates downsample
    for (let i = samples.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = samples[i];
      samples[i] = samples[j];
      samples[j] = tmp;
    }
    return samples.slice(0, maxSamples);
  } catch {
    return [];
  }
}

function buildAssembleFromLayout(
  homeRoot: HTMLElement | null,
  portraitSamples: Sample[],
  count: number,
  camera: THREE.PerspectiveCamera,
  assemblePos: Float32Array,
  assembleColors: Float32Array,
  splashColors: Float32Array,
  delays: Float32Array,
  scatterPos: Float32Array,
  formedScratch: Float32Array
) {
  const planeZ = -1.2;
  const items = homeRoot
    ? Array.from(homeRoot.querySelectorAll<HTMLElement>("[data-home-item]"))
    : [];
  const rects = items
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 8 && r.height > 8);

  const portraitRect = rects[0] ?? null;
  const otherRects = rects.slice(1);
  const portraitCount = Math.floor(count * (portraitRect ? 0.58 : 0.35));

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    let sx: number;
    let sy: number;
    let cr: number;
    let cg: number;
    let cb: number;

    if (i < portraitCount && portraitRect) {
      const sample =
        portraitSamples.length > 0
          ? portraitSamples[i % portraitSamples.length]
          : null;
      const u = sample ? sample.x : Math.random();
      const v = sample ? sample.y : Math.random();
      sx = portraitRect.left + u * portraitRect.width;
      sy = portraitRect.top + v * portraitRect.height;
      if (sample) {
        cr = sample.r;
        cg = sample.g;
        cb = sample.b;
      } else {
        cr = splashColors[i3];
        cg = splashColors[i3 + 1];
        cb = splashColors[i3 + 2];
      }
    } else if (otherRects.length > 0) {
      const rect = otherRects[i % otherRects.length];
      sx = rect.left + Math.random() * rect.width;
      sy = rect.top + Math.random() * rect.height;
      // Soft UI dust — keep grayscale (no cool/warm tint)
      const shade = 0.78 + Math.random() * 0.22;
      cr = shade;
      cg = shade;
      cb = shade;
    } else {
      // Fallback hero composition if layout isn't measurable yet
      const isLeft = i % 5 < 3;
      sx = isLeft
        ? window.innerWidth * (0.12 + Math.random() * 0.28)
        : window.innerWidth * (0.48 + Math.random() * 0.4);
      sy = isLeft
        ? window.innerHeight * (0.22 + Math.random() * 0.52)
        : window.innerHeight * (0.28 + Math.random() * 0.4);
      cr = splashColors[i3];
      cg = splashColors[i3 + 1];
      cb = splashColors[i3 + 2];
    }

    const world = screenToWorld(sx, sy, camera, planeZ + (Math.random() - 0.5) * 0.35);
    assemblePos[i3] = world.x;
    assemblePos[i3 + 1] = world.y;
    assemblePos[i3 + 2] = world.z;
    assembleColors[i3] = cr;
    assembleColors[i3 + 1] = cg;
    assembleColors[i3 + 2] = cb;

    // Soft reverse-dust wave (left → right), not too staggered
    const wave = portraitRect
      ? THREE.MathUtils.clamp(
          (sx - portraitRect.left) / Math.max(portraitRect.width, 1),
          0,
          1
        )
      : Math.random();
    delays[i] = wave * 0.28 + Math.random() * 0.12;

    // Scatter target: fling outward from formed ring position (dust)
    const fx = formedScratch[i3];
    const fy = formedScratch[i3 + 1];
    const fz = formedScratch[i3 + 2];
    const len = Math.hypot(fx, fy, fz) || 1;
    const fling = 2.2 + Math.random() * 3.8;
    scatterPos[i3] = fx + (fx / len) * fling + (Math.random() - 0.5) * 2.4;
    scatterPos[i3 + 1] =
      fy + (fy / len) * fling * 0.45 + (Math.random() - 0.5) * 1.8;
    scatterPos[i3 + 2] =
      fz + (fz / len) * fling + (Math.random() - 0.5) * 2.8;
  }
}

function formedAtMorph(
  cloud: Float32Array,
  sphere: Float32Array,
  ring: Float32Array,
  morph: number,
  i3: number
) {
  const midX = THREE.MathUtils.lerp(
    sphere[i3],
    ring[i3],
    Math.max(0, morph - 1)
  );
  const midY = THREE.MathUtils.lerp(
    sphere[i3 + 1],
    ring[i3 + 1],
    Math.max(0, morph - 1)
  );
  const midZ = THREE.MathUtils.lerp(
    sphere[i3 + 2],
    ring[i3 + 2],
    Math.max(0, morph - 1)
  );
  return {
    x: THREE.MathUtils.lerp(cloud[i3], midX, Math.min(1, morph)),
    y: THREE.MathUtils.lerp(cloud[i3 + 1], midY, Math.min(1, morph)),
    z: THREE.MathUtils.lerp(cloud[i3 + 2], midZ, Math.min(1, morph)),
  };
}

export function SpaceField({
  splashRootRef,
  homeRootRef,
  playIntro,
  active,
  onHandoff,
  onIntroComplete,
}: SpaceFieldProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const vignetteRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  const playIntroRef = useRef(playIntro);
  const onHandoffRef = useRef(onHandoff);
  const onIntroCompleteRef = useRef(onIntroComplete);
  const phaseRef = useRef<"splash" | "home">(playIntro ? "splash" : "home");

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    playIntroRef.current = playIntro;
  }, [playIntro]);

  useEffect(() => {
    onHandoffRef.current = onHandoff;
  }, [onHandoff]);

  useEffect(() => {
    onIntroCompleteRef.current = onIntroComplete;
  }, [onIntroComplete]);

  useEffect(() => {
    const mount = mountRef.current;
    const vignetteCanvas = vignetteRef.current;
    if (!mount || !vignetteCanvas) {
      return;
    }

    let disposed = false;
    let frame = 0;
    let timeline: gsap.core.Timeline | null = null;
    let failSafe = 0;
    let handedOff = !playIntroRef.current;
    let introFinished = !playIntroRef.current;

    const isMobile = window.innerWidth < 768;
    const count = getCount();
    const speed = isMobile ? 0.88 : 1;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0038);
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      isMobile ? 60 : 55,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      320
    );
    camera.position.set(0, 0, isMobile ? 10.5 : 9.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(
      Math.max(mount.clientWidth, 1),
      Math.max(mount.clientHeight, 1)
    );
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    paintVignette(vignetteCanvas, isMobile);

    const cloud = new Float32Array(count * 3);
    const sphere = new Float32Array(count * 3);
    const ring = new Float32Array(count * 3);
    const scatter = new Float32Array(count * 3);
    const assemble = new Float32Array(count * 3);
    const home = new Float32Array(count * 3);
    const current = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const splashColors = new Float32Array(count * 3);
    const assembleColors = new Float32Array(count * 3);
    const homeColors = new Float32Array(count * 3);
    const delays = new Float32Array(count);
    const formedScratch = new Float32Array(count * 3);

    fillCloud(cloud, count, 18);
    fillSphere(sphere, count, 2.35);
    fillRing(ring, count, 3.1);
    fillHomeField(home, homeColors, count);
    current.set(cloud);

    // Default scatter / assemble until layout is sampled
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const formed = formedAtMorph(cloud, sphere, ring, 2, i3);
      formedScratch[i3] = formed.x;
      formedScratch[i3 + 1] = formed.y;
      formedScratch[i3 + 2] = formed.z;
      const len = Math.hypot(formed.x, formed.y, formed.z) || 1;
      const fling = 2.4 + Math.random() * 3.6;
      scatter[i3] = formed.x + (formed.x / len) * fling;
      scatter[i3 + 1] = formed.y + (formed.y / len) * fling * 0.45;
      scatter[i3 + 2] = formed.z + (formed.z / len) * fling;
      assemble[i3] = (Math.random() - 0.5) * 8;
      assemble[i3 + 1] = (Math.random() - 0.5) * 5;
      assemble[i3 + 2] = -1.2;
      delays[i] = Math.random() * 0.3;
    }

    // Pure grayscale dust — any hue bias + additive stacking becomes color orbs
    for (let i = 0; i < count; i += 1) {
      const shade = 0.7 + Math.random() * 0.3;
      const i3 = i * 3;
      splashColors[i3] = shade;
      splashColors[i3 + 1] = shade;
      splashColors[i3 + 2] = shade;
      assembleColors[i3] = shade;
      assembleColors[i3 + 1] = shade;
      assembleColors[i3 + 2] = shade;
      colors[i3] = shade;
      colors[i3 + 1] = shade;
      colors[i3 + 2] = shade;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(current, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: isMobile ? 0.05 : 0.038,
      map: createTexture(),
      transparent: true,
      depthWrite: false,
      // Normal during splash — Additive on dense forms creates yellow/blue glow balls
      blending: playIntroRef.current
        ? THREE.NormalBlending
        : THREE.AdditiveBlending,
      vertexColors: true,
      opacity: playIntroRef.current ? 0 : 1,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const state = {
      morph: 0,
      scatter: 0,
      assemble: 0,
      dissolve: 0,
      cameraZ: isMobile ? 10.5 : 9.5,
      spin: playIntroRef.current ? 0.22 : 0,
      particleSize: isMobile ? 0.05 : 0.038,
      colorMix: 0,
    };

    if (!playIntroRef.current) {
      current.set(home);
      colors.set(homeColors);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      camera.position.z = 0;
      state.cameraZ = 0;
      state.particleSize = isMobile ? 0.16 : 0.13;
      state.colorMix = 1;
      state.dissolve = 1;
      phaseRef.current = "home";
    }

    const mixSplash = () => {
      const morph = state.morph;
      const scatterT = state.scatter;
      const assembleT = state.assemble;
      const dissolveT = state.dissolve;
      const positions = geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3;
        const formed = formedAtMorph(cloud, sphere, ring, morph, i3);

        // Dust fling
        let x = THREE.MathUtils.lerp(formed.x, scatter[i3], scatterT);
        let y = THREE.MathUtils.lerp(formed.y, scatter[i3 + 1], scatterT);
        let z = THREE.MathUtils.lerp(formed.z, scatter[i3 + 2], scatterT);

        // Reverse snap with per-particle stagger
        const delay = delays[i];
        const localAssemble = THREE.MathUtils.clamp(
          (assembleT - delay) / Math.max(0.001, 1 - delay * 0.85),
          0,
          1
        );
        const snapEase = localAssemble * localAssemble * (3 - 2 * localAssemble);

        x = THREE.MathUtils.lerp(x, assemble[i3], snapEase);
        y = THREE.MathUtils.lerp(y, assemble[i3 + 1], snapEase);
        z = THREE.MathUtils.lerp(z, assemble[i3 + 2], snapEase);

        // Peel into depth starfield after the form locks
        const localDissolve = THREE.MathUtils.clamp(
          (dissolveT - delay * 0.55) / Math.max(0.001, 1 - delay * 0.4),
          0,
          1
        );
        const dissolveEase =
          localDissolve * localDissolve * (3 - 2 * localDissolve);

        positions[i3] = THREE.MathUtils.lerp(x, home[i3], dissolveEase);
        positions[i3 + 1] = THREE.MathUtils.lerp(y, home[i3 + 1], dissolveEase);
        positions[i3 + 2] = THREE.MathUtils.lerp(z, home[i3 + 2], dissolveEase);

        const cAssemble = Math.max(state.colorMix, snapEase);
        const cHome = dissolveEase;
        const sr = splashColors[i3];
        const sg = splashColors[i3 + 1];
        const sb = splashColors[i3 + 2];
        const ar = assembleColors[i3];
        const ag = assembleColors[i3 + 1];
        const ab = assembleColors[i3 + 2];
        const hr = homeColors[i3];
        const hg = homeColors[i3 + 1];
        const hb = homeColors[i3 + 2];

        const mr = THREE.MathUtils.lerp(sr, ar, cAssemble);
        const mg = THREE.MathUtils.lerp(sg, ag, cAssemble);
        const mb = THREE.MathUtils.lerp(sb, ab, cAssemble);

        colors[i3] = THREE.MathUtils.lerp(mr, hr, cHome);
        colors[i3 + 1] = THREE.MathUtils.lerp(mg, hg, cHome);
        colors[i3 + 2] = THREE.MathUtils.lerp(mb, hb, cHome);
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    };

    const driftHome = () => {
      const arr = geometry.attributes.position.array as Float32Array;
      let recycled = false;
      const edgeX = FIELD_SPREAD_X * 1.25;

      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3;
        const depth = Math.abs(arr[i3 + 2]);
        const nearness = 1 - Math.min(1, depth / FIELD_DEPTH);
        const speedScale = 0.35 + nearness * 1.35;
        arr[i3] += DRIFT_RIGHT * speedScale;
        arr[i3 + 2] += DRIFT_TOWARD * speedScale;

        if (arr[i3] > edgeX || arr[i3 + 2] > 1.5) {
          placeHomeStar(arr, colors, i);
          recycled = true;
        }
      }

      geometry.attributes.position.needsUpdate = true;
      if (recycled) {
        geometry.attributes.color.needsUpdate = true;
      }
    };

    const resize = () => {
      const width = Math.max(mount.clientWidth, window.innerWidth, 1);
      const height = Math.max(mount.clientHeight, window.innerHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2)
      );
      renderer.setSize(width, height);
      paintVignette(vignetteCanvas, isMobile);
    };

    const tick = () => {
      if (disposed) {
        return;
      }
      frame = window.requestAnimationFrame(tick);

      if (!activeRef.current && phaseRef.current === "home") {
        return;
      }

      if (phaseRef.current === "splash") {
        const spinScale = Math.max(0, 1 - state.assemble * 1.2);
        points.rotation.y += 0.0028 * state.spin * spinScale;
        points.rotation.x += 0.0009 * state.spin * spinScale;
        if (state.assemble > 0.15) {
          points.rotation.y *= 0.92;
          points.rotation.x *= 0.92;
        }
        camera.position.z = state.cameraZ;
        material.size = state.particleSize;

        // Additive only once particles peel into the starfield
        const wantAdditive = state.dissolve > 0.35;
        const nextBlending = wantAdditive
          ? THREE.AdditiveBlending
          : THREE.NormalBlending;
        if (material.blending !== nextBlending) {
          material.blending = nextBlending;
          material.needsUpdate = true;
        }

        mixSplash();
      } else {
        points.rotation.set(0, 0, 0);
        camera.position.z = 0;
        material.size = isMobile ? 0.16 : 0.13;
        material.opacity = 1;
        if (material.blending !== THREE.AdditiveBlending) {
          material.blending = THREE.AdditiveBlending;
          material.needsUpdate = true;
        }
        driftHome();
      }

      renderer.render(scene, camera);
    };

    const handoff = () => {
      if (handedOff) {
        return;
      }
      handedOff = true;
      onHandoffRef.current();
    };

    const finishIntro = () => {
      if (introFinished) {
        return;
      }
      introFinished = true;
      window.clearTimeout(failSafe);
      phaseRef.current = "home";
      colors.set(homeColors);
      geometry.attributes.color.needsUpdate = true;
      camera.position.z = 0;
      state.spin = 0;
      state.scatter = 1;
      state.assemble = 1;
      state.dissolve = 1;
      state.colorMix = 1;
      handoff();
      onIntroCompleteRef.current();
    };

    const prepareReverseSnap = async () => {
      // Bake current ring positions for scatter origins
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3;
        const formed = formedAtMorph(cloud, sphere, ring, 2, i3);
        formedScratch[i3] = formed.x;
        formedScratch[i3 + 1] = formed.y;
        formedScratch[i3 + 2] = formed.z;
      }

      const portraitSamples = await samplePortraitPixels(
        portfolioOwner.portraitImage,
        Math.floor(count * 0.65)
      );

      if (disposed) {
        return;
      }

      // Camera will ease toward assemble framing — sample with that z
      const sampleCam = camera.clone();
      sampleCam.position.z = isMobile ? 7.2 : 6.4;
      sampleCam.updateMatrixWorld();

      buildAssembleFromLayout(
        homeRootRef.current,
        portraitSamples,
        count,
        sampleCam,
        assemble,
        assembleColors,
        splashColors,
        delays,
        scatter,
        formedScratch
      );
    };

    const startSplash = () => {
      const root = splashRootRef.current;
      if (!root) {
        requestAnimationFrame(startSplash);
        return;
      }

      const kicker = root.querySelector("[data-splash-kicker]");
      const nameLines = root.querySelectorAll("[data-splash-name]");
      const role = root.querySelector("[data-splash-role]");
      const meter = root.querySelector("[data-splash-meter]");
      const center = root.querySelector("[data-splash-center]");
      const progress = root.querySelector("[data-splash-progress]");
      const counter = root.querySelector("[data-splash-counter]");
      const vignette = vignetteCanvas;

      const counterState = { value: 0 };

      gsap.set([kicker, role, meter], { autoAlpha: 0, y: 20 });
      gsap.set(nameLines, { yPercent: 115 });
      if (progress) {
        gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });
      }
      gsap.set(vignette, { autoAlpha: 0 });
      gsap.set(material, { opacity: 0 });
      gsap.set(root, { autoAlpha: 1 });

      failSafe = window.setTimeout(finishIntro, isMobile ? 13000 : 14500);

      // Warm portrait + layout targets early
      void prepareReverseSnap();

      timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      timeline
        .to(vignette, { autoAlpha: 1, duration: 0.55 * speed }, 0)
        .to(material, { opacity: 0.92, duration: 0.85 * speed }, 0.05)
        // Form the orb a bit more slowly…
        .to(
          state,
          { morph: 1, duration: 1.85 * speed, ease: "power2.inOut" },
          0.15
        )
        .to(kicker, { autoAlpha: 1, y: 0, duration: 0.65 * speed }, 0.75 * speed)
        .to(
          nameLines,
          {
            yPercent: 0,
            duration: 1.05 * speed,
            stagger: 0.12,
            ease: "power4.out",
          },
          0.9 * speed
        )
        .to(role, { autoAlpha: 1, y: 0, duration: 0.6 * speed }, 1.3 * speed)
        .to(meter, { autoAlpha: 1, y: 0, duration: 0.55 * speed }, 1.5 * speed)
        .to(
          counterState,
          {
            value: 100,
            duration: 2.0 * speed,
            ease: "power2.inOut",
            onUpdate: () => {
              if (counter) {
                counter.textContent = String(
                  Math.round(counterState.value)
                ).padStart(3, "0");
              }
            },
          },
          1.55 * speed
        );

      if (progress) {
        timeline.to(
          progress,
          { scaleX: 1, duration: 2.0 * speed, ease: "power2.inOut" },
          1.55 * speed
        );
      }

      // …and hold the orb before collapsing into the ring
      timeline
        .to(
          state,
          { morph: 2, duration: 1.15 * speed, ease: "power2.inOut" },
          3.15 * speed
        )
        .to(
          state,
          {
            spin: 0.85,
            particleSize: isMobile ? 0.052 : 0.04,
            duration: 1.15 * speed,
            ease: "power2.inOut",
          },
          3.15 * speed
        )
        .to(
          center,
          {
            autoAlpha: 0,
            y: -16,
            duration: 0.4 * speed,
            ease: "power2.in",
          },
          5.15 * speed
        )
        // Dust snap outward
        .to(
          state,
          {
            scatter: 1,
            spin: 1.35,
            particleSize: isMobile ? 0.036 : 0.028,
            cameraZ: isMobile ? 8.6 : 7.8,
            duration: 0.75 * speed,
            ease: "power2.out",
            onStart: () => {
              void prepareReverseSnap();
            },
          },
          5.3 * speed
        )
        // Reverse Thanos snap — dust reassembles into the homepage
        .to(
          state,
          {
            assemble: 1,
            colorMix: 1,
            spin: 0.02,
            particleSize: isMobile ? 0.065 : 0.052,
            cameraZ: isMobile ? 7.0 : 6.2,
            duration: 1.7 * speed,
            ease: "power2.inOut",
          },
          6.0 * speed
        )
        // Brief hold on the assembled form, then solid page takes over
        .add(() => {
          handoff();
        }, 7.45 * speed)
        .to(
          vignette,
          { autoAlpha: 0, duration: 0.65 * speed, ease: "power2.inOut" },
          7.35 * speed
        )
        .to(
          root,
          { autoAlpha: 0, duration: 0.5 * speed, ease: "power2.inOut" },
          7.4 * speed
        )
        // Particles peel into the living starfield behind the page
        .to(
          state,
          {
            dissolve: 1,
            cameraZ: 0,
            particleSize: isMobile ? 0.16 : 0.13,
            duration: 1.45 * speed,
            ease: "power2.inOut",
          },
          7.75 * speed
        )
        .add(() => {
          finishIntro();
        });
    };

    resize();
    frame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);

    if (playIntroRef.current) {
      requestAnimationFrame(() => requestAnimationFrame(startSplash));
    } else {
      gsap.set(vignetteCanvas, { autoAlpha: 0 });
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion && playIntroRef.current) {
      finishIntro();
    }

    return () => {
      disposed = true;
      window.clearTimeout(failSafe);
      timeline?.kill();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [splashRootRef, homeRootRef]);

  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full">
      <div ref={mountRef} className="absolute inset-0" aria-hidden />
      <canvas
        ref={vignetteRef}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        aria-hidden
      />
    </div>
  );
}
