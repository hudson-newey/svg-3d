import { html, type TemplateResult } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../svg3d-viewer.ts";
import {
  type Drawable,
  type Vec3,
  boxFaces,
  centroid3,
  distSq3,
  f,
  icosahedronFaces,
  line3d,
  poly3d,
  rotateX3,
  rotateY3,
  rotateZ3,
  shadeFaces,
  shadeHex,
  sortDrawables,
} from "./lib/mesh3d.ts";

const meta = {
  title: "SVG3D/5 Showcase",
  component: "svg3d-viewer",
  parameters: { docs: { autodocs: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const panelStyle =
  "display:flex;flex-direction:column;gap:10px;font:13px/1.45 system-ui,-apple-system,sans-serif;color:#e2e8f0;background:#0b1020;padding:14px;border-radius:12px;width:fit-content;box-shadow:0 12px 32px rgba(2,6,23,0.45);border:1px solid rgba(148,163,184,0.18)";
const barStyle = "display:flex;flex-wrap:wrap;align-items:center;gap:8px";
const btnStyle =
  "padding:5px 11px;border-radius:6px;border:1px solid rgba(148,163,184,0.35);background:#1e293b;color:#f8fafc;font:12px/1.2 system-ui,sans-serif;cursor:pointer";
const activeBtnStyle =
  "padding:5px 11px;border-radius:6px;border:1px solid #38bdf8;background:#0284c7;color:#ffffff;font:12px/1.2 system-ui,sans-serif;cursor:pointer;font-weight:600";
const subStyle = "margin:0;font-size:12px;color:#94a3b8;max-width:600px";

// ---------------------------------------------------------------------------
// 1. 3D Solar System Orrery
// ---------------------------------------------------------------------------

interface PlanetDef {
  name: string;
  orbitR: number;
  radius: number;
  speed: number;
  phase: number;
  tiltDeg: number;
  color: string;
  stroke: string;
  ring?: { inner: number; outer: number; color: string };
  moon?: { orbitR: number; radius: number; speed: number; color: string };
}

const PLANETS: PlanetDef[] = [
  {
    name: "MERCURY",
    orbitR: 52,
    radius: 4.5,
    speed: 1.9,
    phase: 0.4,
    tiltDeg: 6,
    color: "#cbd5e1",
    stroke: "#64748b",
  },
  {
    name: "VENUS",
    orbitR: 78,
    radius: 7.2,
    speed: 1.35,
    phase: 2.1,
    tiltDeg: -3,
    color: "#fbbf24",
    stroke: "#b45309",
  },
  {
    name: "EARTH",
    orbitR: 110,
    radius: 8.5,
    speed: 0.95,
    phase: 4.2,
    tiltDeg: 4,
    color: "#38bdf8",
    stroke: "#0369a1",
    moon: { orbitR: 18, radius: 2.8, speed: 4.2, color: "#e2e8f0" },
  },
  {
    name: "MARS",
    orbitR: 142,
    radius: 6.2,
    speed: 0.72,
    phase: 1.2,
    tiltDeg: -5,
    color: "#f97316",
    stroke: "#9a3412",
  },
  {
    name: "SATURN",
    orbitR: 192,
    radius: 13.5,
    speed: 0.42,
    phase: 5.1,
    tiltDeg: 8,
    color: "#fde68a",
    stroke: "#b45309",
    ring: { inner: 18, outer: 30, color: "#fcd34d" },
  },
  {
    name: "NEPTUNE",
    orbitR: 238,
    radius: 9.5,
    speed: 0.27,
    phase: 3.1,
    tiltDeg: -7,
    color: "#60a5fa",
    stroke: "#1d4ed8",
  },
];

// Deterministic background starfield in 3D space
const STARS: Array<{ pos: Vec3; r: number; op: number }> = Array.from({ length: 48 }, (_, i) => {
  const a = (i * 2.39996) % (Math.PI * 2);
  const el = (((i * 37) % 100) / 100) * Math.PI - Math.PI / 2;
  const dist = 420 + ((i * 53) % 140);
  return {
    pos: [
      Math.cos(el) * Math.cos(a) * dist,
      Math.sin(el) * dist,
      Math.cos(el) * Math.sin(a) * dist,
    ],
    r: 1 + (i % 3) * 0.7,
    op: 0.35 + ((i * 19) % 60) / 100,
  };
});

function solarSystemMarkup(t: number, topDown: boolean): string {
  const camAz = t * 0.14;
  const camPos: Vec3 = topDown
    ? [Math.sin(camAz) * 60, -480, Math.cos(camAz) * 60]
    : [Math.sin(camAz) * 340, -175 + Math.sin(t * 0.35) * 28, Math.cos(camAz) * 340];

  const drawables: Drawable[] = [];

  // Orbit rings (rendered as 3D polygons in the tilted ecliptic plane)
  for (const p of PLANETS) {
    const tilt = (p.tiltDeg * Math.PI) / 180;
    const segs = 40;
    const pts: Vec3[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const raw: Vec3 = [Math.cos(a) * p.orbitR, 0, Math.sin(a) * p.orbitR];
      pts.push(rotateZ3(raw, tilt));
    }
    drawables.push({
      depth: 1e9 - p.orbitR, // behind planets
      markup: poly3d(pts, `fill="none" stroke="#334155" stroke-width="0.9" stroke-dasharray="3 3"`),
    });
  }

  // Sun (layered glowing circles at origin)
  const sunDepth = distSq3([0, 0, 0], camPos);
  drawables.push({
    depth: sunDepth + 20,
    markup: `<circle cx="0" cy="0" r="34" cz="0" fill="url(#sun-halo)"/>`,
  });
  drawables.push({
    depth: sunDepth,
    markup: `<circle cx="0" cy="0" r="22" cz="0" fill="url(#sun-core)" stroke="#fef08a" stroke-width="0.8"/>`,
  });

  // Planets + rings + moons + 3D labels
  for (const p of PLANETS) {
    const a = p.phase + t * p.speed;
    const tilt = (p.tiltDeg * Math.PI) / 180;
    const pos = rotateZ3([Math.cos(a) * p.orbitR, 0, Math.sin(a) * p.orbitR], tilt);
    const dSq = distSq3(pos, camPos);

    // Subtle vertical ecliptic stem if tilted off y=0
    if (Math.abs(pos[1]) > 2) {
      drawables.push({
        depth: dSq + 5,
        markup: line3d(
          [pos[0], 0, pos[2]],
          pos,
          `stroke="#475569" stroke-width="0.7" stroke-dasharray="2 2"`,
        ),
      });
    }

    // Saturn-style tilted 3D ring using <ellipse> + CSS 3D transform
    if (p.ring) {
      drawables.push({
        depth: dSq + 1,
        markup: `<g transform="translate3d(${f(pos[0])} ${f(pos[1])} ${f(pos[2])}) rotateX(72) rotateY(22)">
          <ellipse cx="0" cy="0" rx="${p.ring.outer}" ry="${p.ring.outer}" cz="0" fill="none" stroke="${p.ring.color}" stroke-width="4.2" stroke-opacity="0.72"/>
          <ellipse cx="0" cy="0" rx="${p.ring.inner}" ry="${p.ring.inner}" cz="0" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.8"/>
        </g>`,
      });
    }

    // Planet body (billboard-like circle at 3D center cz)
    drawables.push({
      depth: dSq,
      markup: `<circle cx="${f(pos[0])}" cy="${f(pos[1])}" r="${p.radius}" cz="${f(pos[2])}" fill="${p.color}" stroke="${p.stroke}" stroke-width="1.1"/>`,
    });

    // 3D text label floating above planet
    const labelY = pos[1] - p.radius - 7;
    const xs = [...p.name].map((_, i) => f(pos[0] + (i - p.name.length / 2) * 4.2)).join(" ");
    const ys = [...p.name].map(() => f(labelY)).join(" ");
    const zs = [...p.name].map(() => f(pos[2])).join(" ");
    drawables.push({
      depth: dSq - 2,
      markup: `<text x="${xs}" y="${ys}" z="${zs}" font-size="6.5" font-family="ui-monospace,monospace" fill="#94a3b8">${p.name}</text>`,
    });

    // Moon
    if (p.moon) {
      const ma = t * p.moon.speed;
      const mPos: Vec3 = [
        pos[0] + Math.cos(ma) * p.moon.orbitR,
        pos[1] + Math.sin(ma) * 5,
        pos[2] + Math.sin(ma) * p.moon.orbitR,
      ];
      drawables.push({
        depth: distSq3(mPos, camPos),
        markup: `<circle cx="${f(mPos[0])}" cy="${f(mPos[1])}" r="${p.moon.radius}" cz="${f(mPos[2])}" fill="${p.moon.color}" stroke="#64748b" stroke-width="0.6"/>`,
      });
    }
  }

  const starsMarkup = STARS.map(
    (s) =>
      `<circle cx="${f(s.pos[0])}" cy="${f(s.pos[1])}" r="${s.r}" cz="${f(s.pos[2])}" fill="#f8fafc" fill-opacity="${s.op.toFixed(2)}"/>`,
  ).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -150 420 300" style="background:radial-gradient(circle at 50% 45%,#131c38 0%,#060913 100%)">
  <defs>
    <radialGradient id="sun-core" cx="38%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fef9c3"/>
      <stop offset="45%" stop-color="#facc15"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </radialGradient>
    <radialGradient id="sun-halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fb923c" stop-opacity="0.7"/>
      <stop offset="65%" stop-color="#f59e0b" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <camera projection="perspective" fov="52" position="${f(camPos[0])} ${f(camPos[1])} ${f(camPos[2])}" target="0 0 0" up="0 1 0" near="10"/>
  ${starsMarkup}
  ${sortDrawables(drawables)}
</svg>`;
}

export const SolarSystemOrrery: Story = {
  name: "1. 3D Solar System Orrery",
  render: (): TemplateResult => html`
    <div style=${panelStyle} data-story="solar">
      <div style=${barStyle}>
        <button data-action="toggle" style=${activeBtnStyle}>Pause Orbit</button>
        <button data-action="view" style=${btnStyle}>Switch to Top-Down</button>
        <span style="font-size:12px;color:#94a3b8;margin-left:auto">
          Click canvas + Arrow keys to manually orbit camera
        </span>
      </div>
      <svg3d-viewer
        controls
        .markup=${solarSystemMarkup(0, false)}
        style="width:620px;height:440px;border-radius:8px;overflow:hidden"
      ></svg3d-viewer>
      <p style=${subStyle}>
        Uses perspective <code>&lt;camera&gt;</code>, tilted <code>&lt;ellipse&gt;</code> rings with
        3D <code>transform</code>, <code>&lt;circle cz&gt;</code>,
        <code>&lt;polygon zs&gt;</code> orbital tracks, 3D <code>&lt;text x y z&gt;</code> labels,
        and painter-sorted document order (§3.4).
      </p>
    </div>
  `,
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-story="solar"]');
    const viewer = root?.querySelector<HTMLElement & { markup: string }>("svg3d-viewer");
    const toggleBtn = root?.querySelector<HTMLButtonElement>('[data-action="toggle"]');
    const viewBtn = root?.querySelector<HTMLButtonElement>('[data-action="view"]');
    if (!viewer || !toggleBtn || !viewBtn) return;

    let playing = true;
    let topDown = false;
    let simTime = 0;
    let last = performance.now();

    toggleBtn.onclick = () => {
      playing = !playing;
      toggleBtn.textContent = playing ? "Pause Orbit" : "Resume Orbit";
      toggleBtn.style.cssText = playing ? activeBtnStyle : btnStyle;
    };
    viewBtn.onclick = () => {
      topDown = !topDown;
      viewBtn.textContent = topDown ? "Switch to Perspective" : "Switch to Top-Down";
      viewer.markup = solarSystemMarkup(simTime, topDown);
    };

    const loop = (now: number) => {
      if (!viewer.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing) {
        simTime += dt;
        viewer.markup = solarSystemMarkup(simTime, topDown);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
};

// ---------------------------------------------------------------------------
// 2. 3D DNA Double Helix (path3d + line z1/z2 + circle cz)
// ---------------------------------------------------------------------------

const BASE_PAIRS: Array<[string, string]> = [
  ["#38bdf8", "#fb7185"], // A - T
  ["#34d399", "#fbbf24"], // C - G
  ["#fb7185", "#38bdf8"], // T - A
  ["#fbbf24", "#34d399"], // G - C
];

function dnaMarkup(t: number): string {
  const camPos: Vec3 = [0, 0, 290];
  const radius = 52;
  const height = 220;
  const rungs = 18;
  const turns = 1.8;
  const spin = t * 0.9;

  const strandA: Vec3[] = [];
  const strandB: Vec3[] = [];
  const samples = 54;
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const y = (u - 0.5) * height;
    const ang = u * Math.PI * 2 * turns + spin;
    const pA = rotateZ3([Math.cos(ang) * radius, y, Math.sin(ang) * radius], 0.28);
    const pB = rotateZ3(
      [Math.cos(ang + Math.PI) * radius, y, Math.sin(ang + Math.PI) * radius],
      0.28,
    );
    strandA.push(pA);
    strandB.push(pB);
  }

  const drawables: Drawable[] = [];

  // Build backbone segments as <path3d> so depth sorting interleaves strands & rungs
  for (let i = 0; i < samples; i++) {
    const a0 = strandA[i]!;
    const a1 = strandA[i + 1]!;
    const b0 = strandB[i]!;
    const b1 = strandB[i + 1]!;
    const midA = centroid3([a0, a1]);
    const midB = centroid3([b0, b1]);
    drawables.push({
      depth: distSq3(midA, camPos),
      markup: `<path3d fill="none" stroke="#38bdf8" stroke-width="4.2" stroke-linecap="round" d="M ${f(a0[0])},${f(a0[1])},${f(a0[2])} L ${f(a1[0])},${f(a1[1])},${f(a1[2])}"/>`,
    });
    drawables.push({
      depth: distSq3(midB, camPos),
      markup: `<path3d fill="none" stroke="#a78bfa" stroke-width="4.2" stroke-linecap="round" d="M ${f(b0[0])},${f(b0[1])},${f(b0[2])} L ${f(b1[0])},${f(b1[1])},${f(b1[2])}"/>`,
    });
  }

  // Base-pair rungs + nucleotide beads
  for (let i = 0; i < rungs; i++) {
    const u = (i + 0.5) / rungs;
    const y = (u - 0.5) * height;
    const ang = u * Math.PI * 2 * turns + spin;
    const pA = rotateZ3([Math.cos(ang) * radius, y, Math.sin(ang) * radius], 0.28);
    const pB = rotateZ3(
      [Math.cos(ang + Math.PI) * radius, y, Math.sin(ang + Math.PI) * radius],
      0.28,
    );
    const mid = centroid3([pA, pB]);
    const pair = BASE_PAIRS[i % BASE_PAIRS.length]!;

    drawables.push({
      depth: distSq3(centroid3([pA, mid]), camPos),
      markup: line3d(pA, mid, `stroke="${pair[0]}" stroke-width="3" stroke-linecap="round"`),
    });
    drawables.push({
      depth: distSq3(centroid3([mid, pB]), camPos),
      markup: line3d(mid, pB, `stroke="${pair[1]}" stroke-width="3" stroke-linecap="round"`),
    });
    drawables.push({
      depth: distSq3(pA, camPos) - 4,
      markup: `<circle cx="${f(pA[0])}" cy="${f(pA[1])}" r="5.5" cz="${f(pA[2])}" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.4"/>`,
    });
    drawables.push({
      depth: distSq3(pB, camPos) - 4,
      markup: `<circle cx="${f(pB[0])}" cy="${f(pB[1])}" r="5.5" cz="${f(pB[2])}" fill="#ede9fe" stroke="#7c3aed" stroke-width="1.4"/>`,
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-170 -140 340 280" style="background:radial-gradient(circle at 50% 50%,#17153b 0%,#090a1a 100%)">
  <camera projection="perspective" fov="50" position="0 0 290" target="0 0 0" up="0 1 0" near="10"/>
  ${sortDrawables(drawables)}
</svg>`;
}

export const DnaDoubleHelix: Story = {
  name: "2. Spinning DNA Double Helix (path3d)",
  render: (): TemplateResult => html`
    <div style=${panelStyle} data-story="dna">
      <div style=${barStyle}>
        <button data-action="toggle" style=${activeBtnStyle}>Pause Spin</button>
        <span style="font-size:12px;color:#94a3b8;margin-left:auto">
          Click canvas + Arrow keys to orbit around the helix
        </span>
      </div>
      <svg3d-viewer
        controls
        .markup=${dnaMarkup(0)}
        style="width:580px;height:440px;border-radius:8px;overflow:hidden"
      ></svg3d-viewer>
      <p style=${subStyle}>
        Two intertwined <code>&lt;path3d&gt;</code> sugar-phosphate backbones, color-coded
        <code>&lt;line z1 z2&gt;</code> base-pair rungs, and
        <code>&lt;circle cz&gt;</code> phosphate beads depth-sorted per frame.
      </p>
    </div>
  `,
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-story="dna"]');
    const viewer = root?.querySelector<HTMLElement & { markup: string }>("svg3d-viewer");
    const toggleBtn = root?.querySelector<HTMLButtonElement>('[data-action="toggle"]');
    if (!viewer || !toggleBtn) return;

    let playing = true;
    let simTime = 0;
    let last = performance.now();
    toggleBtn.onclick = () => {
      playing = !playing;
      toggleBtn.textContent = playing ? "Pause Spin" : "Resume Spin";
      toggleBtn.style.cssText = playing ? activeBtnStyle : btnStyle;
    };

    const loop = (now: number) => {
      if (!viewer.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing) {
        simTime += dt;
        viewer.markup = dnaMarkup(simTime);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
};

// ---------------------------------------------------------------------------
// 3. Interactive Polyhedra & Torus Knot Lab
// ---------------------------------------------------------------------------

type LabShape = "icosahedron" | "crystal" | "torus-knot";

const ICO_BASE = icosahedronFaces(72);

/** Starburst stellated icosahedron: extrude each triangle's centroid outward. */
function starburstFaces(baseFaces: readonly Vec3[][], spikeScale: number): Vec3[][] {
  const out: Vec3[][] = [];
  for (const tri of baseFaces) {
    const c = centroid3(tri);
    const tip: Vec3 = [c[0] * spikeScale, c[1] * spikeScale, c[2] * spikeScale];
    out.push([tri[0]!, tri[1]!, tip]);
    out.push([tri[1]!, tri[2]!, tip]);
    out.push([tri[2]!, tri[0]!, tip]);
  }
  return out;
}

const CRYSTAL_BASE = starburstFaces(icosahedronFaces(48), 1.72);

function torusKnotPoint(u: number, scale: number): Vec3 {
  const p = 2;
  const q = 3;
  const r = Math.cos(q * u) + 2.15;
  return [
    r * Math.cos(p * u) * scale,
    r * Math.sin(p * u) * scale,
    -Math.sin(q * u) * scale * 1.35,
  ];
}

function polyhedraMarkup(
  t: number,
  shape: LabShape,
  projection: "perspective" | "orthographic",
  wireframe: boolean,
): string {
  const camPos: Vec3 = [0, -35, 240];
  const rx = t * 0.55;
  const ry = t * 0.85;
  const transformPt = (p: Vec3): Vec3 => rotateY3(rotateX3(p, rx), ry);

  let bodyMarkup = "";

  if (shape === "torus-knot") {
    const segs = 96;
    const tubeR = 11;
    const drawables: Drawable[] = [];
    const pts: Vec3[] = [];
    for (let i = 0; i < segs; i++) {
      const u = (i / segs) * Math.PI * 2;
      pts.push(transformPt(torusKnotPoint(u, 27)));
    }
    // Build a 3D ribbon along the trefoil knot + centerline path3d
    for (let i = 0; i < segs; i++) {
      const p0 = pts[i]!;
      const p1 = pts[(i + 1) % segs]!;
      const mid = centroid3([p0, p1]);
      const hue = Math.round((i / segs) * 360);
      const color = `hsl(${hue}, 82%, 60%)`;
      const stroke = wireframe ? color : "rgba(15,23,42,0.45)";
      const fill = wireframe ? "none" : color;
      // Offset normal ribbon width
      const w0: Vec3 = [p0[0], p0[1] - tubeR, p0[2]];
      const w1: Vec3 = [p1[0], p1[1] - tubeR, p1[2]];
      const w2: Vec3 = [p1[0], p1[1] + tubeR, p1[2]];
      const w3: Vec3 = [p0[0], p0[1] + tubeR, p0[2]];
      drawables.push({
        depth: distSq3(mid, camPos),
        markup: poly3d(
          [w0, w1, w2, w3],
          `fill="${fill}" fill-opacity="0.92" stroke="${stroke}" stroke-width="${wireframe ? 1.4 : 0.6}"`,
        ),
      });
    }
    const dStr =
      `M ${f(pts[0]![0])},${f(pts[0]![1])},${f(pts[0]![2])} ` +
      pts
        .slice(1)
        .map((p) => `L ${f(p[0])},${f(p[1])},${f(p[2])}`)
        .join(" ") +
      " Z";
    bodyMarkup =
      sortDrawables(drawables) +
      `\n<path3d fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.2" d="${dStr}"/>`;
  } else {
    const baseFaces = shape === "icosahedron" ? ICO_BASE : CRYSTAL_BASE;
    const rotated = baseFaces.map((face) => face.map(transformPt));
    const baseColor = shape === "icosahedron" ? "#38bdf8" : "#c084fc";
    if (wireframe) {
      const drawables: Drawable[] = rotated.map((face) => ({
        depth: distSq3(centroid3(face), camPos),
        markup: poly3d(
          face,
          `fill="none" stroke="${baseColor}" stroke-width="1.3" stroke-linejoin="round"`,
        ),
      }));
      bodyMarkup = sortDrawables(drawables);
    } else {
      const drawables = shadeFaces(rotated, {
        baseColor,
        stroke: "#0f172a",
        strokeWidth: 0.9,
        camPos,
        cullBackfaces: true,
        ambient: 0.35,
      });
      bodyMarkup = sortDrawables(drawables);
    }
  }

  // Subtle floor grid for spatial reference
  const grid: string[] = [];
  for (let i = -120; i <= 120; i += 40) {
    grid.push(line3d([i, 95, -120], [i, 95, 120], `stroke="#1e293b" stroke-width="0.9"`));
    grid.push(line3d([-120, 95, i], [120, 95, i], `stroke="#1e293b" stroke-width="0.9"`));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-160 -125 320 250" style="background:linear-gradient(180deg,#0f172a 0%,#020617 100%)">
  <camera projection="${projection}" fov="52" position="${f(camPos[0])} ${f(camPos[1])} ${f(camPos[2])}" target="0 0 0" up="0 1 0" near="5"/>
  ${grid.join("\n")}
  ${bodyMarkup}
</svg>`;
}

export const PolyhedraLab: Story = {
  name: "3. Interactive Polyhedra & Torus Knot Lab",
  render: (): TemplateResult => html`
    <div style=${panelStyle} data-story="lab">
      <div style=${barStyle}>
        <button data-shape="icosahedron" style=${activeBtnStyle}>Icosahedron</button>
        <button data-shape="crystal" style=${btnStyle}>Starburst Crystal</button>
        <button data-shape="torus-knot" style=${btnStyle}>Trefoil Torus Knot</button>
        <span style="width:1px;height:18px;background:rgba(148,163,184,0.25)"></span>
        <button data-action="proj" style=${btnStyle}>Perspective</button>
        <button data-action="wire" style=${btnStyle}>Shaded</button>
        <button data-action="spin" style=${activeBtnStyle}>Spinning</button>
      </div>
      <svg3d-viewer
        controls
        .markup=${polyhedraMarkup(0.4, "icosahedron", "perspective", false)}
        style="width:580px;height:430px;border-radius:8px;overflow:hidden"
      ></svg3d-viewer>
      <p style=${subStyle}>
        Flat-shaded 3D meshes built from <code>&lt;polygon points zs&gt;</code> with backface
        culling, directional shading, and a rainbow parametric <code>&lt;path3d&gt;</code> trefoil
        knot.
      </p>
    </div>
  `,
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-story="lab"]');
    const viewer = root?.querySelector<HTMLElement & { markup: string }>("svg3d-viewer");
    if (!root || !viewer) return;

    let shape: LabShape = "icosahedron";
    let projection: "perspective" | "orthographic" = "perspective";
    let wireframe = false;
    let spinning = true;
    let simTime = 0.4;
    let last = performance.now();

    const shapeBtns = [...root.querySelectorAll<HTMLButtonElement>("[data-shape]")];
    const projBtn = root.querySelector<HTMLButtonElement>('[data-action="proj"]')!;
    const wireBtn = root.querySelector<HTMLButtonElement>('[data-action="wire"]')!;
    const spinBtn = root.querySelector<HTMLButtonElement>('[data-action="spin"]')!;

    const redraw = () => {
      viewer.markup = polyhedraMarkup(simTime, shape, projection, wireframe);
    };

    for (const btn of shapeBtns) {
      btn.onclick = () => {
        shape = (btn.dataset.shape as LabShape) ?? "icosahedron";
        for (const b of shapeBtns) {
          b.style.cssText = b === btn ? activeBtnStyle : btnStyle;
        }
        redraw();
      };
    }

    projBtn.onclick = () => {
      projection = projection === "perspective" ? "orthographic" : "perspective";
      projBtn.textContent = projection === "perspective" ? "Perspective" : "Orthographic";
      redraw();
    };
    wireBtn.onclick = () => {
      wireframe = !wireframe;
      wireBtn.textContent = wireframe ? "Wireframe" : "Shaded";
      redraw();
    };
    spinBtn.onclick = () => {
      spinning = !spinning;
      spinBtn.textContent = spinning ? "Spinning" : "Paused";
      spinBtn.style.cssText = spinning ? activeBtnStyle : btnStyle;
    };

    const loop = (now: number) => {
      if (!viewer.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (spinning) {
        simTime += dt;
        redraw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
};

// ---------------------------------------------------------------------------
// 4. 3D Architectural Skyline with <camera> Presets (camera="#id")
// ---------------------------------------------------------------------------

type CityCam = "aerial" | "iso" | "street";

const CITY_CAMS: Record<CityCam, { pos: Vec3; target: Vec3; label: string }> = {
  aerial: { pos: [210, -175, 225], target: [0, -35, 0], label: "Aerial Perspective (#aerial)" },
  iso: { pos: [210, -170, 210], target: [0, -35, 0], label: "Isometric Ortho (#iso)" },
  street: { pos: [125, -28, 175], target: [-15, -55, -20], label: "Street Level (#street)" },
};

function cityMarkup(activeCam: CityCam): string {
  const camPos = CITY_CAMS[activeCam].pos;
  const drawables: Drawable[] = [];

  // City ground slab + road grid at y = 0
  const ground = boxFaces(240, 10, 220, [0, 5, 0]);
  drawables.push(
    ...shadeFaces(ground, {
      baseColor: "#1e293b",
      stroke: "#334155",
      strokeWidth: 0.8,
      camPos,
      cullBackfaces: true,
    }),
  );

  // River cutting through the city at x = -25..25
  drawables.push({
    depth: distSq3([0, -0.5, 0], camPos),
    markup: poly3d(
      [
        [-26, -0.5, -108],
        [26, -0.5, -108],
        [26, -0.5, 108],
        [-26, -0.5, 108],
      ],
      `fill="#0ea5e9" fill-opacity="0.72" stroke="#38bdf8" stroke-width="0.9"`,
    ),
  });

  // Towers on both banks of the river
  const buildings: Array<{
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: string;
    spire?: boolean;
  }> = [
    { x: -72, z: -55, w: 38, h: 115, d: 38, color: "#3b82f6", spire: true },
    { x: -74, z: 12, w: 42, h: 72, d: 44, color: "#6366f1" },
    { x: -65, z: 68, w: 34, h: 52, d: 34, color: "#8b5cf6" },
    { x: 70, z: -52, w: 44, h: 138, d: 40, color: "#14b8a6", spire: true },
    { x: 76, z: 16, w: 38, h: 86, d: 38, color: "#06b6d4" },
    { x: 66, z: 72, w: 42, h: 48, d: 34, color: "#f59e0b" },
  ];

  for (const b of buildings) {
    const faces = boxFaces(b.w, b.h, b.d, [b.x, -b.h / 2, b.z]);
    drawables.push(
      ...shadeFaces(faces, {
        baseColor: b.color,
        stroke: "#0f172a",
        strokeWidth: 0.9,
        camPos,
        cullBackfaces: true,
        ambient: 0.44,
      }),
    );
    // Glowing window stripes on front face
    const frontZ = b.z + b.d / 2 + 0.3;
    for (let wy = -b.h + 12; wy < -10; wy += 14) {
      drawables.push({
        depth: distSq3([b.x, wy, frontZ], camPos) - 1,
        markup: line3d(
          [b.x - b.w * 0.36, wy, frontZ],
          [b.x + b.w * 0.36, wy, frontZ],
          `stroke="#fef08a" stroke-opacity="0.75" stroke-width="2"`,
        ),
      });
    }
    if (b.spire) {
      drawables.push({
        depth: distSq3([b.x, -b.h - 14, b.z], camPos),
        markup: line3d(
          [b.x, -b.h, b.z],
          [b.x, -b.h - 28, b.z],
          `stroke="#f8fafc" stroke-width="1.6"`,
        ),
      });
      drawables.push({
        depth: distSq3([b.x, -b.h - 28, b.z], camPos) - 1,
        markup: `<circle cx="${f(b.x)}" cy="${f(-b.h - 28)}" r="2.6" cz="${f(b.z)}" fill="#f43f5e"/>`,
      });
    }
  }

  // Rooftop helipad on the amber building (circle rotated onto horizontal plane)
  drawables.push({
    depth: distSq3([66, -48.5, 72], camPos) - 2,
    markup: `<g transform="translate3d(66 -48.5 72) rotateX(90)">
      <circle cx="0" cy="0" r="12" cz="0" fill="#1e293b" stroke="#fde047" stroke-width="1.6"/>
    </g>`,
  });

  // Suspension bridge across the river using <path3d> cubic Beziers!
  const bridgeZ = 14;
  drawables.push({
    depth: distSq3([0, -14, bridgeZ], camPos),
    markup: `<g>
      ${poly3d(
        [
          [-45, -10, bridgeZ - 8],
          [45, -10, bridgeZ - 8],
          [45, -10, bridgeZ + 8],
          [-45, -10, bridgeZ + 8],
        ],
        `fill="#cbd5e1" stroke="#334155" stroke-width="0.9"`,
      )}
      <path3d fill="none" stroke="#f43f5e" stroke-width="2.4"
        d="M -45,-10,${bridgeZ - 8} C -18,-48,${bridgeZ - 8} 18,-48,${bridgeZ - 8} 45,-10,${bridgeZ - 8}"/>
      <path3d fill="none" stroke="#fb7185" stroke-width="2.4"
        d="M -45,-10,${bridgeZ + 8} C -18,-48,${bridgeZ + 8} 18,-48,${bridgeZ + 8} 45,-10,${bridgeZ + 8}"/>
    </g>`,
  });

  // Floating 3D neon skyline text
  const title = "SVG3D";
  const xs = [...title].map((_, i) => f(-36 + i * 18)).join(" ");
  const ys = [...title].map(() => "-152").join(" ");
  const zs = [...title].map(() => "-55").join(" ");
  drawables.push({
    depth: distSq3([0, -152, -55], camPos),
    markup: `<text x="${xs}" y="${ys}" z="${zs}" font-size="16" font-weight="700" font-family="ui-monospace,monospace" fill="#38bdf8">${title}</text>`,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-165 -125 330 250" camera="#${activeCam}" style="background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 55%,#090d16 100%)">
  <defs>
    <camera id="aerial" projection="perspective" fov="50" position="210 -175 225" target="0 -35 0" up="0 1 0" near="5"/>
    <camera id="iso" projection="orthographic" position="210 -170 210" target="0 -35 0" up="0 1 0"/>
    <camera id="street" projection="perspective" fov="58" position="125 -28 175" target="-15 -55 -20" up="0 1 0" near="5"/>
  </defs>
  ${sortDrawables(drawables)}
</svg>`;
}

export const VoxelCitySkyline: Story = {
  name: "4. 3D Skyline & <camera> Presets",
  render: (): TemplateResult => html`
    <div style=${panelStyle} data-story="city">
      <div style=${barStyle}>
        <button data-cam="aerial" style=${activeBtnStyle}>Aerial Perspective</button>
        <button data-cam="iso" style=${btnStyle}>Isometric Ortho</button>
        <button data-cam="street" style=${btnStyle}>Street Level</button>
        <span style="font-size:12px;color:#94a3b8;margin-left:auto">
          Click canvas + Arrow keys to orbit any preset
        </span>
      </div>
      <svg3d-viewer
        controls
        .markup=${cityMarkup("aerial")}
        style="width:620px;height:440px;border-radius:8px;overflow:hidden"
      ></svg3d-viewer>
      <p style=${subStyle}>
        Declares three reusable <code>&lt;camera id="..."&gt;</code> elements inside
        <code>&lt;defs&gt;</code> and switches the viewport via the root
        <code>camera="#id"</code> attribute (§5.2), combining
        <code>&lt;polygon zs&gt;</code> towers, a cubic <code>&lt;path3d&gt;</code> arch bridge, and
        3D <code>&lt;text&gt;</code>.
      </p>
    </div>
  `,
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-story="city"]');
    const viewer = root?.querySelector<HTMLElement & { markup: string }>("svg3d-viewer");
    if (!root || !viewer) return;
    const btns = [...root.querySelectorAll<HTMLButtonElement>("[data-cam]")];
    for (const btn of btns) {
      btn.onclick = () => {
        const cam = (btn.dataset.cam as CityCam) ?? "aerial";
        for (const b of btns) b.style.cssText = b === btn ? activeBtnStyle : btnStyle;
        viewer.markup = cityMarkup(cam);
      };
    }
  },
};

// ---------------------------------------------------------------------------
// 5. Twisted 3D Möbius Strip + Spec §5.5 Flat Degradation Comparison
// ---------------------------------------------------------------------------

function mobiusPt(u: number, v: number, R: number, halfW: number): Vec3 {
  const halfU = u / 2;
  const r = R + v * halfW * Math.cos(halfU);
  return [r * Math.cos(u), v * halfW * Math.sin(halfU), r * Math.sin(u)];
}

function mobiusMarkup(t: number, flatFallback: boolean): string {
  const camPos: Vec3 = flatFallback ? [0, 0, 1000] : [0, -110, 230];
  const segsU = 48;
  const R = 74;
  const halfW = 24;
  const rx = 0.55 + Math.sin(t * 0.4) * 0.25;
  const ry = t * 0.7;
  const xform = (p: Vec3): Vec3 => rotateY3(rotateX3(p, rx), ry);

  const drawables: Drawable[] = [];
  const edgeA: Vec3[] = [];
  const edgeB: Vec3[] = [];

  for (let i = 0; i < segsU; i++) {
    const u0 = (i / segsU) * Math.PI * 2;
    const u1 = ((i + 1) / segsU) * Math.PI * 2;
    const p00 = xform(mobiusPt(u0, -1, R, halfW));
    const p10 = xform(mobiusPt(u1, -1, R, halfW));
    const p11 = xform(mobiusPt(u1, 1, R, halfW));
    const p01 = xform(mobiusPt(u0, 1, R, halfW));
    edgeA.push(p00);
    edgeB.push(p01);

    const c = centroid3([p00, p10, p11, p01]);
    const color = i % 2 === 0 ? "#2dd4bf" : "#0ea5e9";
    const shade = 0.62 + 0.45 * ((c[2] + 100) / 200);
    drawables.push({
      depth: distSq3(c, camPos),
      markup: poly3d(
        [p00, p10, p11, p01],
        `fill="${shadeHex(color, shade)}" fill-opacity="0.92" stroke="#0f172a" stroke-width="0.65"`,
      ),
    });
  }

  const makeEdgePath = (pts: Vec3[], stroke: string): string => {
    const d =
      `M ${f(pts[0]![0])},${f(pts[0]![1])},${f(pts[0]![2])} ` +
      pts
        .slice(1)
        .map((p) => `L ${f(p[0])},${f(p[1])},${f(p[2])}`)
        .join(" ");
    return `<path3d fill="none" stroke="${stroke}" stroke-width="2" d="${d}"/>`;
  };

  // In flatFallback mode, omit <camera> so the default identity orthographic camera (§5.5) applies
  const cameraEl = flatFallback
    ? ""
    : `<camera projection="perspective" fov="50" position="0 -110 230" target="0 0 0" up="0 1 0" near="5"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-155 -120 310 240" style="background:radial-gradient(circle at 50% 45%,#132035 0%,#060a14 100%)">
  ${cameraEl}
  ${sortDrawables(drawables)}
  ${makeEdgePath(edgeA, "#f8fafc")}
  ${makeEdgePath(edgeB, "#fde047")}
</svg>`;
}

export const MobiusStripAndFallback: Story = {
  name: "5. Möbius Strip & SVG 2 Flat Fallback",
  render: (): TemplateResult => html`
    <div style=${panelStyle} data-story="mobius">
      <div style=${barStyle}>
        <button data-mode="3d" style=${activeBtnStyle}>3D Perspective Camera</button>
        <button data-mode="2d" style=${btnStyle}>Default Camera (SVG 2 Flat §5.5)</button>
        <button data-action="spin" style=${activeBtnStyle}>Spinning</button>
      </div>
      <svg3d-viewer
        controls
        .markup=${mobiusMarkup(0, false)}
        style="width:580px;height:420px;border-radius:8px;overflow:hidden"
      ></svg3d-viewer>
      <p style=${subStyle}>
        A parametric 3D Möbius strip rendered with <code>&lt;polygon zs&gt;</code> quads and glowing
        <code>&lt;path3d&gt;</code> boundary curves. Toggle to the default camera to see the exact
        <code>z = 0</code> orthographic projection guaranteed by spec §5.5.
      </p>
    </div>
  `,
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-story="mobius"]');
    const viewer = root?.querySelector<HTMLElement & { markup: string }>("svg3d-viewer");
    if (!root || !viewer) return;

    const btn3d = root.querySelector<HTMLButtonElement>('[data-mode="3d"]')!;
    const btn2d = root.querySelector<HTMLButtonElement>('[data-mode="2d"]')!;
    const spinBtn = root.querySelector<HTMLButtonElement>('[data-action="spin"]')!;

    let flat = false;
    let spinning = true;
    let simTime = 0;
    let last = performance.now();

    const redraw = () => {
      viewer.markup = mobiusMarkup(simTime, flat);
    };
    btn3d.onclick = () => {
      flat = false;
      btn3d.style.cssText = activeBtnStyle;
      btn2d.style.cssText = btnStyle;
      redraw();
    };
    btn2d.onclick = () => {
      flat = true;
      btn2d.style.cssText = activeBtnStyle;
      btn3d.style.cssText = btnStyle;
      redraw();
    };
    spinBtn.onclick = () => {
      spinning = !spinning;
      spinBtn.textContent = spinning ? "Spinning" : "Paused";
      spinBtn.style.cssText = spinning ? activeBtnStyle : btnStyle;
    };

    const loop = (now: number) => {
      if (!viewer.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (spinning) {
        simTime += dt;
        redraw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
};
