"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import type { PortfolioProject } from "@/content/portfolio";
import { ThemeBackdrop } from "./ThemeBackdrop";

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
      { y: 18 },
      {
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
      className="relative z-10 h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain text-foreground"
    >
      <div className="relative min-h-full">
      <ThemeBackdrop active={active} surface="projects" />
      <div
        ref={contentRef}
        className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(3.25rem+env(safe-area-inset-top)))] md:px-10 md:pb-44 md:pt-24"
      >
        <div
          data-list-item
          className="flex items-end justify-between gap-4"
        >
          <p className="text-[10px] uppercase tracking-[0.42em] text-foreground">
            All projects
          </p>
          <p className="text-[10px] uppercase tracking-[0.28em] text-foreground">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>

        <div className="mt-8 space-y-10 md:mt-12 md:space-y-14">
          {groups.map(([year, yearProjects]) => (
            <section key={year}>
              <div data-list-item className="flex items-center gap-4">
                <p className="text-xs uppercase tracking-[0.36em] text-foreground">
                  {year}
                </p>
                <span className="h-px flex-1 bg-foreground/12" aria-hidden />
              </div>

              <ul className="mt-4 space-y-3 md:mt-5 md:space-y-4">
                {yearProjects.map((project) => (
                  <li key={project.slug} data-list-item>
                    <button
                      type="button"
                      onClick={() => onSelectProject(project)}
                      className="group relative flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-3xl border border-foreground/10 bg-background/[0.84] p-3 text-left backdrop-blur-md transition duration-300 hover:border-foreground/25 sm:gap-6 sm:p-4 md:gap-8 md:p-5 md:pr-7"
                    >
                      <span
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{
                          background: `linear-gradient(90deg, ${project.accent}2e, ${project.accent}12 42%, transparent)`,
                        }}
                        aria-hidden
                      />
                      <span
                        className="pointer-events-none absolute inset-y-5 left-0 w-[3px] origin-center scale-y-0 rounded-r-full transition-transform duration-300 group-hover:scale-y-100"
                        style={{ backgroundColor: project.accent }}
                        aria-hidden
                      />

                      <span
                        data-list-thumb
                        className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-foreground/5 ring-1 ring-foreground/10 transition duration-300 group-hover:ring-foreground/30 sm:block md:h-20 md:w-32"
                        aria-hidden
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={project.heroImage}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.06] group-hover:opacity-100"
                        />
                      </span>

                      <span className="relative min-w-0 flex-1 py-1 pl-1 sm:pl-0">
                        <span className="block text-2xl font-semibold tracking-tight text-foreground/92 transition-colors duration-300 group-hover:text-foreground sm:text-3xl md:text-4xl">
                          {project.title}
                        </span>
                        <span className="mt-2 block text-[10px] uppercase tracking-[0.28em] text-foreground/80 md:hidden">
                          {project.cardLabel}
                        </span>
                      </span>

                      <span className="relative hidden shrink-0 rounded-full border border-foreground/15 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.24em] text-foreground/85 transition-colors duration-300 group-hover:border-foreground/35 group-hover:text-foreground md:block">
                        {project.cardLabel}
                      </span>

                      <span
                        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition duration-300 group-hover:border-foreground/40 group-hover:text-foreground"
                        aria-hidden
                      >
                        <svg
                          viewBox="0 0 12 12"
                          className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
                        >
                          <path
                            d="M2.5 6h7M6.5 3l3 3-3 3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
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
    </div>
  );
}
