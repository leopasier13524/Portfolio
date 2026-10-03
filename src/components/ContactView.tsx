"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { portfolioOwner, socialLinks } from "@/content/portfolio";
import { ThemeBackdrop } from "./ThemeBackdrop";

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

    gsap.set(items, { autoAlpha: 1, y: 0, clearProps: "visibility" });

    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    gsap.fromTo(
      items,
      { y: 22 },
      {
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
      className="relative h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background text-foreground"
    >
      <div className="relative min-h-full">
      <ThemeBackdrop active={active} surface="contact" />
      <div
        ref={contentRef}
        className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(3.5rem,calc(2rem+env(safe-area-inset-top)))] sm:px-5 md:px-8 md:pb-36 md:pt-20"
      >
        <p
          data-contact-item
          className="text-[10px] uppercase tracking-[0.42em] text-foreground"
        >
          Contact
        </p>
        <h1
          data-contact-item
          className="mt-4 text-[2rem] font-semibold tracking-tight sm:text-4xl md:text-6xl"
        >
          Let&apos;s build something memorable.
        </h1>
        <p
          data-contact-item
          className="mt-5 max-w-2xl text-base leading-8 text-foreground/90 md:text-lg"
        >
          Available for UI/UX design collaborations, product work, and visually
          distinctive digital experiences.
        </p>

        <div data-contact-item className="mt-10 grid gap-4 md:grid-cols-2">
          <a
            href={`mailto:${portfolioOwner.email}`}
            className="group rounded-3xl border border-foreground/10 bg-background/[0.88] p-6 transition hover:border-foreground/22 hover:bg-foreground/[0.05]"
          >
            <p className="text-[10px] uppercase tracking-[0.32em] text-foreground/65">
              Email
            </p>
            <p className="mt-3 text-lg text-foreground transition group-hover:text-foreground/82">
              {portfolioOwner.email}
            </p>
          </a>

          <div className="rounded-3xl border border-foreground/10 bg-background/[0.88] p-6">
            <p className="text-[10px] uppercase tracking-[0.32em] text-foreground/65">
              Location
            </p>
            <p className="mt-3 text-lg text-foreground/82">{portfolioOwner.location}</p>
          </div>
        </div>

        <div data-contact-item className="mt-10">
          <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-foreground/65">
            Social
          </p>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-foreground/12 bg-background/[0.88] px-5 py-3 text-[10px] uppercase tracking-[0.28em] text-foreground/72 transition hover:border-foreground/30 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
