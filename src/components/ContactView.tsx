"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { portfolioOwner, socialLinks } from "@/content/portfolio";

export function ContactView({ active = true }: { active?: boolean }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useSmoothScroll(rootRef, contentRef, { enabled: active });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const items = root.querySelectorAll("[data-contact-item]");
    gsap.killTweensOf(items);

    if (!active) {
      gsap.set(items, { autoAlpha: 0, y: 18 });
      return;
    }

    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 22 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.75,
        ease: "power3.out",
        stagger: 0.07,
        delay: 0.06,
      }
    );
  }, [active]);

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-black text-white"
    >
      <div
        ref={contentRef}
        className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(3.5rem,calc(2rem+env(safe-area-inset-top)))] sm:px-5 md:px-8 md:pb-36 md:pt-20"
      >
        <p
          data-contact-item
          className="text-[10px] uppercase tracking-[0.42em] text-white/45 opacity-0"
        >
          Contact
        </p>
        <h1
          data-contact-item
          className="mt-4 text-[2rem] font-semibold tracking-tight opacity-0 sm:text-4xl md:text-6xl"
        >
          Let&apos;s build something memorable.
        </h1>
        <p
          data-contact-item
          className="mt-5 max-w-2xl text-base leading-8 text-white/68 opacity-0 md:text-lg"
        >
          Available for UI/UX design collaborations, product work, and visually
          distinctive digital experiences.
        </p>

        <div data-contact-item className="mt-10 grid gap-4 opacity-0 md:grid-cols-2">
          <a
            href={`mailto:${portfolioOwner.email}`}
            className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/22 hover:bg-white/[0.05]"
          >
            <p className="text-[10px] uppercase tracking-[0.32em] text-white/42">
              Email
            </p>
            <p className="mt-3 text-lg text-white transition group-hover:text-white/82">
              {portfolioOwner.email}
            </p>
          </a>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-white/42">
              Location
            </p>
            <p className="mt-3 text-lg text-white/82">{portfolioOwner.location}</p>
          </div>
        </div>

        <div data-contact-item className="mt-10 opacity-0">
          <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-white/42">
            Social
          </p>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-[10px] uppercase tracking-[0.28em] text-white/72 transition hover:border-white/30 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
