/**
 * Parser + flattener for the `path3d` `d` grammar (spec §7.2): the SVG 2
 * `svg-path` grammar with every coordinate pair replaced by a coordinate
 * triple (x y z). Error handling follows spec §7.4 / SVG 2 §9.5.4: parsing
 * stops at the first error, keeping the segments parsed so far.
 */
export type P3 = [number, number, number];

export interface Subpath {
  points: P3[];
  closed: boolean;
}

const NUM_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/;
const CURVE_SAMPLES = 24;
const ARC_SAMPLES = 32;

class Scanner {
  i = 0;
  readonly s: string;
  constructor(s: string) {
    this.s = s;
  }

  private skip(): void {
    while (this.i < this.s.length && /[\s,]/.test(this.s[this.i]!)) this.i++;
  }

  number(): number | null {
    this.skip();
    const m = NUM_RE.exec(this.s.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return Number.parseFloat(m[0]);
  }

  command(): string | null {
    this.skip();
    const ch = this.s[this.i];
    if (ch !== undefined && /[a-zA-Z]/.test(ch)) {
      this.i++;
      return ch;
    }
    return null;
  }

  flag(): number | null {
    this.skip();
    const ch = this.s[this.i];
    if (ch === "0" || ch === "1") {
      this.i++;
      return Number(ch);
    }
    return null;
  }

  atEnd(): boolean {
    this.skip();
    return this.i >= this.s.length;
  }
}

const TAU = Math.PI * 2;

function cubicPoint(p0: P3, c1: P3, c2: P3, p1: P3, t: number): P3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1],
    a * p0[2] + b * c1[2] + c * c2[2] + d * p1[2],
  ];
}

function quadPoint(p0: P3, c: P3, p1: P3, t: number): P3 {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
    u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
    u * u * p0[2] + 2 * u * t * c[2] + t * t * p1[2],
  ];
}

/** Flatten one SVG endpoint arc (F.6.5) into 3D points; z is linear in t. */
function arcPoints(
  from: P3,
  to: P3,
  rx: number,
  ry: number,
  phiDeg: number,
  laf: number,
  sf: number,
  n: number,
): P3[] | null {
  if (rx === 0 || ry === 0) return [to];
  const phi = (phiDeg * Math.PI) / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  let rx2 = rx * rx;
  let ry2 = ry * ry;
  const lambda = (x1p * x1p) / rx2 + (y1p * y1p) / ry2;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rx2 = rx * rx;
    ry2 = ry * ry;
  }
  const denom = rx2 * y1p * y1p + ry2 * x1p * x1p;
  if (denom === 0) return null;
  // F.6.5: the square-root sign is + if laf != sf, else -
  const cRoot = (laf !== sf ? 1 : -1) * Math.sqrt(Math.max(0, (rx2 * ry2 - denom) / denom));
  const cxp = (cRoot * rx * y1p) / ry;
  const cyp = (-cRoot * ry * x1p) / rx;
  const cx = cosP * cxp - sinP * cyp + (from[0] + to[0]) / 2;
  const cy = sinP * cxp + cosP * cyp + (from[1] + to[1]) / 2;
  const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  const theta2 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);
  let dTheta = theta2 - theta1;
  if (sf === 0 && dTheta > 0) dTheta -= TAU;
  if (sf === 1 && dTheta < 0) dTheta += TAU;
  const pts: P3[] = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const theta = theta1 + dTheta * t;
    pts.push([
      cx + rx * Math.cos(theta) * cosP - ry * Math.sin(theta) * sinP,
      cy + rx * Math.cos(theta) * sinP + ry * Math.sin(theta) * cosP,
      from[2] + (to[2] - from[2]) * t,
    ]);
  }
  return pts;
}

