"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";

export type AppView = "home" | "projects" | "contact";

type BottomNavProps = {
  activeView: AppView;
  onChange: (view: AppView) => void;
  onProjectsIntent?: () => void;
  hidden?: boolean;
  /** Rendered beside the nav pill, e.g. the theme picker. */
  children?: ReactNode;
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
  children,
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
        duration: 0.4,
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
    <div
      aria-hidden={hidden || undefined}
      {...(hidden ? { inert: true } : {})}
      className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[min(100%-1.5rem,32rem)] -translate-x-1/2 items-stretch gap-3 transition-all duration-500 md:bottom-8 md:w-auto md:gap-4 ${
        hidden
          ? "pointer-events-none translate-y-8 opacity-0"
          : "pointer-events-auto translate-y-0 opacity-100"
      }`}
    >
      <nav aria-label="Primary" className="min-w-0 flex-1 md:flex-none">
        <div
          ref={containerRef}
          className="relative mx-auto flex h-full w-full items-center justify-between gap-0.5 rounded-full border border-foreground/20 bg-background/[0.88] p-1 text-[12px] backdrop-blur-md sm:justify-center sm:gap-1 sm:text-base"
        >
          <span
            ref={pillRef}
            aria-hidden
            className="absolute top-1 bottom-1 left-0 rounded-full bg-accent opacity-0"
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
                aria-current={isActive ? "page" : undefined}
                onClick={() => onChange(item.id)}
                onPointerEnter={
                  item.id === "projects" ? onProjectsIntent : undefined
                }
                tabIndex={hidden ? -1 : undefined}
                className={`relative z-10 min-h-11 flex-1 rounded-full px-2 py-2.5 text-[10px] uppercase tracking-[0.16em] transition-colors duration-300 sm:flex-none sm:px-5 sm:tracking-[0.34em] md:min-h-0 md:px-7 md:py-3 md:text-[11px] ${
                  isActive ? "text-accent-foreground" : "text-foreground/85 hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
