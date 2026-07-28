"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export type AppView = "home" | "projects" | "contact";

type BottomNavProps = {
  activeView: AppView;
  onChange: (view: AppView) => void;
  onProjectsIntent?: () => void;
  hidden?: boolean;
};

const items: { id: AppView; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
];

export function BottomNav({
  activeView,
  onChange,
  onProjectsIntent,
  hidden = false,
}: BottomNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<AppView, HTMLButtonElement | null>>({
    home: null,
    projects: null,
    contact: null,
  });
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const animatePill = () => {
      const button = buttonRefs.current[activeView];
      const pill = pillRef.current;
      const container = containerRef.current;
      if (!button || !pill || !container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const next = {
        x: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      };

      if (!ready) {
        gsap.set(pill, {
          x: next.x,
          width: next.width,
          opacity: 1,
        });
        setReady(true);
        return;
      }

      gsap.to(pill, {
        x: next.x,
        width: next.width,
        duration: 0.65,
        ease: "power3.out",
      });
    };

    const frame = window.requestAnimationFrame(animatePill);
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, ready]);

  useEffect(() => {
    const onResize = () => {
      const button = buttonRefs.current[activeView];
      const pill = pillRef.current;
      const container = containerRef.current;
      if (!button || !pill || !container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      gsap.set(pill, {
        x: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeView]);

  return (
    <nav
      aria-label="Primary"
      className={`pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(100%-1.5rem,28rem)] -translate-x-1/2 transition-all duration-500 md:bottom-8 md:w-auto ${
        hidden
          ? "pointer-events-none translate-y-8 opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      <div
        ref={containerRef}
        className="relative mx-auto flex w-full items-center justify-between gap-0.5 rounded-full bg-white/22 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-2xl backdrop-saturate-150 sm:justify-center sm:gap-1"
      >
        <span
          ref={pillRef}
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-0 rounded-full bg-white opacity-0 shadow-[0_10px_28px_rgba(255,255,255,0.28)]"
        />
        {items.map((item) => {
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              ref={(node) => {
                buttonRefs.current[item.id] = node;
              }}
              type="button"
              onClick={() => onChange(item.id)}
              onPointerEnter={
                item.id === "projects" ? onProjectsIntent : undefined
              }
              className={`relative z-10 min-h-11 flex-1 rounded-full px-3 py-2.5 text-[10px] uppercase tracking-[0.22em] transition-colors duration-300 sm:flex-none sm:px-5 sm:tracking-[0.34em] md:min-h-0 md:px-7 md:py-3 md:text-[11px] ${
                isActive ? "text-black" : "text-white/88 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
