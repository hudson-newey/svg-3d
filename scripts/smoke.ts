/**
 * Node smoke test for the projection + path3d pipeline (no DOM needed).
 * Run: node scripts/smoke.ts
 */
import { IDENTITY, applyPoint } from "../src/lib/mat4.ts";
import { parseTransform } from "../src/lib/transform.ts";
import { DEFAULT_CAMERA, projectPoint, toView, viewBasis } from "../src/lib/camera.ts";
import { flattenPath3d } from "../src/lib/path3d.ts";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown, eps = 1e-6): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok =
    Array.isArray(actual) && Array.isArray(expected)
      ? actual.length === expected.length &&
        actual.every((v, i) => Math.abs(v - (expected as number[])[i]!) <= eps)
      : a === e;
  if (!ok) {
    failures++;
    console.error(`FAIL ${name}: got ${a}, expected ${e}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// 1. Default camera: identity projection, z invisible.
const b0 = viewBasis(DEFAULT_CAMERA)!;
check("default view of (50,60,70)", toView(b0, [50, 60, 70]), [50, 60, 70]);
check("default ortho project", projectPoint([50, 60, 70], DEFAULT_CAMERA, 160), [50, 60]);

// 2. Perspective: aim point lands on the film origin (D-11).
const cam = {
  projection: "perspective" as const,
  position: [220, 180, 280] as [number, number, number],
  target: [50, 50, 50] as [number, number, number],
  up: [0, 1, 0] as [number, number, number],
  fov: 50,
  near: 0,
  far: Number.POSITIVE_INFINITY,
};
const bp = viewBasis(cam)!;
const center = toView(bp, [50, 50, 50]);
check("target projects to origin", projectPoint(center, cam, 160), [0, 0], 1e-3);
// D = 80 / tan(25deg) ~= 171.55; d ~= 314.17; half-box (100,50,50) vs center:
// xv = (100-50) along x_cam... check rightward point lands right of origin.
const side = toView(bp, [150, 50, 50]);
const sideP = projectPoint(side, cam, 160)!;
check("side point is to the right", sideP[0] > 0 ? 1 : 0, 1);

// 3. Depth culling: point behind the camera is culled.
const behind = toView(bp, [390, 310, 510]);
check("point behind camera culled", projectPoint(behind, cam, 160), null);

// 4. near/far clipping.
check("far clip culled", projectPoint(center, { ...cam, near: 0, far: 100 }, 160), null);
check("near clip culled", projectPoint(center, { ...cam, near: 1000 }, 160), null);

// 5. Transforms.
check(
  "rotateX(90) maps y to z",
  applyPoint(parseTransform("rotateX(90)"), [0, 1, 0]),
  [0, 0, 1],
  1e-9,
);
check(
  "rotateZ(90) maps x to y",
  applyPoint(parseTransform("rotateZ(90)"), [1, 0, 0]),
  [0, 1, 0],
  1e-9,
);
check(
  "rotate about point",
  applyPoint(parseTransform("rotate(90, 10, 10)"), [20, 10, 0]),
  [10, 20, 0],
  1e-9,
);
check(
  "translate3d + scale3d chain",
  applyPoint(parseTransform("translate3d(1 2 3) scale3d(2 2 2)"), [1, 1, 1]),
  [3, 4, 5],
  1e-9,
);
check("identity parse", parseTransform("nonsense(1)"), IDENTITY);

// 6. path3d parsing.
const sub1 = flattenPath3d("M 10,10,0 L 80,60,40");
check(
  "path3d line subpaths",
  [sub1.length, sub1[0]!.points.length, sub1[0]!.closed],
  [1, 2, false],
);
check("path3d line end", sub1[0]!.points[1], [80, 60, 40]);

const rel = flattenPath3d("m 10,10,5 l 5,5,5 h 5 v 5 z");
check(
  "relative h/v keep z",
  rel[0]!.points.map((p) => p[2]),
  [5, 10, 10, 10],
);

const cubic = flattenPath3d("M 0,0,0 C 0,0,10 0,0,10 0,0,20");
check("cubic samples", [cubic[0]!.points.length, cubic[0]!.points.at(-1)![2]], [25, 20], 0);

const closed = flattenPath3d("M 0,0,0 L 10,0,0 L 10,10,0 Z");
check("closed subpath", [closed[0]!.closed, closed[0]!.points.length], [true, 3]);

// Error handling: parse stops, keeps well-formed prefix (§7.4).
const partial = flattenPath3d("M 1,2,3 L 4,5,6 L 7,8"); // missing z
check("error truncation keeps prefix", [partial.length, partial[0]!.points.length], [1, 2]);

// Arc: quarter circle from (0,0) to (100,100) r=100 sweep=1.
const arc = flattenPath3d("M 0,0,0 A 100,100,0 0,1 100,100,50");
const last = arc[0]!.points.at(-1)!;
check("arc endpoint", last, [100, 100, 50], 1e-6);
check(
  "arc stays in bounding region",
  [
    Math.min(...arc[0]!.points.map((p) => p[0])) >= -1 ? 1 : 0,
    Math.max(...arc[0]!.points.map((p) => p[1])) <= 101 ? 1 : 0,
  ],
  [1, 1],
);

// 7. S/T reflection in 3D.
const refl = flattenPath3d("M 0,0,0 C 10,0,10 20,0,20 30,0,30 S 50,0,50 60,0,60");
check("S reflection parses", refl[0]!.points.length > 24 ? 1 : 0, 1);

console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
