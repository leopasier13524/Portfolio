"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { projects } from "@/content/portfolio";
import { BottomNav, type AppView } from "./BottomNav";
import { ContactView } from "./ContactView";
import { HomeView } from "./HomeView";
import { MyRoadView } from "./MyRoadView";
import { ProjectDetailOverlay } from "./ProjectDetailOverlay";
import { ProjectsGridView } from "./ProjectsGridView";
import { ProjectsListView } from "./ProjectsListView";
import { ProjectsViewToggle, type ProjectsLayout } from "./ProjectsViewToggle";
import { SpaceField } from "./SpaceField";
import { SplashIntro } from "./SplashIntro";

const SphereGallery = dynamic(
  () => import("./SphereGallery").then((mod) => mod.SphereGallery),
  { ssr: false }
);

const INTRO_MAX_MS = 9000;
type FromRect = { left: number; top: number; width: number; height: number };

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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [splashMounted, setSplashMounted] = useState(true);
  const [forceSpaceComplete, setForceSpaceComplete] = useState(false);
  const [navView, setNavView] = useState<AppView>("home");
  const [contentView, setContentView] = useState<AppView>("home");
  const [galleryMounted, setGalleryMounted] = useState(false);
  const [myRoadOpen, setMyRoadOpen] = useState(false);
  const splashRootRef = useRef<HTMLDivElement | null>(null);
  const homeRootRef = useRef<HTMLDivElement | null>(null);
  const contentFrameRef = useRef<number | null>(null);
  const [projectsLayout, setProjectsLayout] = useState<ProjectsLayout>("wall");
  const [activeProjectSlug, setActiveProjectSlug] = useState<string | null>(null);
  const [fromRect, setFromRect] = useState<FromRect | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const activeProject = useMemo(
    () => projects.find((project) => project.slug === activeProjectSlug) ?? null,
    [activeProjectSlug]
  );
  const nextProject = useMemo(() => {
    if (!activeProject || projects.length < 2) {
      return null;
    }
    const index = projects.indexOf(activeProject);
    return projects[(index + 1) % projects.length];
  }, [activeProject]);

  const projectOpen = activeProjectSlug !== null;
  const projectsVisible = contentView === "projects";
  // Particles only during splash; HTML home wins after handoff/complete.
  const spaceActive = splashMounted && !reducedMotion;
  // Do not mount/activate the Projects WebGL wall while SpaceField is up
  // or before introDone — dual WebGL if Projects is opened in that window.
  const galleryReady = introDone && !spaceActive;
  const safeLayout: ProjectsLayout =
    reducedMotion && projectsLayout === "wall" ? "grid" : projectsLayout;
  const showWall = safeLayout === "wall" && !reducedMotion;
  const wallVisible = projectsVisible && showWall && galleryReady;
  const gridVisible = projectsVisible && safeLayout === "grid" && introDone;
  const listVisible = projectsVisible && safeLayout === "list" && introDone;
  const projectsHintRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const reduced = media.matches;
      setReducedMotion(reduced);
      if (reduced) {
        setIntroDone(true);
        setSplashMounted(false);
        setForceSpaceComplete(true);
        setProjectsLayout((current) => (current === "wall" ? "grid" : current));
      }
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  // Tell SpaceField to skip first. Do not unmount splash/space here —
  // skipIntroRef is on SpaceField and dies if we unmount in the same commit.
  const finishIntroNow = useCallback(() => {
    setIntroDone(true);
    setForceSpaceComplete(true);
    // Give SpaceField one tick to run skipIntroNow, then yield Home
    // even if handoff never fires (Playwright / stuck LOADING 000).
    window.setTimeout(() => {
      setSplashMounted(false);
    }, 80);
  }, []);

  const handleSkipIntro = useCallback(() => {
    finishIntroNow();
  }, [finishIntroNow]);

  useEffect(() => {
    if (introDone || reducedMotion) {
      return;
    }

    const timer = window.setTimeout(() => {
      finishIntroNow();
    }, INTRO_MAX_MS);

    return () => window.clearTimeout(timer);
  }, [introDone, reducedMotion, finishIntroNow]);

  // If SpaceField never handoffs (root missing / WebGL throw), still yield Home.
  useEffect(() => {
    if (!forceSpaceComplete || !splashMounted) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSplashMounted(false);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [forceSpaceComplete, splashMounted]);

  // Last-resort yield: always leave splash even if Skip/handoff never ran.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIntroDone(true);
      setForceSpaceComplete(true);
      setSplashMounted(false);
    }, INTRO_MAX_MS + 700);
    return () => window.clearTimeout(timer);
  }, []);

  const mountGallery = () => {
    if (reducedMotion) {
      return;
    }
    void import("./SphereGallery");
    setGalleryMounted(true);
  };

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

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
  }, [reducedMotion]);

  useEffect(() => {
    const hint = projectsHintRef.current;
    if (!hint) {
      return;
    }

    gsap.killTweensOf(hint);

    const narrow =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;

    // Mobile already has layout toggle + BottomNav — hide drag hint (no triple chrome).
    if (!wallVisible || projectOpen || narrow) {
      gsap.set(hint, { autoAlpha: 0, y: 8 });
      return;
    }

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
  }, [wallVisible, projectOpen]);

  const selectProject = (
    slug: string,
    rect?: FromRect | null,
    src?: string | null
  ) => {
    setFromRect(rect ?? null);
    setPreviewSrc(src ?? null);
    setActiveProjectSlug(slug);
  };

  const closeProject = () => {
    // Clearing slug settles the wall back via SphereGallery resetFocus,
    // while the overlay slides away on top
    setActiveProjectSlug(null);
    setFromRect(null);
    setPreviewSrc(null);
  };

  const handleViewChange = (view: AppView) => {
    if (myRoadOpen) {
      setMyRoadOpen(false);
    }
    if (!introDone || view === navView) {
      return;
    }

    if (view === "projects" && projectsLayout === "wall" && !reducedMotion) {
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

  useEffect(() => {
    return () => {
      if (contentFrameRef.current !== null) {
        window.cancelAnimationFrame(contentFrameRef.current);
        contentFrameRef.current = null;
      }
    };
  }, []);

  const handleProjectsIntent = () => {
    if (!reducedMotion) {
      void import("./SphereGallery");
    }
  };

  // Handoff, skip, timeout, and intro-complete all flip together so
  // SpaceField unmounts the instant home becomes solid (no 1.5–2s overlay).
  const releaseIntro = useCallback(() => {
    setIntroDone(true);
    setSplashMounted(false);
  }, []);

  const handleIntroHandoff = releaseIntro;

  const handleIntroComplete = releaseIntro;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-black text-white">
      {spaceActive ? (
        <div
          className="pointer-events-none fixed inset-0 z-30 opacity-100"
          aria-hidden
        >
          <SpaceField
            splashRootRef={splashRootRef}
            homeRootRef={homeRootRef}
            playIntro={splashMounted && !forceSpaceComplete}
            active={spaceActive}
            forceComplete={forceSpaceComplete}
            onHandoff={handleIntroHandoff}
            onIntroComplete={handleIntroComplete}
          />
        </div>
      ) : null}

      {splashMounted && !reducedMotion ? (
        <SplashIntro
          ref={splashRootRef}
          onSkip={handleSkipIntro}
          showSkip={!introDone}
        />
      ) : null}

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
          portraitMotion={!splashMounted && !reducedMotion}
          onOpenMyRoad={
            introDone
              ? () => {
                  setMyRoadOpen(true);
                }
              : undefined
          }
        />
      </div>

      <div
        className={`absolute inset-0 z-10 overflow-hidden ${viewLayerClass(contentView === "contact")}`}
      >
        <ContactView active={introDone && contentView === "contact"} />
      </div>

      <div className={projectsLayerClass(projectsVisible)}>
        {galleryMounted && galleryReady && !reducedMotion ? (
          <div
            className={`absolute inset-0 transition-opacity duration-[350ms] ease-in-out ${
              wallVisible ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!wallVisible || undefined}
          >
            <SphereGallery
              projects={projects}
              activeProjectSlug={activeProjectSlug}
              active={wallVisible && !projectOpen && galleryReady}
              onSelectProject={(project, rect, src) =>
                selectProject(project.slug, rect, src)
              }
            />
          </div>
        ) : wallVisible ? (
          <div
            className="absolute inset-0 z-[1] flex items-center justify-center bg-black"
            role="status"
            aria-live="polite"
          >
            <div className="flex w-full max-w-3xl flex-col gap-3 px-4 md:px-8">
              <p className="mb-2 text-[10px] uppercase tracking-[0.34em] text-white/65">
                Loading explore
              </p>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
                />
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={`absolute inset-0 z-[15] transition-opacity duration-[350ms] ease-in-out ${
            gridVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!gridVisible || undefined}
        >
          <ProjectsGridView
            projects={projects}
            active={gridVisible && !projectOpen}
            onSelectProject={(project, rect, src) =>
              selectProject(project.slug, rect, src)
            }
          />
        </div>

        <div
          className={`absolute inset-0 z-[15] transition-opacity duration-[350ms] ease-in-out ${
            listVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!listVisible || undefined}
        >
          <ProjectsListView
            projects={projects}
            active={listVisible && !projectOpen}
            onSelectProject={(project) => selectProject(project.slug)}
          />
        </div>

        <div
          className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-300 ${
            wallVisible && !projectOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black via-black/50 to-transparent md:h-36" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black via-black/55 to-transparent md:h-44" />
        </div>

        <div
          ref={projectsHintRef}
          className="pointer-events-none absolute inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-20 hidden px-4 opacity-0 md:bottom-[6.75rem] md:block md:px-8"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[10px] uppercase tracking-[0.28em] text-white/68 md:tracking-[0.32em]">
            <span>Drag to explore · infinite wall</span>
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span>Click card to enter project</span>
          </div>
        </div>
      </div>

      <ProjectsViewToggle
        layout={safeLayout}
        onChange={(layout) => {
          setProjectsLayout(layout);
          if (layout === "wall") {
            mountGallery();
          }
        }}
        hidden={!introDone || !projectsVisible || projectOpen}
        hideWall={reducedMotion}
      />

      <BottomNav
        activeView={navView}
        onChange={handleViewChange}
        onProjectsIntent={handleProjectsIntent}
        hidden={!introDone || projectOpen || myRoadOpen}
      />

      <ProjectDetailOverlay
        project={activeProject}
        nextProject={nextProject}
        onClose={closeProject}
        onNavigate={(slug) => selectProject(slug)}
        fromRect={fromRect}
        previewSrc={previewSrc}
      />
      {myRoadOpen ? (
        <MyRoadView
          onClose={() => {
            setMyRoadOpen(false);
            setNavView("home");
            setContentView("home");
          }}
          onContact={() => {
            setMyRoadOpen(false);
            setNavView("contact");
            setContentView("contact");
          }}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </div>
  );
}
