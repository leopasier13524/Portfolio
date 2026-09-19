"use client";

import { useEffect, useRef } from "react";

/**
 * AC Home Field v2 — animated canvas constellation.
 *
 * Nodes drift on slow sine wander and link to whatever neighbour is currently
 * in range, so the lattice keeps redrawing itself instead of holding one fixed
 * shape. Design/code glyphs ride a third of the nodes, and "data" pulses run
 * along live links (Animus-style).
 *
 * Contrast rules: strokes stay under ~0.2 alpha and a radial CSS mask dims the
 * middle of the field, so copy on top never fights the pattern.
 */

type GlyphKind =
  | "text"
  | "frame"
  | "bezier"
  | "pen"
  | "layers"
  | "grid"
  | "diamond";

const GLYPH_TEXT = [
  "</>",
  "{ }",
  "[ ]",
  "( )",
  "=>",
  "#",
  ";",
  "px",
  "%",
  "Aa",
  "01",
  "/*",
];

const VECTOR_GLYPHS: GlyphKind[] = [
  "frame",
  "bezier",
  "pen",
  "layers",
  "grid",
  "diamond",
];

type FieldNode = {
  bx: number;
  by: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phx: number;
  phy: number;
  depth: number;
  x: number;
  y: number;
  glyph: GlyphKind | null;
  text: string;
  rot: number;
  scale: number;
  /** Stagger offset (seconds) for the deploy reveal */
  delay: number;
};

type Pulse = {
  a: number;
  b: number;
  t: number;
  speed: number;
};

type Scan = {
  node: number;
  t: number;
};

const REVEAL_DURATION = 1.15;

function makeNodes(width: number, height: number, narrow: boolean) {
  // Jittered grid keeps spacing even — random scatter clumps and reads as noise.
  const cell = narrow ? 128 : 136;
  const cols = Math.max(3, Math.ceil(width / cell) + 1);
  const rows = Math.max(3, Math.ceil(height / cell) + 1);
  const nodes: FieldNode[] = [];
  let index = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const jx = (Math.random() - 0.5) * cell * 0.72;
      const jy = (Math.random() - 0.5) * cell * 0.72;
      const bx = (col + 0.5) * (width / (cols - 1 || 1)) + jx;
      const by = (row + 0.5) * (height / (rows - 1 || 1)) + jy;

      // Glyph on roughly a third of nodes, alternating text and vector marks.
      const roll = Math.random();
      let glyph: GlyphKind | null = null;
      if (roll < 0.17) {
        glyph = "text";
      } else if (roll < 0.34) {
        glyph = VECTOR_GLYPHS[index % VECTOR_GLYPHS.length];
      }

      nodes.push({
        bx,
        by,
        ax: 8 + Math.random() * 16,
        ay: 6 + Math.random() * 14,
        fx: 0.045 + Math.random() * 0.06,
        fy: 0.04 + Math.random() * 0.055,
        phx: Math.random() * Math.PI * 2,
        phy: Math.random() * Math.PI * 2,
        depth: 0.5 + Math.random() * 0.5,
        x: bx,
        y: by,
        glyph,
        text: GLYPH_TEXT[Math.floor(Math.random() * GLYPH_TEXT.length)],
        rot: (Math.random() - 0.5) * 0.5,
        scale: 0.85 + Math.random() * 0.5,
        delay: Math.random() * 0.75,
      });
      index += 1;
    }
  }

  return { nodes, linkRange: cell * 1.5 };
}

