export const FISHEYE_STRENGTH = 0.32;
export const FISHEYE_ZOOM = 0.96;

/** Forward map used by the gallery post-process: display UV → pre-warp (linear) UV. */
export function displayUvToLinearUv(
  u: number,
  v: number,
  strength = FISHEYE_STRENGTH,
  zoom = FISHEYE_ZOOM
) {
  const du = u - 0.5;
  const dv = v - 0.5;
  const r2 = du * du + dv * dv;
  const k = zoom * (1 - strength * r2);
  return {
    u: 0.5 + du * k,
    v: 0.5 + dv * k,
  };
}

/** Map flat-render UV to on-screen UV (inverse of the post-process barrel sample). */
export function linearUvToDisplayUv(
  lu: number,
  lv: number,
  strength = FISHEYE_STRENGTH,
  zoom = FISHEYE_ZOOM
) {
  let su = lu;
  let sv = lv;

  for (let i = 0; i < 14; i++) {
    const du = su - 0.5;
    const dv = sv - 0.5;
    const r2 = du * du + dv * dv;
    const k = zoom * (1 - strength * r2);
    su = 0.5 + (lu - 0.5) / k;
    sv = 0.5 + (lv - 0.5) / k;
  }

  return { u: su, v: sv };
}

export function ndcToDisplayScreen(
  ndcX: number,
  ndcY: number,
  canvasRect: DOMRect,
  strength = FISHEYE_STRENGTH,
  zoom = FISHEYE_ZOOM
) {
  const lu = (ndcX + 1) / 2;
  const lv = (-ndcY + 1) / 2;
  const { u, v } = linearUvToDisplayUv(lu, lv, strength, zoom);

  return {
    x: u * canvasRect.width + canvasRect.left,
    y: v * canvasRect.height + canvasRect.top,
  };
}

/** Convert a pointer on the warped canvas into pre-warp NDC for raycasting. */
export function displayPointerToLinearNdc(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  strength = FISHEYE_STRENGTH,
  zoom = FISHEYE_ZOOM
) {
  const displayU = (clientX - canvasRect.left) / Math.max(canvasRect.width, 1);
  const displayV = (clientY - canvasRect.top) / Math.max(canvasRect.height, 1);
  const linear = displayUvToLinearUv(displayU, displayV, strength, zoom);

  return {
    x: linear.u * 2 - 1,
    y: 1 - linear.v * 2,
  };
}
