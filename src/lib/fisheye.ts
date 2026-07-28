export const FISHEYE_STRENGTH = 0.32;
export const FISHEYE_ZOOM = 0.96;

/** Map flat-render UV to on-screen UV (inverse of the post-process barrel sample). */
export function linearUvToDisplayUv(lu: number, lv: number) {
  let su = lu;
  let sv = lv;

  for (let i = 0; i < 14; i++) {
    const du = su - 0.5;
    const dv = sv - 0.5;
    const r2 = du * du + dv * dv;
    const k = FISHEYE_ZOOM * (1 - FISHEYE_STRENGTH * r2);
    su = 0.5 + (lu - 0.5) / k;
    sv = 0.5 + (lv - 0.5) / k;
  }

  return { u: su, v: sv };
}

export function ndcToDisplayScreen(
  ndcX: number,
  ndcY: number,
  canvasRect: DOMRect
) {
  const lu = (ndcX + 1) / 2;
  const lv = (-ndcY + 1) / 2;
  const { u, v } = linearUvToDisplayUv(lu, lv);

  return {
    x: u * canvasRect.width + canvasRect.left,
    y: v * canvasRect.height + canvasRect.top,
  };
}
