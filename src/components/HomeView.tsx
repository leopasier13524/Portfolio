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
}: {
  active?: boolean;
  rootRef?: RefObject<HTMLDivElement | null>;
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
      gsap.set(items, { autoAlpha: 0, y: 18 });
      return;
    }

    gsap.fromTo(
      items,
      { autoAlpha: 0, y: hasAnimatedRef.current ? 18 : 10 },
      {
        autoAlpha: 1,
        y: 0,
        duration: hasAnimatedRef.current ? 0.7 : 0.85,
        ease: "power3.out",
        stagger: hasAnimatedRef.current ? 0.07 : 0.045,
        delay: hasAnimatedRef.current ? 0.06 : 0,
      }
    );

    hasAnimatedRef.current = true;
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
        <div className="grid items-center gap-10 md:grid-cols-[0.95fr_1.05fr] md:gap-14">
          <div data-home-item className="relative mx-auto w-full max-w-[280px] opacity-0 sm:max-w-sm md:max-w-none">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-2.5 sm:rounded-[1.75rem] sm:p-3">
              <div className="relative aspect-[4/5] max-h-[52svh] overflow-hidden rounded-[1.15rem] sm:rounded-[1.35rem] md:max-h-none">
                <Image
                  src={portfolioOwner.portraitImage}
                  alt={`${portfolioOwner.firstName} ${portfolioOwner.lastName}`}
                  fill
                  priority
                  className="object-cover object-top brightness-[0.84] saturate-[0.78]"
                  sizes="(max-width: 768px) 80vw, 420px"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 px-1.5 pb-0.5 sm:mt-4 sm:px-2 sm:pb-1">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.38em] text-white/45">
                    Based in
                  </p>
                  <p className="mt-1 truncate text-sm text-white/78">
                    {portfolioOwner.location}
                  </p>
                </div>
                <div className="shrink-0 rounded-full border border-white/10 px-2.5 py-1.5 text-[9px] uppercase tracking-[0.24em] text-white/55 sm:px-3 sm:text-[10px] sm:tracking-[0.28em]">
                  Available
                </div>
              </div>
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

        <section data-home-item className="mt-12 grid gap-8 opacity-0 md:mt-14 md:grid-cols-2">
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

        <section data-home-item className="mt-12 space-y-4 opacity-0 md:mt-14">
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
