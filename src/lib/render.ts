/**
 * Project-early renderer (spec §3.1): walk a parsed SVG 3D document, project
 * all geometry through the active camera, and emit a plain SVG 2 document
 * containing the projected outlines. The browser then paints it with the
 * unmodified SVG paint model.
 */
import {
  DEFAULT_CAMERA,
  type Basis,
  type CameraDef,
  parseCameraElement,
  projectPoint,
  toView,
  viewBasis,
} from "./camera.ts";
import { IDENTITY, type Mat4, applyPoint, multiply } from "./mat4.ts";
import { type P3, type Subpath, flattenPath3d } from "./path3d.ts";
import { parseTransform } from "./transform.ts";

const SVG_NS = "http://www.w3.org/2000/svg";
export const SUPPORTED_EXTENSIONS = "urn:svg3d:1.0";

/** Elements copied verbatim so `url(#…)` references keep resolving. */
const RESOURCE_ELEMENTS = new Set([
  "defs",
  "linearGradient",
  "radialGradient",
  "pattern",
  "filter",
  "marker",
  "clipPath",
  "mask",
  "symbol",
  "style",
  "metadata",
  "title",
  "desc",
]);

/** Elements the projector renders itself; anything else in a <switch> fallback is copied verbatim. */
const PROJECTABLE = new Set([
  "line",
  "rect",
  "circle",
  "ellipse",
  "polyline",
  "polygon",
  "path3d",
  "text",
  "g",
  "svg",
  "a",
]);

/** Attributes consumed by the projector; never copied to the output. */
const GEOMETRY_ATTRS = new Set([
  "transform",
  "id",
  "camera",
  // shapes
  "x",
  "y",
  "width",
  "height",
  "rx",
  "ry",
  "cx",
  "cy",
  "r",
  "cz",
  "x1",
  "y1",
  "x2",
  "y2",
  "z",
  "z1",
  "z2",
  "dz",
  "zs",
  "points",
  "d",
  // text lists
  "dx",
]);

export type WarnFn = (message: string) => void;

interface LocalGeometry {
  subpaths: Subpath[];
}

export function renderSvg3d(root: SVGSVGElement, warn: WarnFn = () => {}): SVGSVGElement {
  const out = document.createElementNS(SVG_NS, "svg");
  for (const attr of root.attributes) {
    if (GEOMETRY_ATTRS.has(attr.name)) continue;
    out.setAttribute(attr.name, attr.value);
  }
  if (!out.hasAttribute("xmlns")) out.setAttribute("xmlns", SVG_NS);

  const camera = resolveCamera(root);
  const basis = viewBasis(camera) ?? viewBasis(DEFAULT_CAMERA)!;
  const vbH = viewBoxHeight(root);

  // Copy resource elements verbatim so paint-server references still resolve.
  for (const child of elementChildren(root)) {
    if (
      RESOURCE_ELEMENTS.has(child.tagName) &&
      child.tagName !== "title" &&
      child.tagName !== "desc"
    ) {
      out.appendChild(document.importNode(child, true));
    }
  }

  for (const child of elementChildren(root)) {
    if (RESOURCE_ELEMENTS.has(child.tagName)) continue;
    renderNode(child, out, IDENTITY, camera, basis, vbH, warn);
  }
  return out;
}

function viewBoxHeight(root: SVGSVGElement): number {
  const vb = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return vb.length === 4 && vb.every((n) => !Number.isNaN(n)) && vb[3] !== 0 ? Math.abs(vb[3]!) : 1;
}

function resolveCamera(root: SVGSVGElement): CameraDef {
  const ref = root.getAttribute("camera");
  if (ref) {
    const id = ref.startsWith("#") ? ref.slice(1) : ref;
    const el = root.getElementById(id);
    if (el?.tagName === "camera") return parseCameraElement(el);
  }
  for (const child of elementChildren(root)) {
    if (child.tagName === "camera") return parseCameraElement(child);
  }
  return DEFAULT_CAMERA;
}

function elementChildren(el: Element): Element[] {
  return [...el.children];
}

