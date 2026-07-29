"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { projects } from "@/content/portfolio";
import { BottomNav, type AppView } from "./BottomNav";
import { ContactView } from "./ContactView";
import { HomeView } from "./HomeView";
import { ProjectDetailOverlay, type CardScreenRect } from "./ProjectDetailOverlay";
import { SpaceField } from "./SpaceField";
import { SplashIntro } from "./SplashIntro";

const SphereGallery = dynamic(
  () => import("./SphereGallery").then((mod) => mod.SphereGallery),
  { ssr: false }
);

function viewLayerClass(isActive: boolean) {
  return isActive
    ? "visible opacity-100 pointer-events-auto"
    : "hidden opacity-0 pointer-events-none";
}

function projectsLayerClass(isActive: boolean) {
  return `fixed inset-0 z-20 will-change-[opacity] ${
    isActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
  }`;
}

export function PortfolioExperience() {
  const [introDone, setIntroDone] = useState(false);
  const [splashMounted, setSplashMounted] = useState(true);
  const [navView, setNavView] = useState<AppView>("home");
  const [contentView, setContentView] = useState<AppView>("home");
  const [galleryMounted, setGalleryMounted] = useState(false);
  const splashRootRef = useRef<HTMLDivElement | null>(null);
  const homeRootRef = useRef<HTMLDivElement | null>(null);
  const contentFrameRef = useRef<number | null>(null);
  const [activeProjectSlug, setActiveProjectSlug] = useState<string | null>(null);
  const [projectFromRect, setProjectFromRect] = useState<CardScreenRect | null>(
    null
  );
  const [projectPreviewSrc, setProjectPreviewSrc] = useState<string | null>(
    null
  );

  const activeProject = useMemo(
    () => projects.find((project) => project.slug === activeProjectSlug) ?? null,
    [activeProjectSlug]
  );

  const projectOpen = activeProjectSlug !== null;
  const projectsVisible = contentView === "projects";
  const projectsHintRef = useRef<HTMLDivElement | null>(null);

  const mountGallery = () => {
    void import("./SphereGallery");
    setGalleryMounted(true);
  };

  useEffect(() => {
    const preloadChunk = () => {
      void import("./SphereGallery");
    };

    const schedulePreload = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(preloadChunk, { timeout: 4000 });
        return;
      }

      setTimeout(preloadChunk, 1500);
    };

    if (document.readyState === "complete") {
      schedulePreload();
      return;
    }

    const onLoad = () => {
      schedulePreload();
    };

    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  useEffect(() => {
    const hint = projectsHintRef.current;
    if (!hint || !projectsVisible || projectOpen) {
      return;
    }

    gsap.killTweensOf(hint);
    gsap.fromTo(
      hint,
      { autoAlpha: 0, y: 12 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        ease: "power3.out",
        delay: 0.12,
      }
    );
  }, [projectsVisible, projectOpen]);

  const closeProject = () => {
    setActiveProjectSlug(null);
    setProjectFromRect(null);
    setProjectPreviewSrc(null);
  };

  const selectProject = (slug: string, rect: CardScreenRect, previewSrc: string) => {
    setProjectFromRect(rect);
    setProjectPreviewSrc(previewSrc);
    setActiveProjectSlug(slug);
  };

  const handleViewChange = (view: AppView) => {
    if (!introDone || view === navView) {
      return;
    }

    if (view === "projects") {
      mountGallery();
    }

    closeProject();
    setNavView(view);

    if (contentFrameRef.current !== null) {
      window.cancelAnimationFrame(contentFrameRef.current);
    }

    contentFrameRef.current = window.requestAnimationFrame(() => {
      contentFrameRef.current = null;
      setContentView(view);
    });
  };

  const handleProjectsIntent = () => {
    void import("./SphereGallery");
  };

  const handleIntroHandoff = useCallback(() => {
    setIntroDone(true);
  }, []);

  const handleIntroComplete = useCallback(() => {
    setIntroDone(true);
    setSplashMounted(false);
  }, []);

  const spaceActive = !introDone || contentView === "home";

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-black text-white">
      <div
        className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 ${
          spaceActive ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      >
        <SpaceField
          splashRootRef={splashRootRef}
          homeRootRef={homeRootRef}
          playIntro={splashMounted}
          active={spaceActive}
          onHandoff={handleIntroHandoff}
          onIntroComplete={handleIntroComplete}
        />
      </div>

      {splashMounted ? <SplashIntro ref={splashRootRef} /> : null}

      <div
        className={`absolute inset-0 z-10 overflow-hidden ${
          contentView === "home"
            ? introDone
              ? "visible opacity-100 pointer-events-auto"
              : "visible opacity-0 pointer-events-none"
            : "hidden opacity-0 pointer-events-none"
        }`}
      >
        <HomeView
          rootRef={homeRootRef}
          active={introDone && contentView === "home"}
        />
      </div>

      <div
        className={`absolute inset-0 z-10 overflow-hidden ${viewLayerClass(contentView === "contact")}`}
      >
        <ContactView active={introDone && contentView === "contact"} />
      </div>

      <div className={projectsLayerClass(projectsVisible)}>
        {galleryMounted ? (
          <SphereGallery
            projects={projects}
            activeProjectSlug={activeProjectSlug}
            active={projectsVisible && !projectOpen}
            onSelectProject={(project, rect, previewSrc) =>
              selectProject(project.slug, rect, previewSrc)
            }
          />
        ) : projectsVisible ? (
          <div className="absolute inset-0 bg-black" aria-hidden />
        ) : null}

        <div
          className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-300 ${
            projectOpen ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black via-black/50 to-transparent md:h-36" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black via-black/55 to-transparent md:h-44" />
        </div>

        <div
          ref={projectsHintRef}
          className={`pointer-events-none absolute inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 px-4 opacity-0 md:bottom-24 md:px-8 ${
            projectOpen ? "opacity-0" : ""
          }`}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[10px] uppercase tracking-[0.28em] text-white/48 md:justify-start md:tracking-[0.32em]">
            <span className="md:hidden">Swipe to explore</span>
            <span className="hidden md:inline">Drag to explore</span>
            <span className="hidden h-1 w-1 rounded-full bg-white/28 sm:block" />
            <span className="md:hidden">Tap a card</span>
            <span className="hidden md:inline">Click card to enter project</span>
          </div>
        </div>
      </div>

      <BottomNav
        activeView={navView}
        onChange={handleViewChange}
        onProjectsIntent={handleProjectsIntent}
        hidden={!introDone || projectOpen}
      />

      <ProjectDetailOverlay
        project={activeProject}
        fromRect={projectFromRect}
        previewSrc={projectPreviewSrc}
        onClose={closeProject}
      />
    </div>
  );
}
