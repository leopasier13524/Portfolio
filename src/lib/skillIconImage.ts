import { skillIcons } from "./skillIcons";

export type SkillSprite = {
  name: string;
  image: HTMLImageElement;
  /** width / height of the source artwork */
  aspect: number;
  loaded: boolean;
};

const RASTER = 160;

/**
 * Turns a skill logo into an <img> the canvas can draw. Data-URL SVGs keep the
 * canvas untainted, and the single-colour glyphs inherit `currentColor`, so the
 * brand colour has to be set on the root element.
 */
export function createSkillSprite(name: string): SkillSprite | null {
  const icon = skillIcons[name];
  if (!icon) {
    return null;
  }

  const [, , rawWidth, rawHeight] = icon.viewBox.split(/\s+/).map(Number);
  const vw = rawWidth || 1;
  const vh = rawHeight || 1;
  const longest = Math.max(vw, vh);
  const width = Math.round((RASTER * vw) / longest);
  const height = Math.round((RASTER * vh) / longest);
  const colour = icon.color ?? "#ffffff";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ` +
    `width="${width}" height="${height}" style="color:${colour}">${icon.body}</svg>`;

  const sprite: SkillSprite = {
    name,
    image: new Image(),
    aspect: vw / vh,
    loaded: false,
  };

  sprite.image.decoding = "sync";
  sprite.image.onload = () => {
    sprite.loaded = true;
  };
  sprite.image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return sprite;
}
