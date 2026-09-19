"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { myRoadStops } from "@/content/portfolio";
import { MyRoadFlight, type FlightControls } from "./MyRoadFlight";
import { SkillIcon } from "./SkillIcon";

/** Mounted only while the journey is open, so every entry starts from frame one. */
type MyRoadViewProps = {
  onClose: () => void;
  onContact: () => void;
  reducedMotion?: boolean;
};

export function MyRoadView({
  onClose,
  onContact,
  reducedMotion = false,
}: MyRoadViewProps) {
  const controlsRef = useRef<FlightControls | null>(null);
  const barsRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);

  const progressRef = useRef<HTMLDivElement | null>(null);
  const [chapter, setChapter] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  // Written straight to the DOM: routing per-frame progress through state would
  // re-render the whole overlay sixty times a second.
  const handleProgress = useCallback((value: number) => {
    const bar = progressRef.current;
    if (bar) {
      bar.style.width = `${Math.max(1, value * 100)}%`;
    }
  }, []);

  const cinematic = !reducedMotion;
  const activeStop = chapter >= 0 ? myRoadStops[chapter] : null;

  // Escape always leaves the cinema.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (reducedMotion) {
        return;
      }
      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        setPlaying(controlsRef.current?.toggle() ?? false);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        controlsRef.current?.jumpToChapter(Math.min(myRoadStops.length - 1, chapter + 1));
        setFinished(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        controlsRef.current?.jumpToChapter(Math.max(0, chapter - 1));
        setFinished(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, reducedMotion, chapter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      backRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  // Letterbox bars slide in — the "a film starts" beat.
  useLayoutEffect(() => {
    const bars = barsRef.current;
    if (!cinematic || !bars) {
      return;
    }
    const edges = bars.querySelectorAll("[data-bar]");
    gsap.killTweensOf(edges);
    gsap.fromTo(
      edges,
      { scaleY: 3.4 },
      { scaleY: 1, duration: 1.5, ease: "expo.out", delay: 0.1 }
    );
  }, [cinematic]);

  // Lower-third title card per milestone.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !activeStop) {
      return;
    }
    gsap.killTweensOf(card.children);
    if (reducedMotion) {
      gsap.set(card.children, { autoAlpha: 1, y: 0, clearProps: "visibility" });
      return;
    }
    gsap.fromTo(
      card.children,
      { autoAlpha: 0, y: 22 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.75,
        stagger: 0.07,
        ease: "power3.out",
        clearProps: "visibility",
      }
    );
  }, [activeStop, reducedMotion]);

  const handleChapter = useCallback((index: number) => {
    setChapter(index);
    if (index >= 0) {
      setFinished(false);
    }
  }, []);

  const handleComplete = useCallback(() => {
    setFinished(true);
    setPlaying(false);
  }, []);

  const jumpTo = (index: number) => {
    setFinished(false);
    controlsRef.current?.jumpToChapter(index);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="My Road"
      data-myroad-overlay
      className="fixed inset-0 z-[45] overflow-hidden bg-black text-white"
    >
      {cinematic ? (
        <MyRoadFlight
          stops={myRoadStops}
          controlsRef={controlsRef}
          onChapter={handleChapter}
          onProgress={handleProgress}
          onPlayStateChange={setPlaying}
          onComplete={handleComplete}
        />
      ) : (
        <ReducedRoad onContact={onContact} />
      )}

      {cinematic ? (
        <div
          ref={barsRef}
          className="pointer-events-none absolute inset-0 z-20"
          aria-hidden
        >
          {/* Scrims so the road never runs through the titles */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/85 via-black/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-black via-black/80 via-35% to-transparent" />
          <div
            data-bar
            className="absolute inset-x-0 top-0 h-[6svh] origin-top bg-black"
          />
          <div
            data-bar
            className="absolute inset-x-0 bottom-0 h-[6svh] origin-bottom bg-black"
          />
        </div>
      ) : null}

      {/* Chrome */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 pt-[max(1.6rem,calc(1.2rem+env(safe-area-inset-top)))] md:px-8">
        <button
          ref={backRef}
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-white/80 backdrop-blur-md transition-colors hover:border-white/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Back to Home
        </button>

        <p className="hidden text-[11px] uppercase tracking-[0.42em] text-white/55 sm:block">
          My Road
        </p>

        {cinematic && !finished ? (
          <button
            type="button"
            onClick={() => {
              controlsRef.current?.skipToEnd();
            }}
            className="min-h-11 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-white/80 backdrop-blur-md transition-colors hover:border-white/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Skip
          </button>
        ) : (
          <span className="min-h-11 w-[5.5rem]" aria-hidden />
        )}
      </div>

      {/* Lower third */}
      {cinematic && activeStop && !finished ? (
        <div
          ref={cardRef}
          key={activeStop.id}
          className="pointer-events-none absolute inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 px-5 md:bottom-40 md:px-12"
        >
          <p className="text-[10px] uppercase tracking-[0.42em] text-white/60">
            {String(chapter + 1).padStart(2, "0")} / {String(myRoadStops.length).padStart(2, "0")}
            <span className="ml-3 text-white/45">{activeStop.dates}</span>
          </p>
          <h2 className="mt-2 max-w-3xl text-[1.55rem] font-semibold leading-[1.08] tracking-tight drop-shadow-[0_6px_28px_rgba(0,0,0,0.85)] sm:text-5xl md:text-6xl">
            {activeStop.title}
          </h2>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.3em] text-white/70 md:mt-2 md:text-[11px]">
            {activeStop.role}
          </p>
          <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-white/75 md:mt-3 md:text-sm">
            {activeStop.outcome}
          </p>
          <div className="mt-3 flex max-w-2xl flex-wrap gap-1.5 md:mt-4">
            {activeStop.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/55 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-white/72 backdrop-blur-sm md:gap-2 md:px-2.5 md:tracking-[0.14em] md:text-[10px]"
              >
                <SkillIcon name={skill} size="sm" />
                {skill}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Outro */}
      {cinematic && finished ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-6 backdrop-blur-[2px]">
          <div className="w-full max-w-lg text-center">
            <p className="text-[10px] uppercase tracking-[0.42em] text-white/60">
              End of the road — so far
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              {myRoadStops[myRoadStops.length - 1].title}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/75">
              From a Web Designer diploma to designing product UI/UX today. The
              next stop could be yours.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onContact}
                className="min-h-11 rounded-full border border-white bg-white px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.28em] text-black transition-opacity hover:opacity-90"
              >
                Contact
              </button>
              <button
                type="button"
                onClick={() => {
                  setFinished(false);
                  setChapter(-1);
                  controlsRef.current?.restart();
                }}
                className="min-h-11 rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] text-white/85 transition-colors hover:border-white/50 hover:text-white"
              >
                Replay
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-full border border-transparent px-4 py-2.5 text-[10px] uppercase tracking-[0.28em] text-white/60 transition-colors hover:text-white"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Transport: progress + chapter rail */}
      {cinematic ? (
        <div className="absolute inset-x-0 bottom-0 z-30 px-4 pb-[max(1.6rem,calc(1.1rem+env(safe-area-inset-bottom)))] md:px-8">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setPlaying(controlsRef.current?.toggle() ?? false)}
              aria-label={playing ? "Pause flight" : "Play flight"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/85 backdrop-blur-md transition-colors hover:border-white/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {playing ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                  <rect x="2" y="1.5" width="2.6" height="9" fill="currentColor" />
                  <rect x="7.4" y="1.5" width="2.6" height="9" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                  <path d="M2.5 1.5l8 4.5-8 4.5z" fill="currentColor" />
                </svg>
              )}
            </button>

            <div className="flex-1">
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/12">
                <div
                  ref={progressRef}
                  className="h-full w-[1%] rounded-full bg-white/80"
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                {myRoadStops.map((stop, index) => (
                  <button
                    key={stop.id}
                    type="button"
                    onClick={() => jumpTo(index)}
                    aria-current={index === chapter ? "true" : undefined}
                    className="group flex min-w-0 flex-1 flex-col items-start gap-1 py-1 text-left focus-visible:outline-none"
                  >
                    <span
                      className={`h-1 w-full rounded-full transition-colors ${
                        index <= chapter
                          ? "bg-white/70"
                          : "bg-white/15 group-hover:bg-white/40"
                      }`}
                    />
                    <span
                      className={`hidden max-w-full truncate text-[9px] uppercase tracking-[0.16em] transition-colors sm:block ${
                        index === chapter
                          ? "text-white/85"
                          : "text-white/40 group-hover:text-white/70"
                      }`}
                    >
                      {stop.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** No-motion route: the same journey as a plain, readable list. */
function ReducedRoad({ onContact }: { onContact: () => void }) {
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-y-contain bg-black">
      <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-[max(6rem,calc(5rem+env(safe-area-inset-top)))] md:px-8">
        <p className="text-[11px] uppercase tracking-[0.42em] text-white/60">
          My Road
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Graduation to today
        </h2>

        <ol className="mt-8 space-y-4">
          {myRoadStops.map((stop, index) => (
            <li
              key={stop.id}
              className="rounded-sm border border-white/10 bg-white/[0.03] px-4 py-4 md:px-5 md:py-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-lg font-semibold tracking-tight text-white/92 md:text-xl">
                  <span className="mr-2 text-white/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {stop.title}
                </h3>
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/70">
                  {stop.dates}
                </p>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/70">
                {stop.role}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/72">
                {stop.outcome}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {stop.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/75"
                  >
                    <SkillIcon name={skill} size="sm" />
                    {skill}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <button
            type="button"
            onClick={onContact}
            className="min-h-11 rounded-full border border-white bg-white px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.28em] text-black transition-opacity hover:opacity-90"
          >
            Contact
          </button>
        </div>
      </div>
    </div>
  );
}
