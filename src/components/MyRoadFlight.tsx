"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { gsap } from "gsap";
import type { MyRoadStop } from "@/content/portfolio";
import {
  buildCamera,
  cross,
  normalize,
  offsetFromPath,
  pathTangent,
  project,
  samplePath,
  sub,
  vec,
  type Camera,
  type Vec3,
} from "@/lib/flightPath";
import { createSkillSprite, type SkillSprite } from "@/lib/skillIconImage";

export type FlightControls = {
  play: () => void;
  pause: () => void;
  toggle: () => boolean;
  jumpToChapter: (index: number) => void;
  skipToEnd: () => void;
  restart: () => void;
};

type MyRoadFlightProps = {
  stops: MyRoadStop[];
  controlsRef: MutableRefObject<FlightControls | null>;
  onChapter: (index: number) => void;
  onProgress: (progress: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onComplete: () => void;
};

/** Waypoints per chapter — the third one is the milestone gate. */
const PER_CHAPTER = 3;
const LEAD_IN = 2;
const TAIL = 3;
const SPACING = 50;

const ROAD_HALF_WIDTH = 3.4;
const CAMERA_LIFT = 2.4;
/**
 * Short look-ahead on purpose: aiming far down a curving spline swings the near
 * road out of frame, which reads as the camera losing the road.
 */
const LOOK_AHEAD = 0.6;

const TRAVEL_DURATION = 2.9;
const ARRIVAL_DURATION = 2.75;
const INTRO_DURATION = 2.7;
const OUTRO_DURATION = 3.4;

function gateIndex(chapter: number) {
  return LEAD_IN + chapter * PER_CHAPTER + (PER_CHAPTER - 1);
}

/** Deterministic noise so every replay flies the exact same route. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function buildWaypoints(chapterCount: number): Vec3[] {
  const total = LEAD_IN + chapterCount * PER_CHAPTER + TAIL;
  const points: Vec3[] = [];

  for (let i = 0; i < total; i += 1) {
    // Two layered sines instead of per-waypoint jitter: long, smooth S-curves
    // with no kinks for the camera to snap through.
    const ease = Math.min(1, Math.max(0, (i - 1) / 2));
    const x = (Math.sin(i * 0.55) * 15 + Math.sin(i * 0.23 + 1.7) * 9) * ease;
    const y = Math.sin(i * 0.37 + 0.6) * 5 * ease;
    points.push(vec(x, y, i * SPACING));
  }

  return points;
}

type IconPlacement = {
  sprite: SkillSprite;
  u: number;
  side: number;
  lift: number;
  spin: number;
};

function placeIcons(stops: MyRoadStop[]): IconPlacement[] {
  const random = seeded(777001);
  const placements: IconPlacement[] = [];

  stops.forEach((stop, chapter) => {
    const from = chapter === 0 ? LEAD_IN - 0.4 : gateIndex(chapter - 1) + 0.55;
    const to = gateIndex(chapter) - 0.3;
    const span = Math.max(0.8, to - from);

    stop.skills.forEach((skill, k) => {
      const sprite = createSkillSprite(skill);
      if (!sprite) {
        return;
      }

      const slot = (k + 0.5) / stop.skills.length;
      const sign = k % 2 === 0 ? -1 : 1;
      // Every third logo sits low and close to the centreline, so the plane
      // genuinely threads between them instead of only passing them wide.
      const central = k % 3 === 2;
      const side = central
        ? sign * (1.6 + random() * 1.1)
        : sign * (4.6 + random() * 4.4);
      const lift = central ? 4.6 + random() * 2.2 : 1.4 + random() * 4.6;

      placements.push({
        sprite,
        u: from + slot * span,
        side,
        lift,
        spin: (random() - 0.5) * 0.5,
      });
    });
  });

  return placements.sort((a, b) => b.u - a.u);
}

type Dust = { u: number; rx: number; ry: number; size: number };
type Star = { x: number; y: number; r: number; a: number };

export function MyRoadFlight({
  stops,
  controlsRef,
  onChapter,
  onProgress,
  onPlayStateChange,
  onComplete,
}: MyRoadFlightProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const onChapterRef = useRef(onChapter);
  const onProgressRef = useRef(onProgress);
  const onPlayStateRef = useRef(onPlayStateChange);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onChapterRef.current = onChapter;
    onProgressRef.current = onProgress;
    onPlayStateRef.current = onPlayStateChange;
    onCompleteRef.current = onComplete;
  }, [onChapter, onProgress, onPlayStateChange, onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || stops.length === 0) {
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return;
    }

    const path = buildWaypoints(stops.length);
    const icons = placeIcons(stops);
    const lastGate = gateIndex(stops.length - 1);
    const endU = lastGate + 2.2;

    let width = 0;
    let height = 0;
    let narrow = false;
    let focal = 800;
    let dust: Dust[] = [];
    let stars: Star[] = [];
    let grain: HTMLCanvasElement | null = null;

    const flight = { u: 0.15 };
    let renderedU = flight.u;
    let speed = 0;
    let roll = 0;
    let frame = 0;
    let lastNow = performance.now();

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      narrow = width < 768;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      focal = Math.max(520, Math.min(width, height) * (narrow ? 1.15 : 0.98));

      const dustCount = narrow ? 90 : 170;
      if (dust.length !== dustCount) {
        const random = seeded(4242);
        dust = Array.from({ length: dustCount }, () => {
          const angle = random() * Math.PI * 2;
          const radius = 3 + random() * 34;
          return {
            u: flight.u + random() * 6,
            rx: Math.cos(angle) * radius,
            ry: Math.sin(angle) * radius * 0.7 + 2,
            size: 0.7 + random() * 1.5,
          };
        });
      }

      const starCount = narrow ? 70 : 130;
      if (stars.length !== starCount) {
        const random = seeded(9091);
        stars = Array.from({ length: starCount }, () => ({
          x: random(),
          y: random() * 0.72,
          r: 0.4 + random() * 1.1,
          a: 0.16 + random() * 0.4,
        }));
      }

      if (!grain) {
        const tile = document.createElement("canvas");
        tile.width = 128;
        tile.height = 128;
        const tileCtx = tile.getContext("2d");
        if (tileCtx) {
          const data = tileCtx.createImageData(128, 128);
          for (let i = 0; i < data.data.length; i += 4) {
            const v = 120 + Math.random() * 135;
            data.data[i] = v;
            data.data[i + 1] = v;
            data.data[i + 2] = v;
            data.data[i + 3] = 255;
          }
          tileCtx.putImageData(data, 0, 0);
          grain = tile;
        }
      }
    };

    const cameraAt = (u: number): Camera => {
      const centre = samplePath(path, u);
      const tangent = pathTangent(path, u);
      const right = normalize(cross(vec(0, 1, 0), tangent));
      const up = cross(tangent, right);
      const position = vec(
        centre.x + up.x * CAMERA_LIFT,
        centre.y + up.y * CAMERA_LIFT,
        centre.z + up.z * CAMERA_LIFT
      );
      const target = samplePath(path, u + LOOK_AHEAD);
      const look = normalize(sub(target, position));
      // Mostly tangent-aligned: a pure look-ahead aim swings the near road out
      // from under the plane every time the route bends.
      const forward = normalize(
        vec(
          tangent.x * 0.72 + look.x * 0.28,
          tangent.y * 0.72 + look.y * 0.28,
          tangent.z * 0.72 + look.z * 0.28
        )
      );
      return buildCamera(position, forward, roll, focal, width, height);
    };

    const drawBackdrop = (camera: Camera, vanishing: { x: number; y: number }) => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Star layer drifts with heading and banks with the camera
      const yaw = Math.atan2(camera.forward.x, camera.forward.z);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(camera.roll * 0.65);
      ctx.translate(-width / 2, -height / 2);
      for (const star of stars) {
        const x = ((star.x - yaw * 0.12) % 1 + 1) % 1;
        ctx.fillStyle = `rgba(255,255,255,${star.a})`;
        ctx.beginPath();
        ctx.arc(x * width, star.y * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Light at the end of the road
      const glow = ctx.createRadialGradient(
        vanishing.x,
        vanishing.y,
        0,
        vanishing.x,
        vanishing.y,
        Math.max(width, height) * 0.55
      );
      glow.addColorStop(0, "rgba(255,255,255,0.14)");
      glow.addColorStop(0.35, "rgba(190,205,255,0.05)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    };

    const drawRoad = (camera: Camera, u: number) => {
      const samples = narrow ? 46 : 64;
      const reach = 5.6;
      const left: { x: number; y: number; depth: number }[] = [];
      const right: { x: number; y: number; depth: number }[] = [];

      for (let i = 0; i <= samples; i += 1) {
        const k = i / samples;
        // Bias samples toward the camera so the near road stays smooth
        const su = u + 0.05 + k * k * reach;
        const edgeL = offsetFromPath(path, su, -ROAD_HALF_WIDTH, 0);
        const edgeR = offsetFromPath(path, su, ROAD_HALF_WIDTH, 0);
        const pl = project(camera, edgeL);
        const pr = project(camera, edgeR);
        if (pl.depth <= 0.2 || pr.depth <= 0.2) {
          // Skipping clipped samples mid-run would stitch unrelated parts of
          // the ribbon together, so drop the leading ones and stop at the rest.
          if (left.length === 0) {
            continue;
          }
          break;
        }
        left.push({ x: pl.x, y: pl.y, depth: pl.depth });
        right.push({ x: pr.x, y: pr.y, depth: pr.depth });
      }

      if (left.length < 2) {
        return;
      }

      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (let i = 1; i < left.length; i += 1) {
        ctx.lineTo(left[i].x, left[i].y);
      }
      for (let i = right.length - 1; i >= 0; i -= 1) {
        ctx.lineTo(right[i].x, right[i].y);
      }
      ctx.closePath();

      const nearY = Math.max(left[0].y, right[0].y);
      const farY = Math.min(left[left.length - 1].y, right[right.length - 1].y);
      const surface = ctx.createLinearGradient(0, farY, 0, nearY);
      surface.addColorStop(0, "rgba(120,140,190,0.02)");
      surface.addColorStop(0.5, "rgba(140,162,215,0.09)");
      surface.addColorStop(1, "rgba(182,198,240,0.2)");
      ctx.fillStyle = surface;
      ctx.fill();

      // Rungs across the surface — cheap but they carry most of the speed read
      const rungStep = 0.13;
      const firstRung = Math.ceil((u + 0.08) / rungStep) * rungStep;
      for (let du = firstRung; du < u + reach; du += rungStep) {
        const a = project(camera, offsetFromPath(path, du, -ROAD_HALF_WIDTH, 0));
        const b = project(camera, offsetFromPath(path, du, ROAD_HALF_WIDTH, 0));
        if (a.depth <= 0.3 || b.depth <= 0.3) {
          continue;
        }
        const fade = Math.max(0, 1 - (a.depth - 3) / 150);
        ctx.strokeStyle = `rgba(190,210,255,${0.16 * fade})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Edge rails, with a wide soft pass underneath for glow
      for (const edge of [left, right]) {
        const trace = () => {
          ctx.beginPath();
          ctx.moveTo(edge[0].x, edge[0].y);
          for (let i = 1; i < edge.length; i += 1) {
            ctx.lineTo(edge[i].x, edge[i].y);
          }
        };

        const glow = ctx.createLinearGradient(0, farY, 0, nearY);
        glow.addColorStop(0, "rgba(150,180,255,0)");
        glow.addColorStop(0.6, "rgba(150,180,255,0.1)");
        glow.addColorStop(1, "rgba(170,195,255,0.22)");
        trace();
        ctx.strokeStyle = glow;
        ctx.lineWidth = 5;
        ctx.stroke();

        const rail = ctx.createLinearGradient(0, farY, 0, nearY);
        rail.addColorStop(0, "rgba(255,255,255,0.05)");
        rail.addColorStop(0.55, "rgba(255,255,255,0.5)");
        rail.addColorStop(1, "rgba(255,255,255,0.92)");
        trace();
        ctx.strokeStyle = rail;
        ctx.lineWidth = 1.7;
        ctx.stroke();
      }

      // Centre dashes — the "road markings" that sell the speed
      const dashStep = 0.085;
      const first = Math.ceil((u + 0.08) / dashStep) * dashStep;
      for (let du = first; du < u + reach; du += dashStep) {
        const a = project(camera, offsetFromPath(path, du, 0, 0.02));
        const b = project(camera, offsetFromPath(path, du + dashStep * 0.45, 0, 0.02));
        if (a.depth <= 0.3 || b.depth <= 0.3) {
          continue;
        }
        const fade = Math.max(0, 1 - (a.depth - 4) / 190);
        ctx.strokeStyle = `rgba(255,255,255,${0.62 * fade})`;
        ctx.lineWidth = Math.min(12, Math.max(0.8, 2.4 * a.scale * 0.12));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Side chevrons pointing the way
      const chevStep = 0.5;
      const firstChev = Math.ceil((u + 0.2) / chevStep) * chevStep;
      for (let du = firstChev; du < u + reach; du += chevStep) {
        for (const sign of [-1, 1]) {
          const tip = project(camera, offsetFromPath(path, du + 0.12, sign * (ROAD_HALF_WIDTH + 0.5), 0.1));
          const back = project(camera, offsetFromPath(path, du, sign * (ROAD_HALF_WIDTH + 1.5), 0.1));
          if (tip.depth <= 0.3 || back.depth <= 0.3) {
            continue;
          }
          const fade = Math.max(0, 1 - (tip.depth - 6) / 150);
          ctx.strokeStyle = `rgba(200,220,255,${0.6 * fade})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(back.x, back.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();
        }
      }
    };

    const drawGate = (camera: Camera, chapter: number) => {
      const gu = gateIndex(chapter);
      const centre = samplePath(path, gu);
      const probe = project(camera, centre);
      if (probe.depth <= 1 || probe.depth > 420) {
        return;
      }

      const tangent = pathTangent(path, gu);
      const right = normalize(cross(vec(0, 1, 0), tangent));
      const up = cross(tangent, right);
      const radius = 10.4;
      const near = Math.max(0, Math.min(1, (probe.depth - 2) / 8));
      const far = Math.max(0, Math.min(1, 1 - (probe.depth - 120) / 260));
      const alpha = near * far;

      if (alpha <= 0.01) {
        return;
      }

      // Light burst as the ring swallows the camera
      if (probe.depth < 22) {
        const burst = Math.pow(1 - probe.depth / 22, 2);
        const flare = ctx.createRadialGradient(
          probe.x,
          probe.y,
          0,
          probe.x,
          probe.y,
          radius * probe.scale * 1.3
        );
        flare.addColorStop(0, `rgba(210,225,255,${0.3 * burst})`);
        flare.addColorStop(0.5, `rgba(170,195,255,${0.12 * burst})`);
        flare.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = flare;
        ctx.fillRect(0, 0, width, height);
      }

      for (const ring of [radius, radius * 0.93]) {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 56; i += 1) {
          const theta = (i / 56) * Math.PI * 2;
          const point = vec(
            centre.x + right.x * Math.cos(theta) * ring + up.x * Math.sin(theta) * ring,
            centre.y + right.y * Math.cos(theta) * ring + up.y * Math.sin(theta) * ring,
            centre.z + right.z * Math.cos(theta) * ring + up.z * Math.sin(theta) * ring
          );
          const p = project(camera, point);
          if (p.depth <= 0.3) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle = `rgba(255,255,255,${(ring === radius ? 0.5 : 0.16) * alpha})`;
        ctx.lineWidth = ring === radius ? 1.4 : 0.8;
        ctx.stroke();
      }

      // Chapter number floating over the gate
      const label = project(
        camera,
        offsetFromPath(path, gu, 0, radius + 2.4)
      );
      if (label.depth > 1) {
        const size = Math.max(9, Math.min(74, 2.4 * label.scale));
        ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(255,255,255,${0.5 * alpha})`;
        ctx.fillText(String(chapter + 1).padStart(2, "0"), label.x, label.y);
      }

      // Milestone title rendered in world space — you fly through the words
      const title = project(camera, offsetFromPath(path, gu + 0.1, 0, radius * 0.42));
      if (title.depth > 3 && title.depth < 200) {
        const size = Math.max(10, Math.min(88, 1.5 * title.scale));
        // Reads as approaching signage, then clears out before the fly-through
        // so it never fights the lower-third card.
        const titleAlpha =
          alpha * Math.max(0, Math.min(1, 1 - Math.abs(title.depth - 78) / 68));
        if (titleAlpha > 0.02) {
          ctx.font = `600 ${size}px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = `rgba(255,255,255,${0.42 * titleAlpha})`;
          ctx.fillText(stops[chapter].title.toUpperCase(), title.x, title.y);
        }
      }
    };

    const drawIcons = (camera: Camera, u: number) => {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      for (const item of icons) {
        if (item.u < u - 0.35 || item.u > u + 6.2) {
          continue;
        }
        const position = offsetFromPath(path, item.u, item.side, item.lift);
        const p = project(camera, position);
        if (p.depth <= 1.2 || p.depth > 280) {
          continue;
        }

        // Cap the on-screen size, otherwise a logo you pass close by swallows
        // the whole frame instead of whooshing past.
        const size = Math.max(
          6,
          Math.min(3.5 * p.scale, Math.min(width, height) * 0.16)
        );
        const appear = Math.max(0, Math.min(1, 1 - (p.depth - 60) / 150));
        const pass = Math.max(0, Math.min(1, (p.depth - 1.4) / 5.5));
        const alpha = appear * pass;
        if (alpha <= 0.02) {
          continue;
        }

        const plate = size * 0.86;
        const halo = ctx.createRadialGradient(p.x, p.y, plate * 0.2, p.x, p.y, plate * 1.9);
        halo.addColorStop(0, `rgba(160,185,255,${0.14 * alpha})`);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, plate * 1.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(4,6,12,${0.72 * alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, plate, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.3 * alpha})`;
        ctx.lineWidth = Math.max(0.6, plate * 0.035);
        ctx.stroke();

        if (item.sprite.loaded) {
          const iconW = size * (item.sprite.aspect >= 1 ? 1 : item.sprite.aspect);
          const iconH = size * (item.sprite.aspect >= 1 ? 1 / item.sprite.aspect : 1);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(item.spin * 0.25);
          ctx.drawImage(item.sprite.image, -iconW / 2, -iconH / 2, iconW, iconH);
          ctx.restore();
        }

        if (size > 34) {
          const labelSize = Math.max(8, Math.min(20, size * 0.2));
          ctx.font = `500 ${labelSize}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = `rgba(255,255,255,${0.62 * alpha})`;
          ctx.fillText(item.sprite.name, p.x, p.y + plate * 1.25);
        }
      }
    };

    const drawDust = (camera: Camera, u: number) => {
      const streak = Math.min(0.06, 0.012 + speed * 0.05);
      for (const mote of dust) {
        if (mote.u < u - 0.1 || mote.u > u + 6.4) {
          const random = Math.random();
          const angle = random * Math.PI * 2;
          const radius = 3 + Math.random() * 34;
          mote.u = u + 5.4 + Math.random();
          mote.rx = Math.cos(angle) * radius;
          mote.ry = Math.sin(angle) * radius * 0.7 + 2;
          continue;
        }

        const head = samplePath(path, mote.u);
        const tail = samplePath(path, mote.u + streak);
        const a = project(camera, vec(head.x + mote.rx, head.y + mote.ry, head.z));
        const b = project(camera, vec(tail.x + mote.rx, tail.y + mote.ry, tail.z));
        if (a.depth <= 0.5) {
          continue;
        }

        const fade = Math.max(0, Math.min(0.85, 1 - a.depth / 190));
        if (b.depth > 0.5) {
          ctx.strokeStyle = `rgba(255,255,255,${0.32 * fade})`;
          ctx.lineWidth = Math.max(0.5, mote.size * a.scale * 0.02);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(255,255,255,${0.3 * fade})`;
          ctx.beginPath();
          ctx.arc(a.x, a.y, Math.max(0.6, mote.size * a.scale * 0.02), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawPlane = (camera: Camera, u: number, now: number) => {
      // The plane rides an actual point on the road ahead of the camera, so it
      // always sits on the route instead of floating at a fixed screen spot.
      const guide = project(camera, offsetFromPath(path, u + 0.42, 0, 0.9));
      const onRoad = guide.depth > 2;
      const unit = onRoad
        ? Math.max(0.5, Math.min(1.25, guide.scale * 0.023))
        : Math.max(0.5, Math.min(width, height) / 900);
      const bob = Math.sin(now / 900) * 6 * unit;
      const sway = Math.sin(now / 1400) * 9 * unit;
      const x = (onRoad ? guide.x : width / 2) + sway;
      const y = (onRoad ? guide.y : height * (narrow ? 0.8 : 0.83)) + bob;
      const bank = -roll * 1.5;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bank);
      ctx.scale(unit, unit);

      // Wing-tip vapour
      const trail = 40 + speed * 260;
      for (const sign of [-1, 1]) {
        const grad = ctx.createLinearGradient(sign * 34, 16, sign * 46, 16 + trail);
        grad.addColorStop(0, "rgba(255,255,255,0.3)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(sign * 34, 16);
        ctx.quadraticCurveTo(sign * 42, 16 + trail * 0.5, sign * 40, 16 + trail);
        ctx.stroke();
      }

      // Paper plane seen from behind: swept wings with dihedral and a crease
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(-40, 20);
      ctx.lineTo(-7, 12);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(246,248,255,0.96)";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(40, 20);
      ctx.lineTo(7, 12);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(178,188,214,0.92)";
      ctx.fill();

      // Fuselage keel catching the light
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(-7, 12);
      ctx.lineTo(7, 12);
      ctx.closePath();
      ctx.fillStyle = "rgba(226,232,248,0.98)";
      ctx.fill();

      ctx.strokeStyle = "rgba(70,80,110,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(0, 12);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-40, 20);
      ctx.lineTo(-7, 12);
      ctx.lineTo(7, 12);
      ctx.lineTo(40, 20);
      ctx.stroke();

      ctx.restore();
    };

    const drawGrade = (now: number) => {
      const vignette = ctx.createRadialGradient(
        width / 2,
        height * 0.52,
        Math.min(width, height) * 0.24,
        width / 2,
        height * 0.52,
        Math.max(width, height) * 0.78
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.82)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      if (grain) {
        ctx.save();
        ctx.globalAlpha = 0.045;
        ctx.globalCompositeOperation = "overlay";
        const ox = (now * 0.08) % 128;
        const oy = (now * 0.11) % 128;
        ctx.drawImage(grain, -ox, -oy, width + 128, height + 128);
        ctx.restore();
      }
    };

    const render = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;

      const u = flight.u;
      speed = (u - renderedU) / dt;
      renderedU = u;

      // Bank into the turn: compare heading now against heading shortly ahead
      const here = pathTangent(path, u);
      const ahead = pathTangent(path, u + 0.8);
      const right = normalize(cross(vec(0, 1, 0), here));
      const turn = here.x * right.x + here.z * right.z - (ahead.x * right.x + ahead.z * right.z);
      const targetRoll = Math.max(-0.24, Math.min(0.24, turn * 3 + ahead.y * 0.1));
      roll += (targetRoll - roll) * Math.min(1, dt * 2.4);

      const camera = cameraAt(u);
      const vanishingPoint = project(camera, samplePath(path, u + 5.2));
      const vanishing = {
        x: vanishingPoint.depth > 0 ? vanishingPoint.x : width / 2,
        y: vanishingPoint.depth > 0 ? vanishingPoint.y : height * 0.42,
      };

      drawBackdrop(camera, vanishing);
      drawRoad(camera, u);
      drawDust(camera, u);

      // Far gates first so nearer ones overlap correctly
      for (let chapter = stops.length - 1; chapter >= 0; chapter -= 1) {
        drawGate(camera, chapter);
      }

      drawIcons(camera, u);
      drawPlane(camera, u, now);
      drawGrade(now);

      onProgressRef.current(Math.max(0, Math.min(1, u / endU)));

      frame = window.requestAnimationFrame(render);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    // Cinematic pacing: cruise between milestones, glide through each one.
    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        onPlayStateRef.current(false);
        onCompleteRef.current();
      },
    });

    timeline.addLabel("intro");
    timeline.to(flight, {
      u: gateIndex(0) - 1.5,
      duration: INTRO_DURATION,
      ease: "power1.in",
    });

    stops.forEach((_, chapter) => {
      timeline.addLabel(`chapter-${chapter}`);
      timeline.to(flight, {
        u: gateIndex(chapter) - 0.42,
        duration: TRAVEL_DURATION,
        ease: chapter === 0 ? "power1.out" : "power1.inOut",
      });
      timeline.to(flight, {
        u: gateIndex(chapter) + 1.15,
        duration: ARRIVAL_DURATION,
        ease: "power2.out",
        onStart: () => onChapterRef.current(chapter),
        onReverseComplete: () => onChapterRef.current(chapter),
      });
    });

    timeline.addLabel("outro");
    timeline.to(flight, {
      u: endU,
      duration: OUTRO_DURATION,
      ease: "power1.inOut",
    });

    const controls: FlightControls = {
      play: () => {
        timeline.play();
        onPlayStateRef.current(true);
      },
      pause: () => {
        timeline.pause();
        onPlayStateRef.current(false);
      },
      toggle: () => {
        const playing = timeline.paused();
        if (playing) {
          timeline.play();
        } else {
          timeline.pause();
        }
        onPlayStateRef.current(playing);
        return playing;
      },
      jumpToChapter: (index: number) => {
        const clamped = Math.max(0, Math.min(stops.length - 1, index));
        timeline.seek(`chapter-${clamped}`, false);
        timeline.play();
        onChapterRef.current(clamped);
        onPlayStateRef.current(true);
      },
      skipToEnd: () => {
        timeline.seek("outro", false);
        timeline.play();
        onChapterRef.current(stops.length - 1);
        onPlayStateRef.current(true);
      },
      restart: () => {
        timeline.seek(0, false);
        timeline.play();
        onChapterRef.current(-1);
        onPlayStateRef.current(true);
      },
    };

    controlsRef.current = controls;

    frame = window.requestAnimationFrame(render);
    // One frame of still road before the engine spools up reads as a held shot.
    const startTimer = window.setTimeout(() => {
      timeline.play();
      onPlayStateRef.current(true);
    }, 420);

    // Background tabs throttle rAF, so park the flight and pick it back up
    // exactly where it was when the viewer returns.
    let resumeOnReturn = false;
    const onVisibility = () => {
      if (document.hidden) {
        resumeOnReturn = !timeline.paused();
        timeline.pause();
        onPlayStateRef.current(false);
        return;
      }
      if (resumeOnReturn) {
        resumeOnReturn = false;
        timeline.play();
        onPlayStateRef.current(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(startTimer);
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      timeline.kill();
      controlsRef.current = null;
    };
  }, [stops, controlsRef]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