function renderNode(
  el: Element,
  parentOut: Element,
  model: Mat4,
  camera: CameraDef,
  basis: Basis,
  vbH: number,
  warn: WarnFn,
): void {
  switch (el.tagName) {
    case "g":
    case "svg":
    case "a": {
      const g = mirror(el, parentOut);
      renderChildren(
        el,
        g,
        multiply(model, parseTransform(el.getAttribute("transform") ?? "")),
        camera,
        basis,
        vbH,
        warn,
      );
      return;
    }
    case "switch": {
      const chosen = pickSwitchChild(el);
      if (chosen) {
        const g = mirror(el, parentOut);
        if (PROJECTABLE.has(chosen.tagName)) {
          renderNode(
            chosen,
            g,
            multiply(model, parseTransform(chosen.getAttribute("transform") ?? "")),
            camera,
            basis,
            vbH,
            warn,
          );
        } else {
          // Non-3D fallback content: copy verbatim (authored flat, no projection).
          g.appendChild(document.importNode(chosen, true));
        }
      }
      return;
    }
    case "line":
    case "rect":
    case "circle":
    case "ellipse":
    case "polyline":
    case "polygon":
    case "path3d": {
      const geom = extractGeometry(el);
      if (!geom) return;
      const local = multiply(model, parseTransform(el.getAttribute("transform") ?? ""));
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", projectGeometry(geom.subpaths, local, camera, basis, vbH));
      copyPaintAttrs(el, path);
      parentOut.appendChild(path);
      return;
    }
    case "text":
    case "tspan": {
      renderText(
        el,
        parentOut,
        multiply(model, parseTransform(el.getAttribute("transform") ?? "")),
        camera,
        basis,
        vbH,
      );
      return;
    }
    case "image":
    case "use":
    case "animateMotion":
      warn(`unsupported element <${el.tagName}> skipped`);
      return;
    case "animate":
    case "animateTransform":
    case "set":
    case "discard":
    case "camera":
    case "animateColor":
      return; // static snapshot: declarative animation elements are inert here
    default:
      warn(`unknown element <${el.tagName}> skipped`);
      return;
  }
}

function renderChildren(
  el: Element,
  outParent: Element,
  model: Mat4,
  camera: CameraDef,
  basis: Basis,
  vbH: number,
  warn: WarnFn,
): void {
  for (const child of elementChildren(el)) {
    renderNode(child, outParent, model, camera, basis, vbH, warn);
  }
}

/** spec §12.2: first child whose requiredExtensions is absent, empty, or ours. */
function pickSwitchChild(el: Element): Element | null {
  for (const child of elementChildren(el)) {
    const req = child.getAttribute("requiredExtensions");
    if (req === null || req === "" || req === SUPPORTED_EXTENSIONS) return child;
  }
  return null;
}

function mirror(el: Element, parentOut: Element): Element {
  const g = document.createElementNS(SVG_NS, "g");
  copyPaintAttrs(el, g);
  parentOut.appendChild(g);
  return g;
}

function copyPaintAttrs(from: Element, to: Element): void {
  for (const attr of from.attributes) {
    if (!GEOMETRY_ATTRS.has(attr.name)) to.setAttribute(attr.name, attr.value);
  }
}

// ---------------------------------------------------------------------------
// Geometry extraction (local 3D space, before the model transform)
// ---------------------------------------------------------------------------

function extractGeometry(el: Element): LocalGeometry | null {
  switch (el.tagName) {
    case "line": {
      const x1 = num(el, "x1");
      const x2 = num(el, "x2");
      if (x1 === null || x2 === null) return null;
      return {
        subpaths: [
          {
            points: [
              [x1, num(el, "y1") ?? 0, num(el, "z1") ?? 0],
              [x2, num(el, "y2") ?? 0, num(el, "z2") ?? 0],
            ],
            closed: false,
          },
        ],
      };
    }
    case "rect": {
      const { subpaths } = rectGeometry(
        num(el, "x") ?? 0,
        num(el, "y") ?? 0,
        num(el, "width") ?? 0,
        num(el, "height") ?? 0,
        num(el, "rx") ?? 0,
        num(el, "ry") ?? 0,
        num(el, "z") ?? 0,
      );
      return { subpaths };
    }
    case "circle":
      return ellipseGeometry(
        num(el, "cx") ?? 0,
        num(el, "cy") ?? 0,
        num(el, "r") ?? 0,
        num(el, "r") ?? 0,
        num(el, "cz") ?? 0,
      );
    case "ellipse":
      return ellipseGeometry(
        num(el, "cx") ?? 0,
        num(el, "cy") ?? 0,
        num(el, "rx") ?? 0,
        num(el, "ry") ?? 0,
        num(el, "cz") ?? 0,
      );
    case "polyline":
    case "polygon":
      return pointsGeometry(
        el.getAttribute("points") ?? "",
        el.getAttribute("zs") ?? "",
        el.tagName === "polygon",
      );
    case "path3d":
      return { subpaths: flattenPath3d(el.getAttribute("d") ?? "") };
    default:
      return null;
  }
}

function num(el: Element, name: string): number | null {
  const v = Number(el.getAttribute(name));
  return Number.isNaN(v) ? null : v;
}

