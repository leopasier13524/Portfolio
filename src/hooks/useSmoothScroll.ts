"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import Lenis from "lenis";

type UseSmoothScrollOptions = {
  enabled?: boolean;
  onScroll?: (progress: number) => void;
  onReady?: (lenis: Lenis) => void;
  autoRaf?: boolean;
};

export function useSmoothScroll(
  wrapperRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  {
    enabled = true,
    onScroll,
    onReady,
    autoRaf = true,
  }: UseSmoothScrollOptions = {}
) {
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;

    if (!wrapper || !content || !enabled) {
      return;
    }

    // Native touch scrolling feels better on phones; Lenis only for wheel.
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf,
      lerp: isTouch ? 0.14 : 0.085,
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.2,
      wheelMultiplier: 0.92,
    });

    const handleScroll = () => {
      onScroll?.(lenis.progress);
    };

    lenis.on("scroll", handleScroll);
    handleScroll();
    onReady?.(lenis);

    return () => {
      lenis.off("scroll", handleScroll);
      lenis.destroy();
    };
  }, [wrapperRef, contentRef, enabled, onScroll, onReady, autoRaf]);
}
