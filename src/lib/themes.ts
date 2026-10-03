export const THEME_STORAGE_KEY = "portfolio-theme";
/** Season a manual pick was made in; the pick expires when the season flips. */
export const THEME_SEASON_KEY = "portfolio-theme-season";

/** Christmas runs from 1 November (month index 10) through 15 January. */
const CHRISTMAS_FROM_MONTH = 10;
const CHRISTMAS_UNTIL_JANUARY_DAY = 15;

export const themes = [
  {
    id: "night",
    label: "Default",
    background: "#050505",
    foreground: "#f5f5f5",
    accent: "#ffffff",
    accentForeground: "#050505",
    preview: "/themes/previews/night.webp",
  },
  {
    id: "christmas",
    label: "Christmas",
    background: "#6d1024",
    foreground: "#fff6ef",
    accent: "#fff8f2",
    accentForeground: "#6d1024",
    preview: "/themes/previews/christmas.webp",
  },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

/** Server-render fallback; the boot script swaps in the seasonal theme before paint. */
export const DEFAULT_THEME: ThemeId = "night";

export function seasonalTheme(date = new Date()): ThemeId {
  const month = date.getMonth();
  const christmas =
    month >= CHRISTMAS_FROM_MONTH ||
    (month === 0 && date.getDate() <= CHRISTMAS_UNTIL_JANUARY_DAY);
  return christmas ? "christmas" : "night";
}

const themeIds = themes.map((theme) => theme.id).join('","');

export const THEME_BOOT_SCRIPT = `(function(){try{var ids=["${themeIds}"];var d=new Date(),m=d.getMonth();var season=(m>=${CHRISTMAS_FROM_MONTH}||(m===0&&d.getDate()<=${CHRISTMAS_UNTIL_JANUARY_DAY}))?"christmas":"night";var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(ids.indexOf(t)===-1||localStorage.getItem("${THEME_SEASON_KEY}")!==season)t=season;document.documentElement.setAttribute("data-theme",t);var colors={night:"#050505",christmas:"#6d1024"};var meta=document.querySelector('meta[name="theme-color"]');if(meta&&colors[t])meta.setAttribute("content",colors[t]);}catch(e){}})();`;

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function themeById(id: string | null | undefined) {
  return themes.find((theme) => theme.id === id) ?? themes[0];
}

export type Rgb = { r: number; g: number; b: number };

export function parseColor(input: string): Rgb {
  const value = input.trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let body = hex[1];
    if (body.length === 3) {
      body = body
        .split("")
        .map((channel) => channel + channel)
        .join("");
    }
    const num = Number.parseInt(body, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  const rgb = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  return { r: 245, g: 245, b: 245 };
}

export function themeRgba(color: string, alpha: number) {
  const { r, g, b } = parseColor(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function isLightBackground(color: string) {
  const { r, g, b } = parseColor(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

export type ThemeColors = {
  background: string;
  foreground: string;
  accent: string;
  accentForeground: string;
};

export function readThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const fallback = themeById(document.documentElement.dataset.theme);
  const read = (name: string, fallbackValue: string) =>
    style.getPropertyValue(name).trim() || fallbackValue;

  return {
    background: read("--background", fallback.background),
    foreground: read("--foreground", fallback.foreground),
    accent: read("--accent", fallback.accent),
    accentForeground: read("--accent-foreground", fallback.accentForeground),
  };
}

export function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function syncThemeColorMeta(background: string) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", background);
  }
}
