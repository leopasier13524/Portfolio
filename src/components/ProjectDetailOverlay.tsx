"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import type { PortfolioProject } from "@/content/portfolio";

export type CardScreenRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ProjectDetailOverlayProps = {
  project: PortfolioProject | null;
  fromRect: CardScreenRect | null;
  previewSrc: string | null;
  onClose: () => void;
};

export function ProjectDetailOverlay({
  project,
  fromRect,
  previewSrc,
  onClose,
}: ProjectDetailOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLImageElement | null>(null);
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const backdrop = backdropRef.current;
    const hero = heroRef.current;
    const preview = previewRef.current;
    const chrome = chromeRef.current;
    const content = contentRef.current;

    if (!project || !root || !backdrop || !hero || !chrome || !content) {
      return;
    }

    const vw = window.innerWidth;
    const isMobile = vw < 768;
    const heroHeight = Math.min(
      window.innerHeight * (isMobile ? 0.48 : 0.72),
      isMobile ? 420 : 760
    );
    const start = fromRect ?? {
      left: vw * 0.5 - 180,
      top: window.innerHeight * 0.5 - 120,
      width: 360,
      height: 240,
    };

    const ctx = gsap.context(() => {
      gsap.set(root, { autoAlpha: 1 });
      gsap.set(backdrop, { autoAlpha: 0 });
      gsap.set(chrome, { autoAlpha: 0, y: 8 });
      gsap.set(content, { autoAlpha: 0, y: 20 });
      gsap.set(hero, {
        position: "fixed",
        left: start.left,
        top: start.top,
        width: start.width,
        height: start.height,
        zIndex: 2,
      });

      if (preview) {
        gsap.set(preview, { autoAlpha: 1 });
      }

      const tl = gsap
        .timeline({
          defaults: { ease: "power3.inOut" },
          onComplete: () => {
            gsap.set(hero, {
              clearProps: "left,top,zIndex",
              position: "relative",
              width: "100%",
              height: heroHeight,
            });
          },
        })
        .to(
          backdrop,
          {
            autoAlpha: 0.42,
            duration: 0.72,
            ease: "power2.out",
          },
          0
        )
        .to(
          hero,
          {
            left: 0,
            top: 0,
            width: vw,
            height: heroHeight,
            duration: 0.72,
          },
          0
        );

      if (preview) {
        tl.to(
          preview,
          {
            autoAlpha: 0,
            duration: 0.28,
            ease: "power2.out",
          },
          0.12
        );
      }

      tl.to(
        chrome,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.35,
          ease: "power2.out",
        },
        "-=0.18"
      ).to(
        content,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          ease: "power3.out",
        },
        "-=0.12"
      );
    }, root);

    return () => ctx.revert();
  }, [project, fromRect, previewSrc]);

  if (!project) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      data-lenis-prevent
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain text-white"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={backdropRef}
        className="pointer-events-none fixed inset-0 z-0 bg-black"
        aria-hidden
      />

      <div className="relative z-10 min-h-full bg-black">
        <div
          ref={heroRef}
          className="relative overflow-hidden bg-black will-change-[left,top,width,height]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.heroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />

          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={previewRef}
              src={previewSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-44 bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[55%] bg-gradient-to-t from-black via-black/85 to-transparent" />

          <div
            ref={chromeRef}
            className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 md:py-7"
          >
            <div className="max-w-xl">
              <p className="text-[10px] uppercase tracking-[0.42em] text-white/60">
                {project.year} / {project.category}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:mt-3 sm:text-3xl md:text-5xl">
                {project.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 shrink-0 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-white/85 backdrop-blur-md transition hover:border-white/45 hover:text-white md:min-h-0 md:px-5 md:py-3"
            >
              Close
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          className="relative mx-auto w-full max-w-4xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-24 md:pt-10"
        >
          <p className="max-w-2xl text-base leading-8 text-white/78 md:text-lg">
            {project.summary}
          </p>

          <div className="mt-10 space-y-4">
            <p className="text-xs uppercase tracking-[0.32em] text-white/45">
              Project notes
            </p>
            {project.details.map((detail) => (
              <p
                key={detail}
                className="max-w-2xl text-sm leading-7 text-white/70"
              >
                {detail}
              </p>
            ))}
          </div>

          <div className="mt-10">
            <p className="mb-4 text-xs uppercase tracking-[0.32em] text-white/45">
              Tools
            </p>
            <div className="flex flex-wrap gap-2">
              {project.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/72"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            {project.pageUrl ? (
              <a
                href={project.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-xs uppercase tracking-[0.28em] text-white/75 transition hover:border-white/35 hover:text-white"
              >
                Open on Framer
              </a>
            ) : null}

            {project.externalUrl ? (
              <a
                href={project.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-xs uppercase tracking-[0.28em] text-white/75 transition hover:border-white/35 hover:text-white"
              >
                {project.ctaLabel ?? "Open project link"}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
