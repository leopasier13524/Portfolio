"use client";

import type { ReactNode } from "react";

export type ProjectsLayout = "grid" | "list" | "wall";

type ProjectsViewToggleProps = {
  layout: ProjectsLayout;
  onChange: (layout: ProjectsLayout) => void;
  hidden?: boolean;
  /** When true, hide Explore (wall) — used for prefers-reduced-motion. */
  hideWall?: boolean;
};

export function ProjectsViewToggle({
  layout,
  onChange,
  hidden = false,
  hideWall = false,
}: ProjectsViewToggleProps) {
  return (
    <div
      className={`pointer-events-auto fixed left-4 z-30 transition-all duration-500 md:left-8 ${
        hidden
          ? "pointer-events-none translate-y-3 opacity-0"
          : "translate-y-0 opacity-100"
      } bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-8`}
      aria-hidden={hidden || undefined}
      {...(hidden ? { inert: true } : {})}
    >
      <div
        role="group"
        aria-label="Projects layout"
        className="flex items-center gap-0.5 rounded-full border border-white/20 bg-white/25 p-1 backdrop-blur-md"
      >
        {!hideWall ? (
          <ToggleButton
            label="Explore"
            title="Explore view"
            pressed={layout === "wall"}
            hidden={hidden}
            onClick={() => onChange("wall")}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
              <rect x="1.25" y="1.25" width="5.5" height="5.5" rx="0.7" fill="currentColor" />
              <rect x="9.25" y="1.25" width="5.5" height="5.5" rx="0.7" fill="currentColor" />
              <rect x="1.25" y="9.25" width="5.5" height="5.5" rx="0.7" fill="currentColor" />
              <rect x="9.25" y="9.25" width="5.5" height="5.5" rx="0.7" fill="currentColor" />
            </svg>
          </ToggleButton>
        ) : null}
        <ToggleButton
          label="List"
          title="List view"
          pressed={layout === "list"}
          hidden={hidden}
          onClick={() => onChange("list")}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
            <rect x="1.25" y="2.4" width="13.5" height="1.7" rx="0.6" fill="currentColor" />
            <rect x="1.25" y="7.15" width="13.5" height="1.7" rx="0.6" fill="currentColor" />
            <rect x="1.25" y="11.9" width="13.5" height="1.7" rx="0.6" fill="currentColor" />
          </svg>
        </ToggleButton>
        <ToggleButton
          label="Grid"
          title="Grid view"
          pressed={layout === "grid"}
          hidden={hidden}
          onClick={() => onChange("grid")}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
            <rect x="1.2" y="1.4" width="3.8" height="5.2" rx="0.55" fill="currentColor" />
            <rect x="6.1" y="1.4" width="3.8" height="5.2" rx="0.55" fill="currentColor" />
            <rect x="11" y="1.4" width="3.8" height="5.2" rx="0.55" fill="currentColor" />
            <rect x="1.2" y="9.4" width="3.8" height="5.2" rx="0.55" fill="currentColor" />
            <rect x="6.1" y="9.4" width="3.8" height="5.2" rx="0.55" fill="currentColor" />
            <rect x="11" y="9.4" width="3.8" height="5.2" rx="0.55" fill="currentColor" />
          </svg>
        </ToggleButton>
      </div>
    </div>
  );
}

function ToggleButton({
  label,
  title,
  pressed,
  hidden = false,
  onClick,
  children,
}: {
  label: string;
  title: string;
  pressed: boolean;
  hidden?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      aria-pressed={pressed}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      onClick={onClick}
      className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full text-[10px] uppercase tracking-[0.22em] transition-all duration-300 md:min-h-10 md:min-w-10 ${
        pressed
          ? "bg-white px-3 text-black md:px-3.5"
          : "px-2.5 text-white/85 hover:text-white md:px-2.5"
      }`}
    >
      {children}
      {pressed ? <span>{label}</span> : null}
    </button>
  );
}
