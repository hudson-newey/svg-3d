/** Camera parsing and the view/projection stages of spec §5. */
import type { Vec3 } from "./mat4.ts";

export type Projection = "orthographic" | "perspective";

export interface CameraDef {
  projection: Projection;
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number; // degrees
  near: number | null; // null = unbounded (no near clipping)
  far: number | null; // null = unbounded (no far clipping)
}

/** The default camera of spec §5.5: identity view, orthographic. */
export const DEFAULT_CAMERA: CameraDef = {
  projection: "orthographic",
  position: [0, 0, 0],
  target: [0, 0, -1],
  up: [0, 1, 0],
  fov: 45,
  near: null,
  far: null,
};

export interface Basis {
  x: Vec3;
  y: Vec3;
  z: Vec3;
  p: Vec3;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l === 0 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
}

/** View basis per spec §5.4; null when the camera is degenerate (§5.4/§13). */
export function viewBasis(cam: CameraDef): Basis | null {
  const z = norm(sub(cam.position, cam.target));
  const x = norm(cross(cam.up, z));
  const y = cross(z, x);
  if (x.every((v) => v === 0) || y.every((v) => v === 0)) return null;
  return { x, y, z, p: cam.position };
}

function parseVec3(value: string | null): Vec3 | null {
  if (value === null) return null;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return parts as Vec3;
}

export function parseCameraElement(el: Element): CameraDef {
  const cam: CameraDef = { ...DEFAULT_CAMERA };
  const proj = el.getAttribute("projection");
  if (proj === "orthographic" || proj === "perspective") cam.projection = proj;
  const v3 = (name: string): Vec3 | null => parseVec3(el.getAttribute(name));
  cam.position = v3("position") ?? cam.position;
  cam.target = v3("target") ?? cam.target;
  cam.up = v3("up") ?? cam.up;
  const num = (name: string): number | null => {
    const raw = el.getAttribute(name);
    if (raw === null) return null;
    const v = Number(raw);
    return Number.isNaN(v) ? null : v;
  };
  cam.fov = num("fov") ?? cam.fov;
  const near = num("near");
  cam.near = near ?? null;
  const far = num("far");
  cam.far = far ?? null;
  return cam;
}

/** View-space coordinates of a world point (spec §5.4). */
export function toView(basis: Basis, q: Vec3): Vec3 {
  const d = sub(q, basis.p);
  return [dot(d, basis.x), dot(d, basis.y), dot(d, basis.z)];
}

/**
 * Project a view-space point onto the film plane (viewBox coordinates),
 * per spec §5.4 (film anchored at the viewBox origin, no y flip).
 * Returns null when the point is not visible (§5.6 depth culling).
 */
export function projectPoint(
  qv: Vec3,
  cam: CameraDef,
  viewBoxHeight: number,
): [number, number] | null {
  const d = -qv[2]; // distance in front of the camera
  if (cam.near !== null && !(d >= cam.near)) return null;
  if (cam.far !== null && !(d < cam.far)) return null;
  if (cam.projection === "orthographic") return [qv[0]!, qv[1]!];
  if (d <= 0) return null; // at/behind the camera plane (perspective only)
  const D = viewBoxHeight / 2 / Math.tan((cam.fov * Math.PI) / 360);
  return [(qv[0]! * D) / d, (qv[1]! * D) / d];
}
