import {
  IDENTITY,
  type Mat4,
  matrix2d,
  matrix3d,
  multiply,
  rotation3d,
  rotationX,
  rotationY,
  rotationZ,
  scaling,
  translation,
} from "./mat4.ts";

/**
 * Parse a CSS/SVG `transform` list into a single 4x4 matrix.
 * Unknown functions are skipped (parsed as identity), mirroring CSS
 * error handling for invalid transform lists.
 */
export function parseTransform(value: string): Mat4 {
  let m: Mat4 = IDENTITY;
  const re = /([a-zA-Z][a-zA-Z0-9]*)\s*\(([^)]*)\)/g;
  for (const match of value.matchAll(re)) {
    const fn = match[1]!;
    const args = match[2]!
      .trim()
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map(Number);
    if (args.some((n) => Number.isNaN(n))) continue;
    m = multiply(m, transformFunction(fn, args));
  }
  return m;
}

function transformFunction(fn: string, a: number[]): Mat4 {
  switch (fn) {
    case "translate":
      return translation(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0);
    case "translate3d":
      return translation(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0);
    case "scale":
      return scaling(a[0] ?? 1, a[1] ?? a[0] ?? 1, a[2] ?? 1);
    case "scale3d":
      return scaling(a[0] ?? 1, a[1] ?? 1, a[2] ?? 1);
    case "rotate":
      return a.length >= 3
        ? multiply(
            multiply(translation(a[1] ?? 0, a[2] ?? 0, 0), rotationZ(a[0] ?? 0)),
            translation(-(a[1] ?? 0), -(a[2] ?? 0), 0),
          )
        : rotationZ(a[0] ?? 0);
    case "rotateX":
      return rotationX(a[0] ?? 0);
    case "rotateY":
      return rotationY(a[0] ?? 0);
    case "rotateZ":
      return rotationZ(a[0] ?? 0);
    case "rotate3d":
      return rotation3d(a[0] ?? 0, a[1] ?? 0, a[2] ?? 1, a[3] ?? 0);
    case "matrix":
      return matrix2d(a[0] ?? 1, a[1] ?? 0, a[2] ?? 0, a[3] ?? 1, a[4] ?? 0, a[5] ?? 0);
    case "matrix3d":
      return matrix3d(a);
    default:
      return IDENTITY;
  }
}