function rectGeometry(
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  ry: number,
  z: number,
): LocalGeometry {
  if (w <= 0 || h <= 0) return { subpaths: [] };
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry > 0 ? ry : rx, h / 2);
  const pts: P3[] = [];
  if (rx <= 0 || ry <= 0) {
    pts.push([x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]);
  } else {
    // Corner-circle centers with their arc angle ranges; sampled clockwise.
    const corners: Array<[number, number, number, number]> = [
      [x + w - rx, y + ry, -Math.PI / 2, 0],
      [x + w - rx, y + h - ry, 0, Math.PI / 2],
      [x + rx, y + h - ry, Math.PI / 2, Math.PI],
      [x + rx, y + ry, Math.PI, Math.PI * 1.5],
    ];
    const steps = 6;
    for (const [cx, cy, a0, a1] of corners) {
      for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps;
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a), z]);
      }
    }
  }
  return { subpaths: [{ points: pts, closed: true }] };
}

function ellipseGeometry(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  cz: number,
): LocalGeometry {
  if (rx <= 0 || ry <= 0) return { subpaths: [] };
  const n = 72;
  const pts: P3[] = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a), cz]);
  }
  return { subpaths: [{ points: pts, closed: true }] };
}

/** `points` per SVG 2 (odd count: last coordinate dropped) + parallel `zs`. */
function pointsGeometry(points: string, zs: string, closed: boolean): LocalGeometry {
  const nums = points
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (nums.some((n) => Number.isNaN(n))) return { subpaths: [] };
  const count = Math.floor(nums.length / 2); // odd: drop last (spec G5)
  const zList = zs
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  const pts: P3[] = [];
  for (let i = 0; i < count; i++) {
    pts.push([nums[i * 2]!, nums[i * 2 + 1]!, zList[i] ?? 0]);
  }
  if (pts.length < (closed ? 3 : 2)) return { subpaths: [] };
  return { subpaths: [{ points: pts, closed }] };
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function projectGeometry(
  subpaths: Subpath[],
  model: Mat4,
  camera: CameraDef,
  basis: Basis,
  vbH: number,
): string {
  const runs: string[] = [];
  for (const sub of subpaths) {
    let run: string[] = [];
    const emitRun = () => {
      if (run.length >= 2) runs.push(`M ${run[0]} L ${run.slice(1).join(" L ")}`);
      run = [];
    };
    for (const p of sub.points) {
      const f = projectOne(p, model, camera, basis, vbH);
      if (f) run.push(`${fmt(f[0])},${fmt(f[1])}`);
      else emitRun(); // culled point: break the polyline (§5.6)
    }
    if (sub.closed && run.length >= 3) run.push(run[0]!);
    emitRun();
  }
  return runs.join(" ");
}

function projectOne(
  p: P3,
  model: Mat4,
  camera: CameraDef,
  basis: Basis,
  vbH: number,
): [number, number] | null {
  const world = applyPoint(model, p);
  const view = toView(basis, world);
  return projectPoint(view, camera, vbH);
}

export function fmt(n: number): string {
  return String(Number(n.toFixed(4)));
}

// ---------------------------------------------------------------------------
// Text (v1: per-character positioning from x/y/z lists, dx/dy ignored)
// ---------------------------------------------------------------------------

function renderText(
  el: Element,
  parentOut: Element,
  model: Mat4,
  camera: CameraDef,
  basis: Basis,
  vbH: number,
): void {
  const text = el.textContent ?? "";
  if (!text.trim()) return;
  const list = (name: string): (number | null)[] => {
    const raw = el.getAttribute(name);
    if (raw === null) return [];
    return raw
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((s) => {
        const v = Number(s);
        return Number.isNaN(v) ? null : v;
      });
  };
  const xs = list("x");
  const ys = list("y");
  const zs = list("z");
  const chars = [...text];
  const g = mirror(el, parentOut);
  g.removeAttribute("x");
  g.removeAttribute("y");
  g.removeAttribute("z");
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === undefined) break;
    const x = xs[i] ?? xs[xs.length - 1];
    const y = ys[i] ?? ys[ys.length - 1];
    const z = zs[i] ?? zs[zs.length - 1] ?? 0;
    if (x === null || x === undefined || y === null || y === undefined) break;
    const f = projectOne([x, y, z ?? 0], model, camera, basis, vbH);
    if (!f) continue;
    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", fmt(f[0] ?? 0));
    t.setAttribute("y", fmt(f[1] ?? 0));
    t.textContent = ch === " " ? " " : ch;
    g.appendChild(t);
  }
}