export function flattenPath3d(d: string): Subpath[] {
  const out: Subpath[] = [];
  const sc = new Scanner(d);
  let cur: P3 = [0, 0, 0];
  let subStart: P3 = [0, 0, 0];
  let points: P3[] = [];
  let closed = false;
  let prevCubic: P3 | null = null;
  let prevQuad: P3 | null = null;
  let lastCmd = "";

  const flush = () => {
    if (points.length >= (closed ? 3 : 2)) out.push({ points, closed });
    points = [];
    closed = false;
  };

  const triplet = (rel: boolean): P3 | null => {
    const x = sc.number();
    const y = sc.number();
    const z = sc.number();
    if (x === null || y === null || z === null) return null;
    return rel ? [cur[0] + x, cur[1] + y, cur[2] + z] : [x, y, z];
  };
  const push = (p: P3) => {
    points.push(p);
    cur = p;
  };

  while (true) {
    const cmd = sc.command();
    if (cmd === null) break;
    let ok = true;
    switch (cmd) {
      case "M":
      case "m": {
        const rel = cmd === "m";
        const p = triplet(rel);
        if (!p) {
          ok = false;
          break;
        }
        flush();
        points.push(p);
        cur = p;
        subStart = p;
        prevCubic = prevQuad = null;
        // implicit linetos
        while (true) {
          const q = triplet(rel);
          if (!q) break;
          push(q);
        }
        break;
      }
      case "L":
      case "l": {
        const rel = cmd === "l";
        while (true) {
          const p = triplet(rel);
          if (!p) break;
          push(p);
        }
        break;
      }
      case "H":
      case "h": {
        const rel = cmd === "h";
        while (true) {
          const x = sc.number();
          if (x === null) break;
          push([rel ? cur[0] + x : x, cur[1], cur[2]]);
        }
        break;
      }
      case "V":
      case "v": {
        const rel = cmd === "v";
        while (true) {
          const y = sc.number();
          if (y === null) break;
          push([cur[0], rel ? cur[1] + y : y, cur[2]]);
        }
        break;
      }
      case "C":
      case "c": {
        const rel = cmd === "c";
        while (true) {
          const c1 = triplet(rel);
          const c2 = triplet(rel);
          const p1 = triplet(rel);
          if (!c1 || !c2 || !p1) break;
          for (let k = 1; k <= CURVE_SAMPLES; k++)
            push(cubicPoint(cur, c1, c2, p1, k / CURVE_SAMPLES));
          prevCubic = c2;
          prevQuad = null;
        }
        break;
      }
      case "S":
      case "s": {
        const rel = cmd === "s";
        while (true) {
          const c2 = triplet(rel);
          const p1 = triplet(rel);
          if (!c2 || !p1) break;
          const c1: P3 = prevCubic
            ? [2 * cur[0] - prevCubic[0], 2 * cur[1] - prevCubic[1], 2 * cur[2] - prevCubic[2]]
            : [...cur];
          for (let k = 1; k <= CURVE_SAMPLES; k++)
            push(cubicPoint(cur, c1, c2, p1, k / CURVE_SAMPLES));
          prevCubic = c2;
          prevQuad = null;
        }
        break;
      }
      case "Q":
      case "q": {
        const rel = cmd === "q";
        while (true) {
          const c = triplet(rel);
          const p1 = triplet(rel);
          if (!c || !p1) break;
          for (let k = 1; k <= CURVE_SAMPLES; k++) push(quadPoint(cur, c, p1, k / CURVE_SAMPLES));
          prevQuad = c;
          prevCubic = null;
        }
        break;
      }
      case "T":
      case "t": {
        const rel = cmd === "t";
        while (true) {
          const p1 = triplet(rel);
          if (!p1) break;
          const c: P3 = prevQuad
            ? [2 * cur[0] - prevQuad[0], 2 * cur[1] - prevQuad[1], 2 * cur[2] - prevQuad[2]]
            : [...cur];
          for (let k = 1; k <= CURVE_SAMPLES; k++) push(quadPoint(cur, c, p1, k / CURVE_SAMPLES));
          prevQuad = c;
          prevCubic = null;
        }
        break;
      }
      case "A":
      case "a": {
        const rel = cmd === "a";
        while (true) {
          const rx = sc.number();
          const ry = sc.number();
          const rot = sc.number();
          const laf = sc.flag();
          const sf = sc.flag();
          const p1 = triplet(rel);
          if (rx === null || ry === null || rot === null || laf === null || sf === null || !p1)
            break;
          const pts = arcPoints(cur, p1, Math.abs(rx), Math.abs(ry), rot, laf, sf, ARC_SAMPLES);
          if (!pts) break;
          for (const p of pts) push(p);
          prevCubic = prevQuad = null;
        }
        break;
      }
      case "Z":
      case "z": {
        closed = true;
        cur = subStart;
        flush();
        points = [];
        // restart an open subpath at the closed point for further commands
        points = [cur];
        break;
      }
      default:
        ok = false;
    }
    if (!ok) break; // error handling: keep what parsed so far
    if (cmd !== "Z" && cmd !== "z") lastCmd = cmd;
    void lastCmd;
    if (sc.atEnd()) break;
  }
  flush();
  return out;
}
