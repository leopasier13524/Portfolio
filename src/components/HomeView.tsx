"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import {
  about,
  experience,
  languagesAndFrameworks,
  portfolioOwner,
  softwareExperience,
} from "@/content/portfolio";
import { HomeBackground } from "./HomeBackground";
import { SkillIcon } from "./SkillIcon";

export function HomeView({ active = true }: { active?: boolean }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
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
      { autoAlpha: 0, y: hasAnimatedRef.current ? 18 : 28 },
      {
        autoAlpha: 1,
        y: 0,
        duration: hasAnimatedRef.current ? 0.7 : 0.85,
        ease: "power3.out",
        stagger: 0.07,
        delay: 0.06,
      }
    );

    hasAnimatedRef.current = true;
  }, [active]);

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-black text-white"
    >
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <HomeBackground active={active} />
      </div>

      <div
        ref={contentRef}
        className="relative z-10 mx-auto max-w-6xl px-5 pb-32 pt-16 md:px-8 md:pb-36 md:pt-20"
      >
        <div className="grid items-center gap-10 md:grid-cols-[0.95fr_1.05fr] md:gap-14">
          <div data-home-item className="relative mx-auto w-full max-w-md opacity-0 md:max-w-none">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-white/10 via-transparent to-[#df5f38]/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.35rem]">
                <Image
                  src={portfolioOwner.portraitImage}
                  alt={`${portfolioOwner.firstName} ${portfolioOwner.lastName}`}
                  fill
                  priority
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 90vw, 420px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              </div>
              <div className="mt-4 flex items-center justify-between px-2 pb-1">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.38em] text-white/45">
                    Based in
                  </p>
                  <p className="mt-1 text-sm text-white/78">
                    {portfolioOwner.location}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/55">
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
              className="mt-4 max-w-xl text-4xl font-semibold leading-[1.02] tracking-tight opacity-0 md:text-6xl"
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
    <div className="flex flex-wrap gap-2.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-2 pl-2 pr-4 text-[11px] uppercase tracking-[0.14em] text-white/78 md:text-xs"
        >
          <SkillIcon name={item} size="md" />
          {item}
        </span>
      ))}
    </div>
  );
}
