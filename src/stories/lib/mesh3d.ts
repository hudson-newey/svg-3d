/**
 * Lightweight 3D geometry, shading, and painter-sorting helpers for Storybook
 * demos and games. Every helper emits standard SVG 3D Level 1 markup
 * (`polygon` + `zs`, `line` + `z1`/`z2`, `path3d`, etc.).
 */

export type Vec3 = [number, number, number];

export const f = (n: number): string => n.toFixed(1);

export function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale3(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function norm3(a: Vec3): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]);
  return len === 0 ? [0, 0, 0] : [a[0] / len, a[1] / len, a[2] / len];
}

export function distSq3(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export function rotateX3(p: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

export function rotateY3(p: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

export function rotateZ3(p: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

export function centroid3(pts: readonly Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  const n = pts.length || 1;
  return [x / n, y / n, z / n];
}

export function faceNormal3(pts: readonly Vec3[]): Vec3 {
  if (pts.length < 3) return [0, 0, 1];
  const a = sub3(pts[1]!, pts[0]!);
  const b = sub3(pts[2]!, pts[0]!);
  return norm3(cross3(a, b));
}

/** Multiply an #rrggbb color by a brightness factor (clamped to 0..255). */
export function shadeHex(hex: string, factor: number): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * factor)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * factor)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Emit an SVG 3D `<polygon>` with parallel `points` and `zs` attributes (spec §8). */
export function poly3d(pts: readonly Vec3[], attrs: string): string {
  const points = pts.map((p) => `${f(p[0])},${f(p[1])}`).join(" ");
  const zs = pts.map((p) => f(p[2])).join(" ");
  return `<polygon points="${points}" zs="${zs}" ${attrs}/>`;
}

/** Emit an SVG 3D `<line>` with `z1`/`z2` attributes (spec §6.1). */
export function line3d(a: Vec3, b: Vec3, attrs: string): string {
  return `<line x1="${f(a[0])}" y1="${f(a[1])}" z1="${f(a[2])}" x2="${f(b[0])}" y2="${f(b[1])}" z2="${f(b[2])}" ${attrs}/>`;
}

export interface Drawable {
  /** Sort key: larger values are drawn first (farther from camera). */
  depth: number;
  markup: string;
}

/** Painter's algorithm sort (back-to-front) for spec §3.4 document-order painting. */
export function sortDrawables(items: Drawable[]): string {
  items.sort((a, b) => b.depth - a.depth);
  return items.map((i) => i.markup).join("\n");
}

export interface MeshFace {
  verts: Vec3[];
  color?: string;
}

/** Build a centered 3D box mesh (6 quad faces). */
export function boxFaces(w: number, h: number, d: number, center: Vec3 = [0, 0, 0]): Vec3[][] {
  const [cx, cy, cz] = center;
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const v: Vec3[] = [
    [cx - hw, cy - hh, cz - hd], // 0: L T Back
    [cx + hw, cy - hh, cz - hd], // 1: R T Back
    [cx + hw, cy + hh, cz - hd], // 2: R B Back
    [cx - hw, cy + hh, cz - hd], // 3: L B Back
    [cx - hw, cy - hh, cz + hd], // 4: L T Front
    [cx + hw, cy - hh, cz + hd], // 5: R T Front
    [cx + hw, cy + hh, cz + hd], // 6: R B Front
    [cx - hw, cy + hh, cz + hd], // 7: L B Front
  ];
  const idx = [
    [0, 1, 2, 3], // back
    [4, 7, 6, 5], // front
    [0, 4, 5, 1], // top (-y)
    [3, 2, 6, 7], // bottom (+y)
    [0, 3, 7, 4], // left (-x)
    [1, 5, 6, 2], // right (+x)
  ];
  return idx.map((face) => face.map((i) => v[i]!));
}

/** Build a centered regular octahedron (8 triangular faces). */
export function octahedronFaces(r: number): Vec3[][] {
  const v: Vec3[] = [
    [0, -r, 0], // 0: top
    [r, 0, 0], // 1: right
    [0, 0, r], // 2: front
    [-r, 0, 0], // 3: left
    [0, 0, -r], // 4: back
    [0, r, 0], // 5: bottom
  ];
  const idx = [
    [0, 2, 1],
    [0, 3, 2],
    [0, 4, 3],
    [0, 1, 4],
    [5, 1, 2],
    [5, 2, 3],
    [5, 3, 4],
    [5, 4, 1],
  ];
  return idx.map((face) => face.map((i) => v[i]!));
}

/** Build a centered regular icosahedron (20 triangular faces). */
export function icosahedronFaces(r: number): Vec3[][] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw: Vec3[] = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ];
  const v = raw.map((p) => scale3(norm3(p), r));
  const idx = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  return idx.map((face) => face.map((i) => v[i]!));
}

/**
 * Emit flat-shaded, painter-ready drawables for a list of 3D faces.
 * Optionally culls backfaces relative to `camPos` when `cullBackfaces` is true.
 */
export function shadeFaces(
  faces: readonly Vec3[][],
  opts: {
    baseColor: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    lightDir?: Vec3;
    camPos: Vec3;
    cullBackfaces?: boolean;
    ambient?: number;
  },
): Drawable[] {
  const light = norm3(opts.lightDir ?? [-0.45, -0.75, 0.5]);
  const ambient = opts.ambient ?? 0.42;
  const stroke = opts.stroke ?? "rgba(15,23,42,0.45)";
  const sw = opts.strokeWidth ?? 0.8;
  const opAttr =
    opts.opacity !== undefined && opts.opacity < 1 ? ` fill-opacity="${opts.opacity}"` : "";
  const out: Drawable[] = [];
  for (const pts of faces) {
    const c = centroid3(pts);
    const n = faceNormal3(pts);
    const toCam = sub3(opts.camPos, c);
    // Double-sided lighting when not culling backfaces
    const facing = dot3(n, toCam);
    if (opts.cullBackfaces && facing <= 0) continue;
    const effectiveN = facing >= 0 ? n : scale3(n, -1);
    const ndl = Math.max(0, dot3(effectiveN, light));
    const fill = shadeHex(opts.baseColor, ambient + (1 - ambient) * ndl * 1.15);
    out.push({
      depth: distSq3(c, opts.camPos),
      markup: poly3d(
        pts,
        `fill="${fill}"${opAttr} stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`,
      ),
    });
  }
  return out;
}
