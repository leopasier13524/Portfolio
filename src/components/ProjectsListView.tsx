"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import type { PortfolioProject } from "@/content/portfolio";

type ProjectsListViewProps = {
  projects: PortfolioProject[];
  active: boolean;
  onSelectProject: (project: PortfolioProject) => void;
};

function groupProjectsByYear(projects: PortfolioProject[]) {
  const groups = new Map<string, PortfolioProject[]>();

  for (const project of projects) {
    const group = groups.get(project.year) ?? [];
    group.push(project);
    groups.set(project.year, group);
  }

  return [...groups.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
}

export function ProjectsListView({
  projects,
  active,
  onSelectProject,
}: ProjectsListViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useSmoothScroll(rootRef, contentRef, { enabled: active });

  const groups = useMemo(() => groupProjectsByYear(projects), [projects]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const items = root.querySelectorAll("[data-list-item]");
    gsap.killTweensOf(items);

    if (!active) {
      // Leave items painted so PortfolioExperience's opacity crossfade
      // can soft-fade wall↔list (no instant autoAlpha cut).
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(items, { autoAlpha: 1, y: 0, clearProps: "visibility" });
      return;
    }

    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.05,
      }
    );
  }, [active]);

  return (
    <div
      ref={rootRef}
      className="relative z-10 h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-black text-white"
    >
      <div
        ref={contentRef}
        className="mx-auto w-full max-w-6xl px-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(3.25rem+env(safe-area-inset-top)))] md:px-10 md:pb-44 md:pt-24"
      >
        <div
          data-list-item
          className="flex items-end justify-between gap-4 opacity-0"
        >
          <p className="text-[10px] uppercase tracking-[0.42em] text-white/65">
            All projects
          </p>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/65">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>

        <div className="mt-8 space-y-12 md:mt-12 md:space-y-16">
          {groups.map(([year, yearProjects]) => (
            <section key={year}>
              <p
                data-list-item
                className="text-xs uppercase tracking-[0.36em] text-white/65 opacity-0"
              >
                {year}
              </p>

              <ul className="mt-3 divide-y divide-white/10 border-y border-white/10">
                {yearProjects.map((project) => (
                  <li key={project.slug} data-list-item className="opacity-0">
                    <button
                      type="button"
                      onClick={() => onSelectProject(project)}
                      className="group relative flex w-full cursor-pointer items-center gap-4 px-2 py-5 text-left transition-colors duration-300 md:gap-8 md:px-3 md:py-7"
                    >
                      <span
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{
                          background: `linear-gradient(90deg, ${project.accent}2e, ${project.accent}12 42%, transparent)`,
                        }}
                        aria-hidden
                      />
                      <span
                        className="pointer-events-none absolute inset-y-2 left-0 w-[2px] origin-center scale-y-0 rounded-full transition-transform duration-300 group-hover:scale-y-100"
                        style={{ backgroundColor: project.accent }}
                        aria-hidden
                      />

                      <span
                        data-list-thumb
                        className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-sm bg-white/5 ring-0 ring-white/0 transition duration-300 group-hover:ring-2 group-hover:ring-white/25 sm:block md:h-[4.75rem] md:w-32"
                        aria-hidden
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={project.heroImage}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-[1.06] group-hover:opacity-100"
                        />
                      </span>

                      <span className="relative min-w-0 flex-1">
                        <span className="block text-2xl font-semibold tracking-tight text-white/92 transition-colors duration-300 group-hover:text-white sm:text-3xl md:text-5xl">
                          {project.title}
                        </span>
                        <span className="mt-2 block text-[10px] uppercase tracking-[0.28em] text-white/65 md:hidden">
                          {project.cardLabel}
                        </span>
                      </span>

                      <span className="relative hidden shrink-0 text-right text-[10px] uppercase tracking-[0.28em] text-white/65 transition-colors duration-300 group-hover:text-white/80 md:block">
                        {project.cardLabel}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