function drawVectorGlyph(
  ctx: CanvasRenderingContext2D,
  node: FieldNode,
  alpha: number
) {
  const s = 7 * node.scale;
  ctx.save();
  ctx.translate(node.x, node.y);
  ctx.rotate(node.rot);
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 0.9;
  ctx.beginPath();

  switch (node.glyph) {
    case "frame": {
      ctx.rect(-s, -s * 0.7, s * 2, s * 1.4);
      ctx.stroke();
      // corner ticks
      ctx.beginPath();
      ctx.moveTo(-s - 2.5, -s * 0.7);
      ctx.lineTo(-s + 2.5, -s * 0.7);
      ctx.moveTo(s - 2.5, s * 0.7);
      ctx.lineTo(s + 2.5, s * 0.7);
      ctx.stroke();
      break;
    }
    case "bezier": {
      ctx.moveTo(-s, s * 0.6);
      ctx.bezierCurveTo(-s * 0.3, -s * 1.1, s * 0.3, s * 1.1, s, -s * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-s, s * 0.6, 1.2, 0, Math.PI * 2);
      ctx.arc(s, -s * 0.6, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
      break;
    }
    case "pen": {
      ctx.moveTo(-s * 0.55, s * 0.8);
      ctx.lineTo(0, -s);
      ctx.lineTo(s * 0.55, s * 0.8);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, s * 0.25);
      ctx.lineTo(s * 0.3, s * 0.25);
      ctx.stroke();
      break;
    }
    case "layers": {
      for (let i = 0; i < 3; i += 1) {
        const o = (i - 1) * 2.6;
        ctx.rect(-s * 0.8 + o, -s * 0.5 + o, s * 1.6, s);
      }
      ctx.stroke();
      break;
    }
    case "grid": {
      const g = s * 0.62;
      ctx.rect(-g * 1.15, -g * 1.15, g, g);
      ctx.rect(g * 0.15, -g * 1.15, g, g);
      ctx.rect(-g * 1.15, g * 0.15, g, g);
      ctx.rect(g * 0.15, g * 0.15, g, g);
      ctx.stroke();
      break;
    }
    case "diamond": {
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    default:
      break;
  }

  ctx.restore();
}

export function AcHomeField({ active = true }: { active?: boolean }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  const controlsRef = useRef<{ start: () => void; stop: () => void } | null>(
    null
  );

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let nodes: FieldNode[] = [];
    let linkRange = 200;
    let pulses: Pulse[] = [];
    let scans: Scan[] = [];
    let frame = 0;
    let startedAt = performance.now();
    let lastFrameAt = startedAt;
    let lastSpawn = 0;
    let lastScan = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const build = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const built = makeNodes(width, height, width < 768);
      nodes = built.nodes;
      linkRange = built.linkRange;
      pulses = [];
      scans = [];
      startedAt = performance.now();
    };

    const render = (now: number) => {
      const t = (now - startedAt) / 1000;
      const dt = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1000));
      lastFrameAt = now;
      const reveal = reduced
        ? 1
        : Math.min(1, Math.max(0, t / REVEAL_DURATION));

      // Pointer parallax easing (no-op on touch, where pointer never moves)
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;

      ctx.clearRect(0, 0, width, height);

      for (const node of nodes) {
        const wander = reduced ? 0 : 1;
        node.x =
          node.bx +
          Math.sin(t * node.fx * Math.PI * 2 + node.phx) * node.ax * wander +
          pointer.x * (0.4 + node.depth * 0.8) * 14;
        node.y =
          node.by +
          Math.cos(t * node.fy * Math.PI * 2 + node.phy) * node.ay * wander +
          pointer.y * (0.4 + node.depth * 0.8) * 10;
      }

      // Live links: whatever is in range right now, capped per node so the
      // lattice stays graphic instead of turning into a cobweb.
      const linked: number[][] = nodes.map(() => []);
      ctx.lineCap = "round";

      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > linkRange) {
            continue;
          }
          if (linked[i].length >= 4 || linked[j].length >= 4) {
            continue;
          }

          linked[i].push(j);
          linked[j].push(i);

          const falloff = 1 - dist / linkRange;
          const nodeReveal = Math.min(
            1,
            Math.max(0, (t - a.delay) / REVEAL_DURATION)
          );
          const alpha =
            falloff *
            0.17 *
            (0.55 + ((a.depth + b.depth) / 2) * 0.45) *
            (reduced ? 1 : nodeReveal) *
            reveal;

          if (alpha <= 0.004) {
            continue;
          }

          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Faint triangle washes where three nodes mutually connect — the
      // "surveyed plate" look from the Animus menus.
      for (let i = 0; i < nodes.length; i += 1) {
        const neighbours = linked[i];
        for (let m = 0; m < neighbours.length; m += 1) {
          for (let n = m + 1; n < neighbours.length; n += 1) {
            const j = neighbours[m];
            const k = neighbours[n];
            if (j < i || k < i || !linked[j].includes(k)) {
              continue;
            }
            ctx.fillStyle = `rgba(255,255,255,${0.014 * reveal})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.lineTo(nodes[k].x, nodes[k].y);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // Nodes + glyphs
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const node of nodes) {
        const nodeReveal = reduced
          ? 1
          : Math.min(1, Math.max(0, (t - node.delay) / REVEAL_DURATION));
        if (nodeReveal <= 0) {
          continue;
        }
        const base = (0.16 + node.depth * 0.26) * nodeReveal * reveal;

        ctx.fillStyle = `rgba(255,255,255,${base + 0.06})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.05 + node.depth * 0.55, 0, Math.PI * 2);
        ctx.fill();

        if (!node.glyph) {
          continue;
        }

        if (node.glyph === "text") {
          ctx.save();
          ctx.translate(node.x, node.y - 13 * node.scale);
          ctx.rotate(node.rot * 0.4);
          ctx.fillStyle = `rgba(255,255,255,${base * 0.92})`;
          ctx.font = `${Math.round(11 * node.scale)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.fillText(node.text, 0, 0);
          ctx.restore();
        } else {
          drawVectorGlyph(ctx, node, base * 0.85);
        }
      }

      if (!reduced) {
        // Data pulses along live links
        if (now - lastSpawn > 520 && pulses.length < 14) {
          lastSpawn = now;
          const from = Math.floor(Math.random() * nodes.length);
          const options = linked[from];
          if (options && options.length > 0) {
            pulses.push({
              a: from,
              b: options[Math.floor(Math.random() * options.length)],
              t: 0,
              speed: 0.24 + Math.random() * 0.4,
            });
          }
        }

        pulses = pulses.filter((pulse) => {
          const a = nodes[pulse.a];
          const b = nodes[pulse.b];
          if (!a || !b) {
            return false;
          }
          pulse.t += pulse.speed * dt;
          if (pulse.t >= 1) {
            return false;
          }
          const x = a.x + (b.x - a.x) * pulse.t;
          const y = a.y + (b.y - a.y) * pulse.t;
          const fade = Math.sin(pulse.t * Math.PI);
          ctx.fillStyle = `rgba(255,255,255,${0.42 * fade * reveal})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${0.12 * fade * reveal})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(x, y, 3.6, 0, Math.PI * 2);
          ctx.stroke();
          return true;
        });

        // Scan rings: a node gets "read" now and then
        if (now - lastScan > 2600 && scans.length < 3) {
          lastScan = now;
          scans.push({
            node: Math.floor(Math.random() * nodes.length),
            t: 0,
          });
        }

        scans = scans.filter((scan) => {
          const node = nodes[scan.node];
          if (!node) {
            return false;
          }
          scan.t += dt * 0.38;
          if (scan.t >= 1) {
            return false;
          }
          const radius = 4 + scan.t * 26;
          const fade = (1 - scan.t) * 0.28 * reveal;
          ctx.strokeStyle = `rgba(255,255,255,${fade})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          return true;
        });
      }

      if (reduced) {
        return;
      }

      frame = window.requestAnimationFrame(render);
    };

    let pausedAt = 0;

    const start = () => {
      if (frame || reduced) {
        return;
      }
      // Shift the clock by the paused span so wander resumes where it left off.
      if (pausedAt) {
        const paused = performance.now() - pausedAt;
        startedAt += paused;
        pausedAt = 0;
      }
      lastFrameAt = performance.now();
      frame = window.requestAnimationFrame(render);
    };

    const stop = () => {
      if (!frame) {
        return;
      }
      window.cancelAnimationFrame(frame);
      frame = 0;
      pausedAt = performance.now();
    };

    controlsRef.current = { start, stop };

    build();
    if (reduced) {
      render(performance.now());
    } else {
      start();
    }

    const onResize = () => {
      build();
      if (reduced) {
        render(performance.now());
      }
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(wrap);

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }
      pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    const onVisibility = () => {
      if (document.hidden || !activeRef.current) {
        stop();
      } else {
        start();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      controlsRef.current = null;
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Home is one of several stacked views — don't burn frames while it's hidden.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    if (active) {
      controls.start();
    } else {
      controls.stop();
    }
  }, [active]);

  return (
    <div
      ref={wrapRef}
      className="ac-home-field pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="ac-home-field__glow absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
