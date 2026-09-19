/**
 * Minimal 3D helpers for the My Road flight.
 *
 * The route is a Catmull-Rom spline through waypoints that advance steadily in
 * z, so the spline parameter doubles as "distance flown" — the camera can be
 * driven by a single scalar and still bank correctly through the curves.
 */

export type Vec3 = { x: number; y: number; z: number };

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** Catmull-Rom sample. `u` is in waypoint units and clamped to the ends. */
export function samplePath(points: Vec3[], u: number): Vec3 {
  const last = points.length - 1;
  const clamped = Math.max(0, Math.min(last, u));
  const i = Math.min(last - 1, Math.floor(clamped));
  const t = clamped - i;

  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[Math.min(last, i + 1)];
  const p3 = points[Math.min(last, i + 2)];

  const t2 = t * t;
  const t3 = t2 * t;

  const at = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);

  return {
    x: at(p0.x, p1.x, p2.x, p3.x),
    y: at(p0.y, p1.y, p2.y, p3.y),
    z: at(p0.z, p1.z, p2.z, p3.z),
  };
}

/** Forward direction at `u`, sampled symmetrically so curves stay smooth. */
export function pathTangent(points: Vec3[], u: number, h = 0.02): Vec3 {
  const ahead = samplePath(points, u + h);
  const behind = samplePath(points, u - h);
  return normalize(sub(ahead, behind));
}

export type Camera = {
  position: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  /** Screen-space roll in radians (banking) */
  roll: number;
  focal: number;
  width: number;
  height: number;
};

const WORLD_UP = vec(0, 1, 0);

export function buildCamera(
  position: Vec3,
  forward: Vec3,
  roll: number,
  focal: number,
  width: number,
  height: number
): Camera {
  const f = normalize(forward);
  const right = normalize(cross(WORLD_UP, f));
  const up = cross(f, right);
  return { position, forward: f, right, up, roll, focal, width, height };
}

export type Projected = {
  x: number;
  y: number;
  /** Distance in front of the camera; <= 0 means behind it */
  depth: number;
  /** Multiply world sizes by this to get screen sizes */
  scale: number;
};

export function project(camera: Camera, point: Vec3): Projected {
  const d = sub(point, camera.position);
  const depth = dot(d, camera.forward);

  if (depth <= 0.05) {
    return { x: 0, y: 0, depth, scale: 0 };
  }

  const cx = dot(d, camera.right);
  const cy = dot(d, camera.up);
  const cos = Math.cos(camera.roll);
  const sin = Math.sin(camera.roll);
  const rx = cx * cos - cy * sin;
  const ry = cx * sin + cy * cos;
  const scale = camera.focal / depth;

  return {
    x: camera.width / 2 + rx * scale,
    y: camera.height / 2 - ry * scale,
    depth,
    scale,
  };
}

/** Point offset sideways/upward from the path centre, in the path's own frame. */
export function offsetFromPath(
  points: Vec3[],
  u: number,
  side: number,
  lift: number
): Vec3 {
  const centre = samplePath(points, u);
  const forward = pathTangent(points, u);
  const right = normalize(cross(WORLD_UP, forward));
  const up = cross(forward, right);
  return {
    x: centre.x + right.x * side + up.x * lift,
    y: centre.y + right.y * side + up.y * lift,
    z: centre.z + right.z * side + up.z * lift,
  };
}
