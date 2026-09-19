const fs = require("fs");

const acHomeField = `"use client";

/**
 * AC Home Field SoT v1 — SVG only, no WebGL.
 * Visible on first paint (no opacity-0). Motion is additive.
 * Desktop: perimeter network (CLEAR).
 * Mobile (<md): gutter-only density + CSS content-mask so the
 * constellation never sits behind stacked portrait + primary copy.
 */

type FieldNode = {
  x: number;
  y: number;
  glyph?: "frame" | "pen" | "tag" | "brace" | "diamond";
};

/** Desktop / tablet perimeter set — keep clear of portrait + primary copy. */
const DESKTOP_NODES: FieldNode[] = [
  { x: 6, y: 5, glyph: "diamond" },
  { x: 22, y: 3.5 },
  { x: 48, y: 4.5, glyph: "tag" },
  { x: 72, y: 5 },
  { x: 94, y: 7, glyph: "frame" },
  { x: 97, y: 18 },
  { x: 98, y: 66, glyph: "brace" },
  { x: 93, y: 78 },
  { x: 78, y: 88, glyph: "pen" },
  { x: 54, y: 93 },
  { x: 32, y: 91 },
  { x: 10, y: 86, glyph: "diamond" },
  { x: 3, y: 68 },
  { x: 2.5, y: 42 },
  { x: 3.5, y: 18, glyph: "tag" },
  { x: 41, y: 80 },
  { x: 44, y: 90 },
  { x: 86, y: 70 },
  { x: 16, y: 78 },
  { x: 64, y: 84, glyph: "frame" },
];

const DESKTOP_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 13],
  [13, 14],
  [14, 0],
  [1, 14],
  [11, 18],
  [18, 15],
  [15, 16],
  [16, 9],
  [7, 17],
  [17, 19],
  [19, 8],
  [6, 17],
  [12, 18],
];

/**
 * Mobile gutter set — corners + side rails only.
 * Avoids center column where portrait (~top) and stacked copy sit.
 */
const MOBILE_NODES: FieldNode[] = [
  { x: 5, y: 4, glyph: "diamond" },
  { x: 18, y: 3 },
  { x: 82, y: 3.5 },
  { x: 95, y: 5, glyph: "frame" },
  { x: 97, y: 16 },
  { x: 96, y: 78, glyph: "brace" },
  { x: 88, y: 92 },
  { x: 12, y: 93, glyph: "pen" },
  { x: 4, y: 82 },
  { x: 3, y: 20, glyph: "tag" },
  { x: 6, y: 50 },
  { x: 94, y: 48 },
];

const MOBILE_EDGES: [number, number][] = [
  [0, 1],
  [1, 9],
  [9, 10],
  [10, 8],
  [8, 7],
  [2, 3],
  [3, 4],
  [4, 11],
  [11, 5],
  [5, 6],
  [0, 9],
  [3, 11],
];

function Glyph({
  type,
  x,
  y,
}: {
  type: NonNullable<FieldNode["glyph"]>;
  x: number;
  y: number;
}) {
  const s = 1.6;
  switch (type) {
    case "frame":
      return (
        <rect
          x={x - s}
          y={y - s * 0.7}
          width={s * 2}
          height={s * 1.4}
          rx={0.15}
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={0.12}
        />
      );
    case "pen":
      return (
        <path
          d={\`M \${x - s} \${y + s * 0.6} L \${x - 0.2} \${y - s} L \${x + 0.35} \${y - s * 0.65} L \${x - s + 0.55} \${y + s * 0.85} Z\`}
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={0.12}
        />
      );
    case "tag":
      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.28)"
          fontSize="1.35"
          fontFamily="ui-monospace, monospace"
        >
          {"</>"}
        </text>
      );
    case "brace":
      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.28)"
          fontSize="1.5"
          fontFamily="ui-monospace, monospace"
        >
          {"{}"}
        </text>
      );
    case "diamond":
      return (
        <path
          d={\`M \${x} \${y - s} L \${x + s * 0.7} \${y} L \${x} \${y + s} L \${x - s * 0.7} \${y} Z\`}
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={0.12}
        />
      );
    default:
      return null;
  }
}

function FieldGraph({
  nodes,
  edges,
  variant,
}: {
  nodes: FieldNode[];
  edges: [number, number][];
  variant: "desktop" | "mobile";
}) {
  return (
    <g
      className={
        variant === "desktop"
          ? "ac-home-field__graph ac-home-field__graph--desktop"
          : "ac-home-field__graph ac-home-field__graph--mobile"
      }
    >
      {edges.map(([a, b], i) => (
        <line
          key={\`\${variant}-e-\${i}\`}
          className="ac-home-field__edge"
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={0.08}
          style={{ animationDelay: \`\${i * 28}ms\` }}
        />
      ))}
      {nodes.map((node, i) => (
        <g
          key={\`\${variant}-n-\${i}\`}
          className="ac-home-field__node"
          style={{ animationDelay: \`\${80 + i * 36}ms\` }}
        >
          <circle
            cx={node.x}
            cy={node.y}
            r={0.38}
            fill="rgba(255,255,255,0.34)"
          />
          {node.glyph ? <Glyph type={node.glyph} x={node.x} y={node.y} /> : null}
        </g>
      ))}
    </g>
  );
}

export function AcHomeField() {
  return (
    <div
      className="ac-home-field pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="ac-home-field__glow absolute inset-0" />
      {/* Mobile content mask — clears portrait + stacked copy column; does not touch type. */}
      <div className="ac-home-field__content-mask absolute inset-0 md:hidden" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <FieldGraph
          nodes={DESKTOP_NODES}
          edges={DESKTOP_EDGES}
          variant="desktop"
        />
        <FieldGraph
          nodes={MOBILE_NODES}
          edges={MOBILE_EDGES}
          variant="mobile"
        />
      </svg>
    </div>
  );
}
`;

