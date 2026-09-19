"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import type { PortfolioProject } from "@/content/portfolio";

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
      { autoAlpha: 0, y: 12 },
      {
        autoAlpha: 1,
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
      className="relative z-10 h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-black text-white"
    >
      <div
        ref={contentRef}
        className="mx-auto w-full max-w-6xl px-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(3.25rem+env(safe-area-inset-top)))] md:px-10 md:pb-44 md:pt-24"
      >
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.slug} data-grid-item className="opacity-0">
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
                className="group relative w-full cursor-pointer rounded-sm text-left outline-none transition-opacity duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-sm opacity-0 transition-opacity duration-300 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(180deg, transparent 35%, ${project.accent}2e 100%)`,
                  }}
                  aria-hidden
                />

                <span
                  data-grid-thumb
                  className="relative block aspect-[16/10] overflow-hidden rounded-sm bg-white/5 ring-1 ring-white/10"
                >
                  <Image
                    src={project.heroImage}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 30vw"
                    className="object-cover opacity-[0.88] transition duration-300 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04] [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 motion-reduce:group-hover:scale-100"
                  />
                </span>

                <span className="relative mt-3 block space-y-1.5">
                  <span className="block text-lg font-semibold tracking-tight text-white/92 transition-colors duration-300 md:text-xl [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white">
                    {project.title}
                  </span>
                  <span className="block text-[10px] uppercase tracking-[0.28em] text-white/75">
                    {project.cardLabel}
                  </span>
                  <span className="block text-sm leading-snug text-white/70 line-clamp-2">
                    {outcomeLine(project.summary)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
