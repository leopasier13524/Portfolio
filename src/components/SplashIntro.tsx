"use client";

import { forwardRef, useEffect, useRef } from "react";
import { portfolioOwner } from "@/content/portfolio";

type SplashIntroProps = {
  onSkip?: () => void;
  /** Hide Skip as soon as introDone / nav appears (Design alignment). */
  showSkip?: boolean;
};

export const SplashIntro = forwardRef<HTMLDivElement, SplashIntroProps>(
  function SplashIntro({ onSkip, showSkip = true }, ref) {
    const skipRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
      if (!onSkip || !showSkip) {
        return;
      }

      skipRef.current?.focus({ preventScroll: true });

      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onSkip();
        }
      };

      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onSkip, showSkip]);

    return (
      <div
        ref={ref}
        className={`fixed inset-0 z-[100] overflow-hidden text-white${
          showSkip ? "" : " pointer-events-none"
        }`}
        role="dialog"
        aria-modal={showSkip ? true : undefined}
        aria-label="Introduction"
        aria-busy={showSkip ? true : undefined}
        aria-hidden={!showSkip || undefined}
        {...(!showSkip ? { inert: true } : {})}
      >
        <div
          data-splash-center
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <div className="relative text-center">
            <h1>
              <div className="overflow-hidden">
                <span
                  data-splash-name
                  className="block text-4xl font-semibold tracking-tight text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.85)] sm:text-5xl md:text-7xl lg:text-8xl"
                >
                  {portfolioOwner.firstName}
                </span>
              </div>
              <div className="overflow-hidden">
                <span
                  data-splash-name
                  className="block text-4xl font-semibold tracking-tight text-white/90 drop-shadow-[0_8px_40px_rgba(0,0,0,0.85)] sm:text-5xl md:text-7xl lg:text-8xl"
                >
                  {portfolioOwner.lastName}
                </span>
              </div>
            </h1>

            <p
              data-splash-role
              className="mt-6 text-[11px] uppercase tracking-[0.38em] text-white/75"
            >
              {portfolioOwner.headline}
            </p>

            <div
              data-splash-meter
              role="status"
              aria-live="polite"
              className="mx-auto mt-24 flex w-full max-w-[220px] flex-col items-center gap-3 sm:mt-28 md:mt-32"
            >
              <div className="flex w-full items-baseline justify-between text-[10px] uppercase tracking-[0.34em] text-white/75">
                <span>Loading</span>
                <span data-splash-counter>000</span>
              </div>
              <div className="h-px w-full overflow-hidden bg-white/12">
                <div
                  data-splash-progress
                  className="h-full w-full origin-left scale-x-0 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {onSkip && showSkip ? (
          <button
            ref={skipRef}
            type="button"
            onClick={onSkip}
            aria-label="Skip introduction"
            className="pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-20 min-h-11 rounded-full border border-white/35 bg-black/50 px-5 py-2.5 text-[10px] uppercase tracking-[0.32em] text-white/90 backdrop-blur-md transition hover:border-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black md:bottom-8 md:right-8"
          >
            Skip
          </button>
        ) : null}
      </div>
    );
  }
);
