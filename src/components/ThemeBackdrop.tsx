"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_THEME,
  isThemeId,
  seasonalTheme,
  subscribeTheme,
  type ThemeId,
} from "@/lib/themes";

type ThemeSurface = "home" | "projects" | "contact" | "overlay";

type ThemeBackdropProps = {
  active?: boolean;
  surface?: ThemeSurface;
  /** Lock to the screen. Used behind the loading intro. */
  fixed?: boolean;
  /** Falling snow, stars, and dust. Off for the intro plate. */
  particles?: boolean;
};

type ParticleKind = "snow" | "star";

type Particle = {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
  alpha: number;
  kind: ParticleKind;
};

function outsideType(x: number, y: number, width: number, height: number) {
  const column = Math.min(640, width * 0.42);
  const left = (width - column) / 2;
  return !(x > left && x < left + column && y > height * 0.08 && y < height * 0.74);
}

function place(kind: ParticleKind, width: number, height: number): Particle {
  let x = Math.random() * width;
  let y = Math.random() * height;
  if (!outsideType(x, y, width, height)) {
    x = Math.random() < 0.5 ? width * (0.02 + Math.random() * 0.16) : width * (0.82 + Math.random() * 0.16);
    y = height * (0.12 + Math.random() * 0.7);
  }
  const phase = Math.random() * Math.PI * 2;

  if (kind === "snow") {
    return {
      x,
      y,
      phase,
      kind,
      r: 0.7 + Math.random() * 1.5,
      speed: 0.22 + Math.random() * 0.55,
      drift: 0.08 + Math.random() * 0.22,
      alpha: 0.28 + Math.random() * 0.32,
    };
  }
  return {
    x,
    y,
    phase,
    kind,
    r: 0.4 + Math.random() * 0.85,
    speed: 0,
    drift: 0,
    alpha: 0.16 + Math.random() * 0.28,
  };
}

function spawnParticles(theme: ThemeId, width: number, height: number) {
  const scale = width < 768 ? 0.55 : 1;
  const kind: ParticleKind = theme === "christmas" ? "snow" : "star";
  const amount = Math.round((kind === "snow" ? 110 : 22) * scale);
  return Array.from({ length: amount }, () => place(kind, width, height));
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  now: number,
  reduced: boolean
) {
  if (particle.kind === "star") {
    const twinkle = reduced
      ? 0.7
      : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.003 + particle.phase));
    ctx.fillStyle = `rgba(232,236,244,${particle.alpha * twinkle})`;
  } else {
    ctx.fillStyle = `rgba(255,255,255,${particle.alpha})`;
  }
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
  ctx.fill();
}

function Sky() {
  return <div className="theme-sky__grain" />;
}

export function ThemeBackdrop({
  active = true,
  surface = "home",
  fixed = false,
  particles = true,
}: ThemeBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const read = () => {
      const current = document.documentElement.dataset.theme;
      setThemeId(isThemeId(current) ? current : seasonalTheme());
    };
    read();
    return subscribeTheme(read);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !particles) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let field: Particle[] = [];
    let frame = 0;
    let last = performance.now();

    const build = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = height > 2200 ? 1 : Math.min(1.25, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field = spawnParticles(themeId, width, height);
    };

    const draw = (now: number) => {
      const dt = Math.min(2.4, (now - last) / 16.67);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const particle of field) {
        if (!reduced && particle.speed !== 0) {
          particle.y += particle.speed * dt;
          particle.x += Math.sin(now * 0.001 + particle.phase) * particle.drift * dt;
          if (particle.y > height + 12) {
            particle.y = -12;
            particle.x = Math.random() * width;
          }
          if (particle.y < -12) {
            particle.y = height + 12;
            particle.x = Math.random() * width;
          }
          if (particle.x < -16) particle.x = width + 16;
          if (particle.x > width + 16) particle.x = -16;
        }
        if (!outsideType(particle.x, particle.y, width, height)) continue;
        drawParticle(ctx, particle, now, reduced);
      }
    };

    const loop = (now: number) => {
      draw(now);
      if (!reduced) frame = window.requestAnimationFrame(loop);
    };

    build();
    if (active) {
      last = performance.now();
      loop(last);
    }

    const onResize = () => {
      build();
      if (reduced || !active) draw(performance.now());
    };

    const parent = canvas.parentElement;
    const observer = new ResizeObserver(onResize);
    if (parent) observer.observe(parent);
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [active, particles, themeId]);

  return (
    <div
      className={`theme-backdrop pointer-events-none${fixed ? " theme-backdrop--fixed" : ""}`}
      data-scene={themeId}
      data-surface={surface}
      aria-hidden
    >
      <div className="theme-sky__photo" />
      <div className="theme-sky__veil" />
      <Sky />
      {particles ? (
        <canvas ref={canvasRef} className="theme-sky__particles absolute inset-0 h-full w-full" />
      ) : null}
    </div>
  );
}
