"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { PortfolioProject, ProjectImage } from "@/content/portfolio";

type FromRect = { left: number; top: number; width: number; height: number };

type ProjectDetailOverlayProps = {
  project: PortfolioProject | null;
  nextProject: PortfolioProject | null;
  onClose: () => void;
  onNavigate: (slug: string) => void;
  fromRect?: FromRect | null;
  previewSrc?: string | null;
};

/** Panel rises over the wall while the clicked card is still pushing forward */
const ENTER_DURATION = 0.75;
const EXIT_DURATION = 0.7;
const FLIP_DURATION = 0.62;

function prefersReducedMotion() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ProjectDetailOverlay({
  project,
  nextProject,
  onClose,
  onNavigate,
  fromRect = null,
  previewSrc = null,
}: ProjectDetailOverlayProps) {
  // Keep rendering the last project while the exit animation plays
  const [shown, setShown] = useState<{
    project: PortfolioProject;
    /** Switched from another open project (panel already up) */
    swapped: boolean;
    fromRect: FromRect | null;
    previewSrc: string | null;
  } | null>(
    project
      ? {
          project,
          swapped: false,
          fromRect: fromRect ?? null,
          previewSrc: previewSrc ?? null,
        }
      : null
  );

  /** Boards render as small tiles; full detail opens in a lightbox on click. */
  const [zoomed, setZoomed] = useState<ProjectImage | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const closingRef = useRef(false);
  const flipRef = useRef<HTMLImageElement | null>(null);
  const flipTweenRef = useRef<gsap.core.Tween | null>(null);

  const clearFlip = useCallback(() => {
    flipTweenRef.current?.kill();
    flipTweenRef.current = null;
    const flip = flipRef.current;
    if (flip) {
      gsap.killTweensOf(flip);
      flip.style.visibility = "hidden";
      flip.removeAttribute("src");
    }
  }, []);

  // Adopt a newly opened project during render (state derived from props)
  if (project && (!shown || shown.project !== project)) {
    setShown({
      project,
      swapped: shown !== null && shown.project.slug !== project.slug,
      fromRect: fromRect ?? null,
      previewSrc: previewSrc ?? null,
    });
    // A zoomed board belongs to the project that was open behind it.
    setZoomed(null);
  }

  const shownProject = shown?.project ?? null;
  const shownSlug = shownProject?.slug ?? null;

  // Entrance
  useEffect(() => {
    const root = rootRef.current;
    const page = pageRef.current;
    if (!shown || !root || !page) {
      return;
    }

    closingRef.current = false;
    root.scrollTop = 0;
    const { swapped, fromRect: openRect, previewSrc: openSrc } = shown;
    const introItems = page.querySelectorAll<HTMLElement>("[data-intro]");
    const revealItems = page.querySelectorAll<HTMLElement>("[data-reveal]");
    const ctaItems = page.querySelectorAll<HTMLElement>("[data-cta]");
    const hero = page.querySelector<HTMLElement>("[data-overlay-hero]");
    const reduced = prefersReducedMotion();
    const useFlip =
      !swapped && !reduced && !!openRect && !!openSrc && !!hero && !!flipRef.current;

    // CTA is pinned under the title and must stay readable while the panel rises.
    gsap.set(ctaItems, { autoAlpha: 1, y: 0, clearProps: "visibility" });

    const forceVisible = window.setTimeout(() => {
      gsap.set(introItems, { autoAlpha: 1, y: 0, clearProps: "visibility" });
      gsap.set(ctaItems, { autoAlpha: 1, y: 0, clearProps: "visibility" });
      if (hero) {
        gsap.set(hero, { autoAlpha: 1, clearProps: "visibility" });
      }
    }, 900);

    const ctx = gsap.context(() => {
      gsap.set(introItems, { autoAlpha: 0, y: 34 });
      gsap.set(revealItems, { autoAlpha: 0, y: 28 });
      gsap.set(ctaItems, { autoAlpha: 1, y: 0, clearProps: "visibility" });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (swapped) {
        // Panel is already up: just re-run the content choreography
        clearFlip();
        gsap.set(root, { autoAlpha: 1, yPercent: 0 });
        gsap.set(page, { y: 0 });
        if (hero) {
          gsap.set(hero, { autoAlpha: 1, clearProps: "visibility" });
        }
      } else if (useFlip && openRect && openSrc && hero) {
        const flip = flipRef.current!;
        flip.src = openSrc;
        flip.alt = "";
        // Lay out the panel at its final position so hero rect is accurate,
        // then soft-fade the shell while the shared image carries the motion.
        gsap.set(root, { autoAlpha: 0, yPercent: 0 });
        gsap.set(page, { y: 0 });
        gsap.set(hero, { autoAlpha: 0 });
        gsap.set(flip, {
          visibility: "visible",
          position: "fixed",
          left: openRect.left,
          top: openRect.top,
          width: openRect.width,
          height: openRect.height,
          zIndex: 60,
          borderRadius: 4,
          objectFit: "cover",
          pointerEvents: "none",
          margin: 0,
        });
        tl.to(root, { autoAlpha: 1, duration: FLIP_DURATION * 0.85, ease: "expo.inOut" }, 0);

        const runFlip = () => {
          const dest = hero.getBoundingClientRect();
          flipTweenRef.current = gsap.fromTo(
            flip,
            {
              left: openRect.left,
              top: openRect.top,
              width: openRect.width,
              height: openRect.height,
            },
            {
              left: dest.left,
              top: dest.top,
              width: dest.width,
              height: dest.height,
              borderRadius: 24,
              duration: FLIP_DURATION,
              ease: "expo.inOut",
              onComplete: () => {
                gsap.set(hero, { autoAlpha: 1, clearProps: "visibility" });
                clearFlip();
              },
            }
          );
        };
        // Double rAF after final layout so getBoundingClientRect is stable
        requestAnimationFrame(() => requestAnimationFrame(runFlip));
      } else {
        clearFlip();
        if (hero) {
          gsap.set(hero, { autoAlpha: 1, clearProps: "visibility" });
        }
        // The page rises from the bottom edge as one solid panel; the copy
        // lags a touch behind so it settles after the panel does
        gsap.set(root, { autoAlpha: 1, yPercent: 100 });
        gsap.set(page, { y: 90 });
        tl.to(root, { yPercent: 0, duration: ENTER_DURATION, ease: "expo.inOut" }, 0).to(
          page,
          { y: 0, duration: ENTER_DURATION * 1.05, ease: "expo.inOut" },
          ENTER_DURATION * 0.28
        );
      }

      // Text starts earlier so copy lands while the panel is still settling
      const textAt = swapped ? 0.08 : useFlip ? FLIP_DURATION * 0.35 : ENTER_DURATION * 0.32;
      tl.to(
        introItems,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.055,
          onComplete: () => {
            gsap.set(introItems, { autoAlpha: 1, clearProps: "visibility" });
          },
        },
        textAt
      );

      // Below-the-fold blocks reveal as they scroll in
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }
            gsap.to(entry.target, {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              ease: "power3.out",
            });
            observer.unobserve(entry.target);
          }
        },
        { root, threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
      );
      revealItems.forEach((item) => observer.observe(item));

      return () => observer.disconnect();
    }, root);

    return () => {
      window.clearTimeout(forceVisible);
      clearFlip();
      ctx.revert();
    };
  }, [shown, shownSlug, clearFlip]);

  // Exit: parent cleared the project; the panel drops away, then unmounts
  useEffect(() => {
    const root = rootRef.current;
    if (project || !shown || !root) {
      return;
    }

    clearFlip();
    const page = pageRef.current;
    const tl = gsap.timeline({
      onComplete: () => setShown(null),
    });
    tl.to(root, { yPercent: 100, duration: EXIT_DURATION, ease: "expo.inOut" }, 0);
    if (page) {
      tl.to(page, { y: -60, duration: EXIT_DURATION, ease: "expo.inOut" }, 0);
    }

    return () => {
      tl.kill();
    };
  }, [project, shown, clearFlip]);

  useEffect(() => {
    return () => {
      clearFlip();
    };
  }, [clearFlip]);

  // Mirrored in a ref so Escape can close the lightbox without re-running
  // (and re-stealing focus from) the focus-trap effect below.
  const zoomedRef = useRef<ProjectImage | null>(null);
  const zoomTriggerRef = useRef<HTMLElement | null>(null);
  const zoomCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    zoomedRef.current = zoomed;
  }, [zoomed]);

  const openZoom = (
    image: ProjectImage,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    zoomTriggerRef.current = event.currentTarget;
    setZoomed(image);
  };

  const closeZoom = useCallback(() => {
    setZoomed(null);
    const trigger = zoomTriggerRef.current;
    zoomTriggerRef.current = null;
    requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
  }, []);

  // The lightbox renders outside the scrolling panel, so it keeps its own trap.
  useEffect(() => {
    if (!zoomed) {
      return;
    }
    zoomCloseRef.current?.focus({ preventScroll: true });
  }, [zoomed]);

  const requestClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!shown) {
      return;
    }

    const root = rootRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const getFocusable = () => {
      if (!root) {
        return [] as HTMLElement[];
      }
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => {
        if (node.hasAttribute("disabled") || node.tabIndex === -1) {
          return false;
        }
        const style = window.getComputedStyle(node);
        return style.visibility !== "hidden" && style.display !== "none";
      });
    };

    const focusClose = () => {
      closeRef.current?.focus({ preventScroll: true });
      if (document.activeElement !== closeRef.current) {
        root?.focus({ preventScroll: true });
      }
    };

    let cancelled = false;
    let visibilityFrame = 0;
    const focusStartedAt = performance.now();

    // Don't move focus to Close while the overlay is still opacity-0.
    // Wait until enter has started (autoAlpha/opacity > 0) or first visible paint.
    const tryFocusWhenVisible = () => {
      if (cancelled) {
        return;
      }
      const rootEl = rootRef.current;
      const opacity = rootEl
        ? Number.parseFloat(window.getComputedStyle(rootEl).opacity)
        : 0;
      if ((rootEl && opacity > 0) || performance.now() - focusStartedAt > 400) {
        focusClose();
        return;
      }
      visibilityFrame = window.requestAnimationFrame(tryFocusWhenVisible);
    };
    visibilityFrame = window.requestAnimationFrame(tryFocusWhenVisible);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (zoomedRef.current) {
          closeZoom();
          return;
        }
        requestClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      // Lightbox on top: hold focus on its close control until dismissed.
      if (zoomedRef.current) {
        event.preventDefault();
        zoomCloseRef.current?.focus({ preventScroll: true });
        return;
      }

      const nodes = getFocusable();
      if (nodes.length === 0) {
        event.preventDefault();
        focusClose();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !root?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(visibilityFrame);
      cancelled = true;
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [shown, requestClose, closeZoom]);

  if (!shownProject) {
    return null;
  }

  const titleId = `project-title-${shownProject.slug}`;
  const accent = shownProject.accent;

  return (
    <>
      {/* Shared-element flip layer (fixed); hidden unless an open FLIP runs */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={flipRef}
        alt=""
        aria-hidden
        className="pointer-events-none fixed z-[60]"
        style={{ visibility: "hidden", margin: 0 }}
      />

      <div
        ref={rootRef}
        data-lenis-prevent
        className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black text-white opacity-0 will-change-transform"
        aria-modal="true"
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {/* Keyed by slug so a "next project" swap mounts fresh, un-animated nodes */}
        <div
          key={shownProject.slug}
          ref={pageRef}
          className="relative mx-auto w-full max-w-[100rem] px-5 pb-[calc(4rem+env(safe-area-inset-bottom))] md:px-[4vw] md:pb-24"
        >
          {/* Close stays reachable while scrolling (zero-height sticky rail) */}
          <div className="pointer-events-none sticky top-0 z-20 h-0">
            <button
              ref={closeRef}
              type="button"
              onClick={requestClose}
              data-cta
              aria-label="Close project"
              className="group pointer-events-auto absolute right-0 top-[max(1.25rem,env(safe-area-inset-top))] flex min-h-11 shrink-0 items-center gap-2.5 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-white/85 backdrop-blur-md transition hover:border-white/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black md:top-7 md:min-h-0 md:px-5 md:py-3"
            >
              <span>Close</span>
              <svg
                viewBox="0 0 12 12"
                className="h-2.5 w-2.5 transition-transform duration-300 group-hover:rotate-90"
                aria-hidden
              >
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <p
            data-intro
            className="max-w-[60%] pt-[calc(max(1.25rem,env(safe-area-inset-top))+0.7rem)] text-[10px] uppercase tracking-[0.3em] text-white/65 opacity-0 md:pt-[2.5rem] md:tracking-[0.42em]"
          >
            {shownProject.year} / {shownProject.category}
          </p>

          {/* Title block + pinned CTA (never data-intro / opacity-0) */}
          <header className="pt-[9svh] md:pt-[11svh]">
            <p
              data-intro
              className="text-[11px] uppercase tracking-[0.3em] opacity-0"
              style={{ color: accent }}
            >
              {shownProject.cardLabel}
            </p>
            <h2
              id={titleId}
              data-intro
              className="-ml-[0.04em] mt-3 max-w-[14ch] text-[3rem] font-semibold leading-[0.92] tracking-tight opacity-0 sm:text-7xl md:text-8xl xl:text-[7.5rem] 2xl:text-[8.5rem]"
            >
              {shownProject.title}
            </h2>

            {shownProject.externalUrl ? (
              <div data-cta className="mt-6 flex flex-wrap gap-3 md:mt-8">
                <a
                  href={shownProject.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={
                    (shownProject.ctaLabel && shownProject.ctaLabel.trim()) ||
                    "Open live preview"
                  }
                  className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-white bg-white px-5 py-3 text-black transition hover:bg-white/90"
                >
                  <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-black">
                    {(shownProject.ctaLabel && shownProject.ctaLabel.trim()) ||
                      "Open live preview"}
                  </span>
                  <svg
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5 shrink-0 text-black"
                    aria-hidden
                  >
                    <path
                      d="M2 10L10 2M4 2h6v6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            ) : null}
          </header>

          {/* Intro row: lead + meta */}
          <section className="mt-12 grid gap-10 md:mt-16 md:grid-cols-[1.4fr_0.6fr] md:gap-16 lg:grid-cols-[1.5fr_0.5fr]">
            <p
              data-intro
              className="max-w-4xl text-lg leading-relaxed text-white/85 opacity-0 md:text-2xl md:leading-[1.5]"
            >
              {shownProject.summary}
            </p>

            <aside className="md:pt-1.5">
              <dl>
                <div data-intro className="opacity-0">
                  <dt className="text-[10px] uppercase tracking-[0.32em] text-white/65">
                    Tools
                  </dt>
                  <dd className="mt-3 flex flex-wrap gap-2">
                    {shownProject.tools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full border border-white/14 bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-white/72 sm:tracking-[0.18em]"
                      >
                        {tool}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </aside>
          </section>

          {/* Hero under description — shared-element target */}
          <figure
            data-overlay-hero
            className="relative mx-auto mt-12 aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] md:mt-16 md:rounded-3xl"
          >
            <Image
              src={shownProject.heroImage}
              alt={`${shownProject.title} hero`}
              fill
              sizes="(max-width: 768px) 92vw, 768px"
              className="object-cover"
              priority
            />
          </figure>

          {/* Brand mark + boards */}
          <section className="mx-auto mt-14 w-full max-w-5xl md:mt-20">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/65">
                Boards
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                Click to enlarge
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:mt-5 md:grid-cols-3 md:gap-4">
              {shownProject.mark ? (
                <button
                  type="button"
                  data-reveal
                  onClick={(event) => {
                    if (shownProject.mark) {
                      openZoom(shownProject.mark, event);
                    }
                  }}
                  aria-label={`Enlarge ${shownProject.mark.alt}`}
                  className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-white/10 opacity-0 transition hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{
                    background: `radial-gradient(120% 140% at 50% 100%, ${accent}33 0%, ${accent}0d 38%, transparent 70%)`,
                  }}
                >
                  <Image
                    src={shownProject.mark.src}
                    alt={shownProject.mark.alt}
                    width={shownProject.mark.width}
                    height={shownProject.mark.height}
                    sizes="(max-width: 768px) 44vw, 300px"
                    className="h-auto w-[62%] drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)] transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </button>
              ) : null}

              {shownProject.gallery.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  data-reveal
                  onClick={(event) => openZoom(image, event)}
                  aria-label={`Enlarge ${image.alt}`}
                  className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-1.5 opacity-0 transition hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:p-2"
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    sizes="(max-width: 768px) 46vw, 320px"
                    className="max-h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </button>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section
            data-reveal
            className="mt-16 grid gap-8 border-t border-white/10 pt-10 opacity-0 md:mt-24 md:grid-cols-3 md:gap-12 md:pt-12"
          >
            {shownProject.details.map((detail, index) => (
              <div key={detail}>
                <p className="text-[10px] uppercase tracking-[0.32em] text-white/65">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-3 text-sm leading-7 text-white/72 md:text-[15px]">{detail}</p>
              </div>
            ))}
          </section>

          {/* Footer nav */}
          <footer
            data-reveal
            className="mt-16 flex flex-col gap-8 border-t border-white/10 pt-8 opacity-0 md:mt-24 md:flex-row md:items-end md:justify-between md:pt-10"
          >
            <button
              type="button"
              onClick={requestClose}
              className="inline-flex items-center gap-3 self-start text-[11px] uppercase tracking-[0.3em] text-white/65 transition hover:text-white"
            >
              <span aria-hidden>←</span>
              Back to projects
            </button>

            {nextProject ? (
              <button
                type="button"
                onClick={() => onNavigate(nextProject.slug)}
                className="group flex items-center gap-5 text-left md:gap-7"
              >
                <span className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-md bg-white/5 sm:block md:h-20 md:w-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={nextProject.heroImage}
                    alt={`${nextProject.title} preview`}
                    loading="lazy"
                    className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-[1.06] group-hover:opacity-100"
                  />
                </span>
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.32em] text-white/65">
                    Next project
                  </span>
                  <span className="mt-1.5 flex items-center gap-3 text-2xl font-semibold tracking-tight text-white/90 transition-colors group-hover:text-white md:text-4xl">
                    {nextProject.title}
                    <span
                      aria-hidden
                      className="inline-block text-lg transition-transform duration-300 group-hover:translate-x-1.5 md:text-2xl"
                    >
                      →
                    </span>
                  </span>
                </span>
              </button>
            ) : null}
          </footer>
        </div>
      </div>

      {zoomed ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/94 p-4 md:p-10"
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.alt}
        >
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={closeZoom}
            className="absolute inset-0 cursor-zoom-out"
          />
          <Image
            src={zoomed.src}
            alt={zoomed.alt}
            width={zoomed.width}
            height={zoomed.height}
            sizes="96vw"
            className="pointer-events-none relative max-h-[86svh] w-auto max-w-full object-contain"
          />
          <button
            ref={zoomCloseRef}
            type="button"
            onClick={closeZoom}
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex min-h-11 items-center gap-2.5 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-white/85 backdrop-blur-md transition hover:border-white/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:right-8 md:top-8"
          >
            Close
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </>
  );
}
