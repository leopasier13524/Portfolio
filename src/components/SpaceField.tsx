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

const COUNT_DESKTOP = 7800;
const COUNT_MOBILE = 3600;
const FIELD_DEPTH = 780;
const FIELD_SPREAD_X = 26;
const FIELD_SPREAD_Y = 16;
const DRIFT_RIGHT = 0.0065;
const DRIFT_TOWARD = 0.0035;
const RING_TILT = 0.28;
/** Matches HomeView `object-[center_14%]` */
const PORTRAIT_OBJECT_POS = { x: 0.5, y: 0.14 };

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
  gradient.addColorStop(0.18, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.4)");
  gradient.addColorStop(0.75, "rgba(255,255,255,0.1)");
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
    // Even depth mix so far layers stay populated
    const depthT = Math.random();
    // Tight XY cluster — same count reads denser on screen
    const pack = 0.88 + depthT * 0.12;
    target[i3] = (Math.random() - 0.5) * FIELD_SPREAD_X * 2 * pack;
    target[i3 + 1] = (Math.random() - 0.5) * FIELD_SPREAD_Y * 2 * pack;
    target[i3 + 2] = -1.8 - depthT * FIELD_DEPTH;

    // Keep far stars visible; near ones a touch brighter
    const shade = 0.82 + (1 - depthT) * 0.16 + Math.random() * 0.05;
    const cool = Math.random() > 0.9;
    colors[i3] = cool ? shade * 0.96 : shade;
    colors[i3 + 1] = cool ? shade * 0.98 : shade;
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
  const pack = 0.88 + depthT * 0.12;
  positions[i3] = -FIELD_SPREAD_X * (0.95 + Math.random() * 0.4) * pack;
  positions[i3 + 1] = (Math.random() - 0.5) * FIELD_SPREAD_Y * 2 * pack;
  positions[i3 + 2] = -1.8 - depthT * FIELD_DEPTH;
  const shade = 0.82 + (1 - depthT) * 0.16 + Math.random() * 0.05;
  const cool = Math.random() > 0.9;
  colors[i3] = cool ? shade * 0.96 : shade;
  colors[i3 + 1] = cool ? shade * 0.98 : shade;
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

type PortraitSampleSet = {
  samples: Sample[];
  /** naturalWidth / naturalHeight */
  aspect: number;
};

async function samplePortraitPixels(
  src: string,
  maxSamples: number
): Promise<PortraitSampleSet> {
  try {
    const img = await loadImage(src);
    const aspect =
      img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 0.75;
    const w = 128;
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = Math.max(1, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return { samples: [], aspect };
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
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = (r + g + b) / 3;
        if (luma < 18 && Math.random() > 0.15) {
          continue;
        }
        samples.push({
          x: x / Math.max(1, w - 1),
          y: y / Math.max(1, h - 1),
          r: r / 255,
          g: g / 255,
          b: b / 255,
        });
      }
    }
    if (samples.length <= maxSamples) {
      return { samples, aspect };
    }
    for (let i = samples.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = samples[i];
      samples[i] = samples[j];
      samples[j] = tmp;
    }
    return { samples: samples.slice(0, maxSamples), aspect };
  } catch {
    return { samples: [], aspect: 0.75 };
  }
}

function liftAssembleColor(r: number, g: number, b: number) {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  // Visible, but not blown out — preserve a bit of portrait shading
  const shade = Math.min(0.98, 0.62 + luma * 0.48);
  return { r: shade, g: shade, b: shade };
}

/** Map a full-image UV through object-fit:cover + object-position into screen space. */
function mapCoverImageToScreen(
  ix: number,
  iy: number,
  imgAspect: number,
  frame: DOMRect,
  posX: number,
  posY: number
) {
  const frameAspect = frame.width / Math.max(frame.height, 1);
  let dispW: number;
  let dispH: number;
  if (imgAspect > frameAspect) {
    dispH = frame.height;
    dispW = dispH * imgAspect;
  } else {
    dispW = frame.width;
    dispH = dispW / Math.max(imgAspect, 0.001);
  }
  const ox = frame.left + (frame.width - dispW) * posX;
  const oy = frame.top + (frame.height - dispH) * posY;
  const sx = ox + ix * dispW;
  const sy = oy + iy * dispH;
  const pad = 0.75;
  const visible =
    sx >= frame.left - pad &&
    sx <= frame.right + pad &&
    sy >= frame.top - pad &&
    sy <= frame.bottom + pad;
  return { sx, sy, visible };
}

