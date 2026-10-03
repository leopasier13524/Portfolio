"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import type { PortfolioProject } from "@/content/portfolio";
import { ThemeBackdrop } from "./ThemeBackdrop";

type RectLike = { left: number; top: number; width: number; height: number };

type ProjectsGridViewProps = {
  projects: PortfolioProject[];
  active: boolean;
  onSelectProject: (
    project: PortfolioProject,
    rect: RectLike,
    previewSrc: string
  ) => void;
};

/** Trim summary to an 80–100 char outcome line at a word boundary. */
function outcomeLine(summary: string, max = 100, min = 80) {
  const trimmed = summary.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) {
    return trimmed;
  }
  const slice = trimmed.slice(0, max + 1);
  const breakAt = slice.lastIndexOf(" ");
  const cut = breakAt >= min ? breakAt : max;
  return `${trimmed.slice(0, cut).trimEnd()}…`;
}

export function ProjectsGridView({
  projects,
  active,
  onSelectProject,
}: ProjectsGridViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useSmoothScroll(rootRef, contentRef, { enabled: active });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const items = root.querySelectorAll("[data-grid-item]");
    gsap.killTweensOf(items);

    if (!active) {
      // Leave items painted so PortfolioExperience's opacity crossfade
      // can soft-fade grid↔list↔wall (no instant autoAlpha cut).
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(items, { autoAlpha: 1, y: 0, clearProps: "visibility" });
      return;
    }

    gsap.fromTo(
      items,
      { y: 12 },
      {
        y: 0,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.05,
      }
    );
  }, [active, projects]);

  return (
    <div
      ref={rootRef}
      className="relative z-10 h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain text-foreground"
    >
      <div className="relative min-h-full">
      <ThemeBackdrop active={active} surface="projects" />
      <div
        ref={contentRef}
        className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(3.25rem+env(safe-area-inset-top)))] md:px-10 md:pb-44 md:pt-24"
      >
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-7">
          {projects.map((project) => (
            <li key={project.slug} data-grid-item className="flex">
              <button
                type="button"
                onClick={(event) => {
                  const target = event.currentTarget;
                  const thumb = target.querySelector<HTMLElement>(
                    "[data-grid-thumb]"
                  );
                  const rect = (thumb ?? target).getBoundingClientRect();
                  onSelectProject(
                    project,
                    {
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                    },
                    project.heroImage
                  );
                }}
                className="group relative flex w-full cursor-pointer flex-col rounded-3xl border border-foreground/10 bg-background/[0.84] p-2.5 text-left outline-none backdrop-blur-md transition duration-300 active:opacity-80 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background md:p-3 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:border-foreground/25"
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(180deg, transparent 40%, ${project.accent}26 100%)`,
                  }}
                  aria-hidden
                />

                <span
                  data-grid-thumb
                  className="relative block aspect-[16/10] overflow-hidden rounded-2xl bg-foreground/5 ring-1 ring-foreground/10"
                >
                  <Image
                    src={project.heroImage}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 30vw"
                    className="object-cover opacity-[0.92] transition duration-500 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04] [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 motion-reduce:group-hover:scale-100"
                  />
                </span>

                <span className="relative flex flex-1 flex-col px-2.5 pb-3 pt-5 md:px-3.5 md:pb-4 md:pt-6">
                  <span className="flex items-start justify-between gap-4">
                    <span className="block text-xl font-semibold tracking-tight text-foreground/92 transition-colors duration-300 md:text-2xl [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-foreground">
                      {project.title}
                    </span>
                    <span
                      className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition duration-300 [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-foreground/40 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-foreground"
                      aria-hidden
                    >
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3 w-3 transition-transform duration-300 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-0.5"
                      >
                        <path
                          d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </span>
                  <span className="mt-2 block text-[10px] uppercase tracking-[0.28em] text-foreground/75">
                    {project.cardLabel}
                  </span>
                  <span className="mt-4 text-sm leading-relaxed text-foreground/72 line-clamp-2">
                    {outcomeLine(project.summary)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}
