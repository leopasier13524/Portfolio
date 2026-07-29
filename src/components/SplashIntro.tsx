"use client";

import { forwardRef } from "react";
import { portfolioOwner } from "@/content/portfolio";

export const SplashIntro = forwardRef<HTMLDivElement>(function SplashIntro(
  _,
  ref
) {
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden text-white"
      aria-hidden
    >
      <div
        data-splash-center
        className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <div className="relative text-center">
          <p
            data-splash-kicker
            className="text-[10px] uppercase tracking-[0.48em] text-white/55"
          >
            {portfolioOwner.location}
          </p>

          <div className="mt-7">
            <div className="overflow-hidden">
              <h1
                data-splash-name
                className="text-4xl font-semibold tracking-tight text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.85)] sm:text-5xl md:text-7xl lg:text-8xl"
              >
                {portfolioOwner.firstName}
              </h1>
            </div>
            <div className="overflow-hidden">
              <h1
                data-splash-name
                className="text-4xl font-semibold tracking-tight text-white/90 drop-shadow-[0_8px_40px_rgba(0,0,0,0.85)] sm:text-5xl md:text-7xl lg:text-8xl"
              >
                {portfolioOwner.lastName}
              </h1>
            </div>
          </div>

          <p
            data-splash-role
            className="mt-6 text-[11px] uppercase tracking-[0.38em] text-white/60"
          >
            {portfolioOwner.headline}
          </p>

          <div
            data-splash-meter
            className="mx-auto mt-14 flex w-full max-w-[220px] flex-col items-center gap-3"
          >
            <div className="flex w-full items-baseline justify-between text-[10px] uppercase tracking-[0.34em] text-white/45">
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
    </div>
  );
});
