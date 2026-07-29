"use client";

import Image from "next/image";
import { useEffect, useRef, type RefObject } from "react";
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const items = root.querySelectorAll("[data-home-item]");
    gsap.killTweensOf(items);

    if (!active) {
      gsap.set(items, { autoAlpha: 0, y: hasAnimatedRef.current ? 18 : 0 });
      return;
    }

    // First intro: soft opacity-only fade under particles (no slide/stagger)
    if (!hasAnimatedRef.current) {
      gsap.fromTo(
        items,
        { autoAlpha: 0, y: 0 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.85,
          ease: "sine.inOut",
          stagger: 0,
          delay: 0.02,
        }
      );
      hasAnimatedRef.current = true;
      return;
    }

    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.75,
        ease: "sine.inOut",
        stagger: 0.06,
        delay: 0.06,
      }
    );
  }, [active]);

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-transparent text-white"
    >
      <div
        ref={contentRef}
        className="relative z-10 mx-auto max-w-6xl px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(3.5rem,calc(2rem+env(safe-area-inset-top)))] sm:px-5 md:px-8 md:pb-36 md:pt-20"
      >
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-10 lg:gap-12">
          <div className="portrait-mark relative mx-auto w-full max-w-[300px] sm:max-w-[360px] md:mx-0 md:max-w-none">
            <div
              data-home-item
              data-home-portrait
              className="portrait-mark__frame relative aspect-[3/4] max-h-[58svh] overflow-hidden opacity-0 md:max-h-[min(74svh,720px)]"
            >
              <Image
                src={portfolioOwner.portraitImage}
                alt={`${portfolioOwner.firstName} ${portfolioOwner.lastName}`}
                fill
                priority
                className={`portrait-mark__image object-cover object-[center_14%] brightness-[0.84] saturate-[0.78] ${
                  portraitMotion ? "portrait-mark__image--motion" : ""
                }`}
                sizes="(max-width: 768px) 82vw, 460px"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent from-35% via-black/20 via-70% to-black/85 md:to-black/95"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
                aria-hidden
              />
            </div>
            <div
              className="mt-4 flex items-baseline justify-between gap-4 opacity-0"
              data-home-item
              data-assemble-skip
            >
              <p className="min-w-0 truncate text-[10px] uppercase tracking-[0.36em] text-white/48">
                {portfolioOwner.location}
              </p>
              <p className="shrink-0 text-[10px] uppercase tracking-[0.32em] text-white/38">
                Available
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <p
              data-home-item
              className="text-[10px] uppercase tracking-[0.42em] text-white/45 opacity-0"
            >
              {portfolioOwner.kicker}
            </p>
            <h1
              data-home-item
              className="mt-4 max-w-xl text-[2rem] font-semibold leading-[1.05] tracking-tight opacity-0 sm:text-4xl md:text-6xl"
            >
              Hi! I&apos;m {portfolioOwner.firstName}
              <span className="block text-white/88">{portfolioOwner.lastName}</span>
            </h1>
            <p
              data-home-item
              className="mt-4 text-sm uppercase tracking-[0.28em] text-white/58 opacity-0 md:text-base"
            >
              {portfolioOwner.headline}
            </p>
            <p
              data-home-item
              className="mt-6 max-w-xl text-base leading-8 text-white/72 opacity-0 md:text-lg"
            >
              {portfolioOwner.heroStatement}
            </p>

            <section data-home-item className="mt-10 space-y-4 opacity-0">
              <p className="text-[10px] uppercase tracking-[0.34em] text-white/42">
                About
              </p>
              <div className="max-w-xl space-y-4">
                {about.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-white/68">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section
          data-home-item
          data-assemble-skip
          className="mt-12 grid gap-8 opacity-0 md:mt-14 md:grid-cols-2"
        >
          <div>
            <p className="mb-4 text-[10px] uppercase tracking-[0.34em] text-white/42">
              Tools
            </p>
            <SkillRow items={softwareExperience} />
          </div>
          <div>
            <p className="mb-4 text-[10px] uppercase tracking-[0.34em] text-white/42">
              Stack
            </p>
            <SkillRow items={languagesAndFrameworks} />
          </div>
        </section>

        <section
          data-home-item
          data-assemble-skip
          className="mt-12 space-y-4 opacity-0 md:mt-14"
        >
          <p className="text-[10px] uppercase tracking-[0.34em] text-white/42">
            Experience
          </p>
          <div className="space-y-3">
            {experience.map((item) => (
              <div
                key={`${item.company}-${item.period}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <p className="font-medium">{item.company}</p>
                <p className="mt-1 text-sm text-white/62">{item.role}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/40">
                  {item.period}
                </p>
              </div>
            ))}
          </div>
        </section>
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
          className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-2 pl-3 pr-3.5 text-[10px] uppercase tracking-[0.12em] text-white/78 sm:gap-3 sm:py-2.5 sm:pl-3.5 sm:pr-4 sm:text-[11px] sm:tracking-[0.14em] md:text-xs"
        >
          <SkillIcon name={item} size="md" />
          <span className="truncate">{item}</span>
        </span>
      ))}
    </div>
  );
}