function pickWeightedRect(rects: DOMRect[]) {
  if (rects.length === 0) {
    return null;
  }
  let total = 0;
  const weights = rects.map((r) => {
    // Prefer larger text blocks (headline / about) over tiny labels
    const area = Math.max(1, r.width * r.height);
    const weight = Math.pow(area, 1.15);
    total += weight;
    return weight;
  });
  let t = Math.random() * total;
  for (let i = 0; i < rects.length; i += 1) {
    t -= weights[i];
    if (t <= 0) {
      return rects[i];
    }
  }
  return rects[rects.length - 1];
}

function buildAssembleFromLayout(
  homeRoot: HTMLElement | null,
  portraitSampleSet: PortraitSampleSet,
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
  const portraitEl = homeRoot?.querySelector<HTMLElement>("[data-home-portrait]");
  const portraitRect = portraitEl?.getBoundingClientRect() ?? null;
  const portraitOk =
    portraitRect != null && portraitRect.width > 8 && portraitRect.height > 8
      ? portraitRect
      : null;

  const items = homeRoot
    ? Array.from(
        homeRoot.querySelectorAll<HTMLElement>(
          "[data-home-item]:not([data-assemble-skip]):not([data-home-portrait])"
        )
      )
    : [];
  const otherRects = items
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 8 && r.height > 8);

  const imgAspect = portraitSampleSet.aspect || 0.75;
  const visibleSamples =
    portraitOk && portraitSampleSet.samples.length > 0
      ? portraitSampleSet.samples.filter((sample) =>
          mapCoverImageToScreen(
            sample.x,
            sample.y,
            imgAspect,
            portraitOk,
            PORTRAIT_OBJECT_POS.x,
            PORTRAIT_OBJECT_POS.y
          ).visible
        )
      : [];

  const portraitCount = Math.floor(count * (portraitOk ? 0.8 : 0.35));

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    let sx: number;
    let sy: number;
    let cr: number;
    let cg: number;
    let cb: number;

    if (i < portraitCount && portraitOk) {
      const sample =
        visibleSamples.length > 0
          ? visibleSamples[i % visibleSamples.length]
          : portraitSampleSet.samples.length > 0
            ? portraitSampleSet.samples[i % portraitSampleSet.samples.length]
            : null;

      if (sample) {
        const mapped = mapCoverImageToScreen(
          sample.x,
          sample.y,
          imgAspect,
          portraitOk,
          PORTRAIT_OBJECT_POS.x,
          PORTRAIT_OBJECT_POS.y
        );
        sx = THREE.MathUtils.clamp(
          mapped.sx,
          portraitOk.left + 1,
          portraitOk.right - 1
        );
        sy = THREE.MathUtils.clamp(
          mapped.sy,
          portraitOk.top + 1,
          portraitOk.bottom - 1
        );
        const lifted = liftAssembleColor(sample.r, sample.g, sample.b);
        cr = lifted.r;
        cg = lifted.g;
        cb = lifted.b;
      } else {
        sx = portraitOk.left + (0.08 + Math.random() * 0.84) * portraitOk.width;
        sy = portraitOk.top + (0.06 + Math.random() * 0.88) * portraitOk.height;
        cr = splashColors[i3];
        cg = splashColors[i3 + 1];
        cb = splashColors[i3 + 2];
      }
    } else if (otherRects.length > 0) {
      const rect = pickWeightedRect(otherRects)!;
      const padX = Math.min(rect.width * 0.08, 18);
      const padY = Math.min(rect.height * 0.12, 14);
      sx = rect.left + padX + Math.random() * Math.max(1, rect.width - padX * 2);
      sy = rect.top + padY + Math.random() * Math.max(1, rect.height - padY * 2);
      const shade = 0.88 + Math.random() * 0.12;
      cr = shade;
      cg = shade;
      cb = shade;
    } else {
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

    const world = screenToWorld(
      sx,
      sy,
      camera,
      planeZ + (Math.random() - 0.5) * 0.12
    );
    assemblePos[i3] = world.x;
    assemblePos[i3 + 1] = world.y;
    assemblePos[i3 + 2] = world.z;
    assembleColors[i3] = cr;
    assembleColors[i3 + 1] = cg;
    assembleColors[i3 + 2] = cb;

    const wave = portraitOk
      ? THREE.MathUtils.clamp(
          (sx - portraitOk.left) / Math.max(portraitOk.width, 1),
          0,
          1
        )
      : Math.random();
    delays[i] = wave * 0.05 + Math.random() * 0.02;

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

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

function easeInOutQuart(t: number) {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function rotateX(x: number, y: number, z: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x,
    y: y * c - z * s,
    z: y * s + z * c,
  };
}

function rotateY(x: number, y: number, z: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: x * c + z * s,
    y,
    z: -x * s + z * c,
  };
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
    scene.fog = null;
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      isMobile ? 60 : 55,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      900
    );
    camera.position.set(0, 0, isMobile ? 10.5 : 9.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(
      Math.max(mount.clientWidth, 1),
      Math.max(mount.clientHeight, 1)
    );
    renderer.setClearColor(0x000000, 0);
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

    // Bright grayscale dust — stays additive-safe (no hue bias)
    for (let i = 0; i < count; i += 1) {
      const shade = 0.9 + Math.random() * 0.1;
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
      size: isMobile ? 0.06 : 0.048,
      map: createTexture(),
      transparent: true,
      depthWrite: false,
      // Additive reads correctly on a transparent canvas; Normal looked washed out
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      opacity: playIntroRef.current ? 0 : 1,
      sizeAttenuation: true,
      toneMapped: false,
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
      spinAngle: 0,
      particleSize: isMobile ? 0.06 : 0.048,
      colorMix: 0,
    };

    if (!playIntroRef.current) {
      current.set(home);
      colors.set(homeColors);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      camera.position.z = 0;
      state.cameraZ = 0;
      state.particleSize = isMobile ? 0.19 : 0.15;
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

        // Tilt ring toward camera as it forms
        if (morph >= 1) {
          const tiltT = THREE.MathUtils.clamp(morph - 1, 0, 1);
          const tilted = rotateX(x, y, z, RING_TILT * tiltT);
          x = tilted.x;
          y = tilted.y;
          z = tilted.z;
        }

        // Spin in particle space — not on the container — so homepage targets stay upright
        if (assembleT < 1) {
          const spun = rotateY(x, y, z, state.spinAngle);
          x = spun.x;
          y = spun.y;
          z = spun.z;
        }

        // Reverse snap with per-particle stagger
        const delay = delays[i];
        const localAssemble = THREE.MathUtils.clamp(
          (assembleT - delay * 0.04) / Math.max(0.001, 1 - delay * 0.03),
          0,
          1
        );
        const snapEase = easeInOutCubic(localAssemble);

        x = THREE.MathUtils.lerp(x, assemble[i3], snapEase);
        y = THREE.MathUtils.lerp(y, assemble[i3 + 1], snapEase);
        z = THREE.MathUtils.lerp(z, assemble[i3 + 2], snapEase);

        // Peel into depth starfield — soft XY + depth on the same gentle curve
        const localDissolve = THREE.MathUtils.clamp(
          (dissolveT - delay * 0.12) / Math.max(0.001, 1 - delay * 0.1),
          0,
          1
        );
        const peel = easeInOutSine(localDissolve);

        positions[i3] = THREE.MathUtils.lerp(x, home[i3], peel);
        positions[i3 + 1] = THREE.MathUtils.lerp(y, home[i3 + 1], peel);
        positions[i3 + 2] = THREE.MathUtils.lerp(z, home[i3 + 2], peel);

        const cAssemble = snapEase;
        const cHome = peel;
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
        if (state.spin > 0.001) {
          state.spinAngle += 0.0032 * state.spin;
        }
        points.rotation.set(0, 0, 0);
        camera.position.z = state.cameraZ;
        material.size = state.particleSize;
        material.opacity = Math.max(material.opacity, 0.98);

        if (material.blending !== THREE.AdditiveBlending) {
          material.blending = THREE.AdditiveBlending;
          material.needsUpdate = true;
        }

        mixSplash();
      } else {
        points.rotation.set(0, 0, 0);
        camera.position.z = 0;
        material.size = isMobile ? 0.19 : 0.15;
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
      points.rotation.set(0, 0, 0);
      camera.position.z = 0;
      state.spin = 0;
      state.spinAngle = 0;
      onIntroCompleteRef.current();
    };

    let portraitSamplesCache: PortraitSampleSet = {
      samples: [],
      aspect: 0.75,
    };

    const refreshAssembleTargets = () => {
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3;
        const formed = formedAtMorph(cloud, sphere, ring, 2, i3);
        formedScratch[i3] = formed.x;
        formedScratch[i3 + 1] = formed.y;
        formedScratch[i3 + 2] = formed.z;
      }

      const sampleCam = camera.clone();
      sampleCam.position.z = isMobile ? 7.0 : 6.2;
      sampleCam.updateMatrixWorld();

      buildAssembleFromLayout(
        homeRootRef.current,
        portraitSamplesCache,
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

    const prepareReverseSnap = async () => {
      try {
        portraitSamplesCache = await samplePortraitPixels(
          portfolioOwner.portraitImage,
          Math.floor(count * 0.85)
        );
      } catch {
        portraitSamplesCache = { samples: [], aspect: 0.75 };
      }

      if (disposed) {
        return;
      }

      refreshAssembleTargets();
    };

    const startSplash = () => {
      const root = splashRootRef.current;
      if (!root) {
        requestAnimationFrame(startSplash);
        return;
      }

      const nameLines = root.querySelectorAll("[data-splash-name]");
      const role = root.querySelector("[data-splash-role]");
      const meter = root.querySelector("[data-splash-meter]");
      const center = root.querySelector("[data-splash-center]");
      const progress = root.querySelector("[data-splash-progress]");
      const counter = root.querySelector("[data-splash-counter]");
      const vignette = vignetteCanvas;

      const counterState = { value: 0 };

      gsap.set([role, meter], { autoAlpha: 0, y: 20 });
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
        .to(material, { opacity: 1, duration: 0.85 * speed }, 0.05)
        // Form the orb a bit more slowly…
        .to(
          state,
          { morph: 1, duration: 1.85 * speed, ease: "power2.inOut" },
          0.15
        )
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
            particleSize: isMobile ? 0.07 : 0.055,
            duration: 1.15 * speed,
            ease: "power2.inOut",
          },
          3.15 * speed
        )
        .to(
          center,
          {
            autoAlpha: 0,
            y: -8,
            duration: 0.65 * speed,
            ease: "sine.inOut",
          },
          5.65 * speed
        )
        .to(
          state,
          {
            cameraZ: isMobile ? 8.4 : 7.5,
            duration: 1.35 * speed,
            ease: "sine.inOut",
          },
          5.55 * speed
        )
        // Ring keeps spinning right while particles build the homepage
        .to(
          state,
          {
            assemble: 1,
            spin: 0.7,
            particleSize: isMobile ? 0.08 : 0.065,
            cameraZ: isMobile ? 7.0 : 6.2,
            duration: 1.6 * speed,
            ease: "power1.inOut",
          },
          5.85 * speed
        )
        .add(() => {
          handoff();
        }, 6.95 * speed)
        .to(
          vignette,
          { autoAlpha: 0, duration: 0.55 * speed, ease: "sine.inOut" },
          7.35 * speed
        )
        .to(
          root,
          { autoAlpha: 0, duration: 0.5 * speed, ease: "sine.inOut" },
          7.4 * speed
        )
        .to(
          state,
          {
            dissolve: 1,
            spin: 0,
            duration: 2.2 * speed,
            ease: "sine.inOut",
          },
          7.5 * speed
        )
        .to(
          state,
          {
            particleSize: isMobile ? 0.19 : 0.15,
            duration: 2.2 * speed,
            ease: "sine.inOut",
          },
          7.65 * speed
        )
        .to(
          state,
          {
            cameraZ: 0,
            duration: 2.45 * speed,
            ease: "sine.inOut",
          },
          7.7 * speed
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
