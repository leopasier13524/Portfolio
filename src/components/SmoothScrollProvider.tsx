"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

type SmoothScrollProviderProps = {
  paused?: boolean;
};

export function SmoothScrollProvider({ paused = false }: SmoothScrollProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.08,
      smoothWheel: true,
      syncTouch: true,
      touchMultiplier: 1.1,
    });

    lenisRef.current = lenis;

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) {
      return;
    }

    if (paused) {
      lenis.stop();
    } else {
      lenis.start();
    }
  }, [paused]);

  return null;
}