fs.writeFileSync("src/components/AcHomeField.tsx", acHomeField);

let css = fs.readFileSync("src/app/globals.css", "utf8");

const extraCss = `
/* AC Field: desktop graph default; mobile gutter graph + content mask */
.ac-home-field__graph--mobile {
  display: none;
}

.ac-home-field__content-mask {
  display: none;
}

@media (max-width: 767px) {
  .ac-home-field__graph--desktop {
    display: none;
  }

  .ac-home-field__graph--mobile {
    display: inline;
  }

  /* Punch out the stacked portrait + primary-copy column so the
     constellation cannot sit behind type (field only — type stays opaque). */
  .ac-home-field {
    -webkit-mask-image: linear-gradient(
        to right,
        #000 0%,
        #000 10%,
        transparent 18%,
        transparent 82%,
        #000 90%,
        #000 100%
      ),
      linear-gradient(
        to bottom,
        #000 0%,
        #000 6%,
        transparent 14%,
        transparent 72%,
        #000 82%,
        #000 100%
      );
    mask-image: linear-gradient(
        to right,
        #000 0%,
        #000 10%,
        transparent 18%,
        transparent 82%,
        #000 90%,
        #000 100%
      ),
      linear-gradient(
        to bottom,
        #000 0%,
        #000 6%,
        transparent 14%,
        transparent 72%,
        #000 82%,
        #000 100%
      );
    -webkit-mask-composite: source-in;
    mask-composite: intersect;
  }

  .ac-home-field__glow {
    background: radial-gradient(55% 40% at 8% 8%, rgba(255,255,255,0.05), transparent 55%),
      radial-gradient(50% 35% at 92% 90%, rgba(255,255,255,0.04), transparent 50%);
  }
}
`;

if (!css.includes("ac-home-field__graph--mobile")) {
  css = css.replace(/\s*$/, "\n" + extraCss);
  fs.writeFileSync("src/app/globals.css", css);
  console.log("css: appended mobile mask");
} else {
  console.log("css: already present");
}

console.log("AcHomeField written");
