/** Row-major 4x4 matrix, operating on affine 3D points (w = 1). */
export type Vec3 = [number, number, number];
export type Mat4 = number[]; // 16 entries, row-major: m[row * 4 + col]

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = Array.from({ length: 16 }, () => 0);
  for (let r = 0; r < 4; r++) {
    const a0 = a[r * 4]!;
    const a1 = a[r * 4 + 1]!;
    const a2 = a[r * 4 + 2]!;
    const a3 = a[r * 4 + 3]!;
    for (let c = 0; c < 4; c++) {
      out[r * 4 + c] = a0 * b[c]! + a1 * b[4 + c]! + a2 * b[8 + c]! + a3 * b[12 + c]!;
    }
  }
  return out;
}

export function applyPoint(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0]! * p[0] + m[1]! * p[1] + m[2]! * p[2] + m[3]!,
    m[4]! * p[0] + m[5]! * p[1] + m[6]! * p[2] + m[7]!,
    m[8]! * p[0] + m[9]! * p[1] + m[10]! * p[2] + m[11]!,
  ];
}

export function translation(tx: number, ty: number, tz: number): Mat4 {
  return [1, 0, 0, tx, 0, 1, 0, ty, 0, 0, 1, tz, 0, 0, 0, 1];
}

export function scaling(sx: number, sy: number, sz: number): Mat4 {
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
}

export function rotationX(deg: number): Mat4 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}

export function rotationY(deg: number): Mat4 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

export function rotationZ(deg: number): Mat4 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** 2D `matrix(a, b, c, d, e, f)` lifted to 3D. */
export function matrix2d(a: number, b: number, c: number, d: number, e: number, f: number): Mat4 {
  return [a, c, 0, e, b, d, 0, f, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** `matrix3d(m00..m23)` in CSS column-major order. */
export function matrix3d(v: number[]): Mat4 {
  // CSS order: m11 m12 m13 m14, m21 m22 m23 m24, ... (column-major)
  // row-major[r][c] = v[c * 4 + r]
  const m: Mat4 = Array.from({ length: 16 }, () => 0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      m[r * 4 + c] = v[c * 4 + r] ?? 0;
    }
  }
  return m;
}

/** `rotate3d(ax, ay, az, angle)` — normalized axis, right-handed. */
export function rotation3d(ax: number, ay: number, az: number, deg: number): Mat4 {
  const len = Math.hypot(ax, ay, az);
  if (len === 0) return IDENTITY;
  const x = ax / len;
  const y = ay / len;
  const z = az / len;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    0,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    0,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
    0,
    0,
    0,
    0,
    1,
  ];
}
