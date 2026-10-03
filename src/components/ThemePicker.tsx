"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  DEFAULT_THEME,
  isThemeId,
  seasonalTheme,
  subscribeTheme,
  syncThemeColorMeta,
  THEME_SEASON_KEY,
  THEME_STORAGE_KEY,
  themeById,
  themes,
  type ThemeId,
} from "@/lib/themes";

type ThemePickerProps = {
  hidden?: boolean;
};

export function ThemePicker({ hidden = false }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const [wasHidden, setWasHidden] = useState(hidden);
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  if (hidden !== wasHidden) {
    setWasHidden(hidden);
    if (hidden) {
      setOpen(false);
    }
  }

  useEffect(() => {
    const read = () => {
      const current = document.documentElement.dataset.theme;
      if (isThemeId(current)) {
        setThemeId(current);
      }
    };
    read();
    return subscribeTheme(read);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const apply = (id: ThemeId, close: boolean) => {
    const theme = themeById(id);
    document.documentElement.setAttribute("data-theme", theme.id);
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    localStorage.setItem(THEME_SEASON_KEY, seasonalTheme());
    syncThemeColorMeta(theme.background);
    setThemeId(theme.id);
    if (close) {
      setOpen(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (!open) {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !backward) {
      return;
    }

    event.preventDefault();
    const index = themes.findIndex((theme) => theme.id === themeId);
    const step = forward ? 1 : -1;
    const next = themes[(index + step + themes.length) % themes.length];
    apply(next.id, false);
  };

  const current = themeById(themeId);

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="relative flex shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Theme: ${current.label}`}
        tabIndex={hidden ? -1 : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-foreground/20 bg-background/[0.88] p-1 pr-3 text-foreground/85 backdrop-blur-md transition-colors hover:border-foreground/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground md:gap-2.5 md:pr-4"
      >
        <span
          className="h-11 w-11 shrink-0 rounded-full bg-cover bg-center ring-1 ring-foreground/25 md:h-12 md:w-12"
          style={{ backgroundImage: `url(${current.preview})` }}
          aria-hidden
        />
        <svg
          viewBox="0 0 12 12"
          className={`h-2.5 w-2.5 shrink-0 transition-transform ${open ? "" : "rotate-180"}`}
          aria-hidden
        >
          <path
            d="M2.2 4.2 6 8l3.8-3.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute bottom-[calc(100%+0.75rem)] right-0 w-[min(calc(100vw-1.5rem),23rem)] rounded-3xl border border-foreground/15 bg-background/90 p-3 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <p className="px-1.5 pb-3 pt-1 text-[10px] uppercase tracking-[0.32em] text-foreground/70">
            Theme
          </p>
          <ul
            id={listId}
            role="listbox"
            aria-label="Theme"
            className="grid grid-cols-2 gap-2.5"
          >
            {themes.map((theme) => {
              const selected = theme.id === themeId;
              return (
                <li key={theme.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => apply(theme.id, true)}
                    className={`group relative block aspect-[16/10] w-full overflow-hidden rounded-2xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-foreground ${
                      selected
                        ? "ring-2 ring-accent"
                        : "ring-1 ring-foreground/15 hover:ring-foreground/45"
                    }`}
                  >
                    <span
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${theme.preview})` }}
                      aria-hidden
                    />
                    <span
                      className="absolute inset-x-0 bottom-0 h-3/4"
                      style={{
                        background: `linear-gradient(to top, ${theme.background}eb 0%, ${theme.background}80 45%, transparent 100%)`,
                      }}
                      aria-hidden
                    />
                    <span className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2">
                      <span
                        className="text-[10px] font-medium uppercase tracking-[0.22em]"
                        style={{ color: theme.foreground }}
                      >
                        {theme.label}
                      </span>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15"
                        style={{ backgroundColor: theme.accent }}
                        aria-hidden
                      />
                    </span>
                    {selected ? (
                      <span
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full shadow-sm"
                        style={{
                          backgroundColor: theme.accent,
                          color: theme.accentForeground,
                        }}
                        aria-hidden
                      >
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                          <path
                            d="M2.5 6.2 5 8.6l4.5-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
