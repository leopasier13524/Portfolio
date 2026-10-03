"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import {
  about,
  experience,
  languagesAndFrameworks,
  portfolioOwner,
  softwareExperience,
} from "@/content/portfolio";
import { SkillIcon } from "./SkillIcon";
import { ThemeBackdrop } from "./ThemeBackdrop";

export function HomeView({
  active = true,
  rootRef: externalRootRef,
  portraitMotion = true,
}: {
  active?: boolean;
  rootRef?: RefObject<HTMLDivElement | null>;
  /** Ken Burns only after intro so assemble dust can lock to the still crop */
  portraitMotion?: boolean;
}) {
  const localRootRef = useRef<HTMLDivElement | null>(null);
  const rootRef = externalRootRef ?? localRootRef;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedRef = useRef(false);
  useSmoothScroll(rootRef, contentRef, { enabled: active });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const items = root.querySelectorAll("[data-home-item]");
    gsap.killTweensOf(items);

    if (!active) {
      if (!hasAnimatedRef.current) {
        // Pre-arm solid white copy under the invisible home layer so handoff
        // (introDone / nav) is never a mid-fade dark.
        gsap.set(items, { autoAlpha: 1, y: 0, clearProps: "visibility" });
      } else {
        // Stay painted so a return visit never flashes blank.
        gsap.set(items, { autoAlpha: 1, y: 0, clearProps: "visibility" });
      }
      return;
    }

    const forceVisible = window.setTimeout(() => {
      gsap.set(items, { autoAlpha: 1, y: 0, clearProps: "visibility" });
    }, 200);

    if (!hasAnimatedRef.current) {
      gsap.set(items, { autoAlpha: 1, y: 0, clearProps: "visibility" });
      hasAnimatedRef.current = true;
      return () => window.clearTimeout(forceVisible);
    }

    // Return visits: stay put. A y tween here is the Projects/Contact stutter.
    gsap.set(items, { autoAlpha: 1, y: 0, clearProps: "visibility,transform" });
    return () => window.clearTimeout(forceVisible);
  }, [active, rootRef]);

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background text-foreground"
    >
      <div className="relative min-h-full">
      <ThemeBackdrop active={active} surface="home" />
      <div
        ref={contentRef}
        className="relative z-10 mx-auto max-w-6xl px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(3.5rem,calc(2rem+env(safe-area-inset-top)))] sm:px-5 md:px-8 md:pb-36 md:pt-20"
      >
        <div className="grid items-center gap-8 md:grid-cols-[1.05fr_0.95fr] md:gap-10 lg:gap-12">
          <div className="portrait-mark relative mx-auto w-full max-w-[264px] sm:max-w-[360px] md:mx-0 md:max-w-none">
            <div
              data-home-item
              data-home-portrait
              className="portrait-mark__frame relative aspect-[3/4] max-h-[58svh] overflow-hidden md:max-h-[min(74svh,720px)]"
            >
              <Image
                src={portfolioOwner.portraitImage}
                alt={`${portfolioOwner.firstName} ${portfolioOwner.lastName}`}
                fill
                priority
                className={`portrait-mark__image object-cover object-[center_14%] ${
                  portraitMotion
                    ? "brightness-[0.92] saturate-[0.9] portrait-mark__image--motion"
                    : "brightness-[0.9] saturate-[0.88]"
                }`}
                sizes="(max-width: 768px) 82vw, 460px"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <p
              data-home-item
              className="text-[11px] uppercase tracking-[0.42em] text-foreground"
            >
              {portfolioOwner.kicker}
            </p>
            <div
              data-home-item
              className="mt-4 flex max-w-xl flex-wrap items-end gap-x-3 gap-y-2"
            >
              <h1 className="text-[2rem] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-6xl">
                <span className="block">Hi! I&apos;m {portfolioOwner.firstName}</span>
                <span className="block text-foreground">{portfolioOwner.lastName}</span>
              </h1>
              <span className="mb-1 inline-flex items-center rounded-full border border-accent bg-accent px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-accent-foreground sm:mb-2">
                Available
              </span>
            </div>
            <p
              data-home-item
              className="mt-4 text-sm uppercase tracking-[0.28em] text-foreground/90 md:text-base"
            >
              {portfolioOwner.headline}
            </p>
            <p
              data-home-item
              className="mt-2 text-[11px] uppercase tracking-[0.36em] text-foreground/90"
            >
              {portfolioOwner.location}
            </p>
            <p
              data-home-item
              className="mt-6 max-w-xl text-base leading-8 text-foreground/90 md:text-lg"
            >
              {portfolioOwner.heroStatement}
            </p>
          </div>
        </div>

        <section
          data-home-item
          data-assemble-skip
          className="mt-10 w-full border-t border-foreground/10 pt-8 md:mt-12 md:pt-10"
        >
          <p className="text-[11px] uppercase tracking-[0.34em] text-foreground/90">
            About
          </p>
          <div className="mt-5 grid w-full gap-5 md:mt-7 md:grid-cols-3 md:gap-8">
            {about.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7 text-foreground/90">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section
          data-home-item
          data-assemble-skip
          className="mt-12 grid gap-8 md:mt-14 md:grid-cols-2"
        >
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.34em] text-foreground/90">
              Tools
            </p>
            <SkillRow items={softwareExperience} />
          </div>
          <div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.34em] text-foreground/90">
              Stack
            </p>
            <SkillRow items={languagesAndFrameworks} />
          </div>
        </section>

        <section
          data-home-item
          data-assemble-skip
          className="mt-12 space-y-4 md:mt-14"
        >
          <p className="text-[11px] uppercase tracking-[0.34em] text-foreground/90">
            Experience
          </p>
          <div className="space-y-3">
            {experience.map((item) => (
              <div
                key={`${item.company}-${item.period}`}
                className="rounded-2xl border border-foreground/10 bg-background/[0.88] px-4 py-4"
              >
                <p className="font-medium">{item.company}</p>
                <p className="mt-1 text-sm text-foreground/68">{item.role}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-foreground/90">
                  {item.period}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}

function SkillRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-2.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-foreground/10 bg-background/[0.88] py-2 pl-3 pr-3.5 text-[10px] uppercase tracking-[0.08em] text-foreground/78 sm:gap-3 sm:py-2.5 sm:pl-3.5 sm:pr-4 sm:text-[11px] sm:tracking-[0.12em] md:text-xs md:tracking-[0.14em]"
        >
          <SkillIcon name={item} size="md" />
          <span className="truncate">{item}</span>
        </span>
      ))}
    </div>
  );
}
