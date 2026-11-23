import { html, type TemplateResult } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../svg3d-viewer.ts";
import { animate, animation, Timeline } from "@two-web/kit/animations";
import {
  type Drawable,
  type Vec3,
  add3,
  boxFaces,
  centroid3,
  distSq3,
  f,
  line3d,
  octahedronFaces,
  poly3d,
  rotateX3,
  rotateY3,
  rotateZ3,
  shadeFaces,
  sortDrawables,
} from "./lib/mesh3d.ts";

const meta = {
  title: "SVG3D/6 3D Game",
  component: "svg3d-viewer",
  parameters: { layout: "fullscreen", docs: { autodocs: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Minimal retro Web Audio synth (optional, toggled via HUD)
// ---------------------------------------------------------------------------

class RetroSynth {
  #ctx: AudioContext | null = null;
  enabled = true;

  #ensure(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.#ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.#ctx = new Ctor();
      }
      if (this.#ctx.state === "suspended") void this.#ctx.resume();
      return this.#ctx;
    } catch {
      return null;
    }
  }

  laser(): void {
    const ctx = this.#ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.09);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  explode(): void {
    const ctx = this.#ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  ring(): void {
    const ctx = this.#ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.07, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.15);
    });
  }

  hit(): void {
    const ctx = this.#ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(55, now + 0.18);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

// ---------------------------------------------------------------------------
// Game types & constants
// ---------------------------------------------------------------------------

type GamePhase = "title" | "playing" | "paused" | "gameover";
type CamMode = "chase" | "cockpit" | "cinematic";

interface Laser {
  x: number;
  y: number;
  z: number;
  side: -1 | 1;
}

interface Drone {
  id: number;
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  phase: number;
  spin: number;
  hp: number;
  kind: "drone" | "monolith";
  radius: number;
  flash: number;
}

interface RingGate {
  x: number;
  y: number;
  z: number;
  radius: number;
  passed: boolean;
  spin: number;
}

interface Shard {
  pos: Vec3;
  vel: Vec3;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Popup3D {
  pos: Vec3;
  text: string;
  color: string;
  life: number;
}

interface GameState {
  phase: GamePhase;
  camMode: CamMode;
  time: number;
  scrollZ: number;
  speed: number;
  score: number;
  best: number;
  combo: number;
  shield: number;
  hitFlash: number;
  wave: number;
  shipX: number;
  shipY: number;
  shipVx: number;
  shipVy: number;
  bank: number;
  pitch: number;
  fireCooldown: number;
  spawnTimer: number;
  ringTimer: number;
  nextId: number;
  lasers: Laser[];
  drones: Drone[];
  rings: RingGate[];
  shards: Shard[];
  popups: Popup3D[];
}

const BOUNDS_X = 108;
const BOUNDS_Y_TOP = -64;
const BOUNDS_Y_BOT = 56;
const FLOOR_Y = 82;
const WALL_X = 148;

const DRONE_BASE = octahedronFaces(18);
const MONOLITH_BASE = boxFaces(32, 46, 32);

function createInitialState(best = 0): GameState {
  return {
    phase: "title",
    camMode: "chase",
    time: 0,
    scrollZ: 0,
    speed: 310,
    score: 0,
    best,
    combo: 1,
    shield: 100,
    hitFlash: 0,
    wave: 1,
    shipX: 0,
    shipY: 6,
    shipVx: 0,
    shipVy: 0,
    bank: 0,
    pitch: 0,
    fireCooldown: 0,
    spawnTimer: 0.6,
    ringTimer: 2.2,
    nextId: 1,
    lasers: [],
    drones: [],
    rings: [],
    shards: [],
    popups: [],
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

// ---------------------------------------------------------------------------
// 3D Starfighter mesh builder (pure SVG 3D polygon + zs)
// ---------------------------------------------------------------------------

function buildShipDrawables(s: GameState, camPos: Vec3): Drawable[] {
  const xform = (p: Vec3): Vec3 => {
    let q = rotateX3(p, s.pitch);
    q = rotateZ3(q, s.bank);
    return add3(q, [s.shipX, s.shipY, 0]);
  };

  // Starfighter vertices (nose at -z, tail at +z, -y is up)
  const nose: Vec3 = [0, 1, -30];
  const topMid: Vec3 = [0, -8, -4];
  const botMid: Vec3 = [0, 7, -4];
  const tailTop: Vec3 = [0, -6, 16];
  const tailBot: Vec3 = [0, 6, 16];
  const wingL: Vec3 = [-32, 6, 14];
  const wingR: Vec3 = [32, 6, 14];
  const rootL: Vec3 = [-9, 2, 12];
  const rootR: Vec3 = [9, 2, 12];
  const finLTop: Vec3 = [-11, -13, 17];
  const finRTop: Vec3 = [11, -13, 17];
  const cockpitF: Vec3 = [0, -5, -14];
  const cockpitB: Vec3 = [0, -9, 2];
  const cockpitL: Vec3 = [-5, -2, -4];
  const cockpitR: Vec3 = [5, -2, -4];

  const hullColor = s.hitFlash > 0 ? "#fb7185" : "#e2e8f0";
  const wingColor = s.hitFlash > 0 ? "#f43f5e" : "#38bdf8";

  const parts: Array<{ pts: Vec3[]; fill: string; stroke: string }> = [
    // Main delta wings
    { pts: [nose, wingL, rootL], fill: wingColor, stroke: "#0284c7" },
    { pts: [nose, rootR, wingR], fill: wingColor, stroke: "#0284c7" },
    // Fuselage upper & side hull
    { pts: [nose, rootL, topMid], fill: hullColor, stroke: "#334155" },
    { pts: [nose, topMid, rootR], fill: "#cbd5e1", stroke: "#334155" },
    { pts: [topMid, rootL, tailTop], fill: "#cbd5e1", stroke: "#334155" },
    { pts: [topMid, tailTop, rootR], fill: "#94a3b8", stroke: "#334155" },
    // Underbelly
    { pts: [nose, botMid, rootL], fill: "#64748b", stroke: "#1e293b" },
    { pts: [nose, rootR, botMid], fill: "#64748b", stroke: "#1e293b" },
    // Rear engine plate
    { pts: [tailTop, rootL, tailBot, rootR], fill: "#1e293b", stroke: "#0f172a" },
    // Twin vertical stabilizers
    { pts: [rootL, finLTop, [-9, 2, -2]], fill: "#0ea5e9", stroke: "#0369a1" },
    { pts: [rootR, finRTop, [9, 2, -2]], fill: "#0ea5e9", stroke: "#0369a1" },
    // Glowing cyan cockpit canopy
    { pts: [cockpitF, cockpitL, cockpitB], fill: "#22d3ee", stroke: "#ecfeff" },
    { pts: [cockpitF, cockpitB, cockpitR], fill: "#06b6d4", stroke: "#ecfeff" },
  ];

  // Pulsing twin thruster flames
  const flameLen = 10 + Math.sin(s.time * 42) * 4;
  parts.push(
    {
      pts: [
        [-6, 1, 16],
        [-2, 1, 16],
        [-4, 2, 16 + flameLen],
      ],
      fill: "#facc15",
      stroke: "#fb923c",
    },
    {
      pts: [
        [2, 1, 16],
        [6, 1, 16],
        [4, 2, 16 + flameLen],
      ],
      fill: "#facc15",
      stroke: "#fb923c",
    },
  );

  return parts.map((p) => {
    const world = p.pts.map(xform);
    return {
      depth: distSq3(centroid3(world), camPos),
      markup: poly3d(
        world,
        `fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round"`,
      ),
    };
  });
}

// ---------------------------------------------------------------------------
// Complete SVG 3D scene generator (100% SVG 3D Level 1 markup)
// ---------------------------------------------------------------------------

function buildGameSvg(s: GameState): string {
  // Choose <camera> based on active camera mode
  let camPos: Vec3;
  let camTarget: Vec3;
  let fov: number;

  if (s.camMode === "cockpit") {
    camPos = [s.shipX, s.shipY - 3, -10];
    camTarget = [s.shipX + s.bank * 45, s.shipY - s.pitch * 45, -280];
    fov = 72;
  } else if (s.camMode === "cinematic") {
    camPos = [s.shipX * 0.35 + 102, s.shipY * 0.35 - 52, 128];
    camTarget = [s.shipX * 0.65, s.shipY * 0.55, -150];
    fov = 58;
  } else {
    // Classic Starfox chase cam
    camPos = [s.shipX * 0.52, s.shipY * 0.45 - 34, 134];
    camTarget = [s.shipX * 0.72, s.shipY * 0.65, -220];
    fov = 62;
  }

  // 1. Distant horizon backdrop (synthwave sun + mountain ridge at z = -820)
  const horizonMarkup = `
    <circle cx="0" cy="-68" r="92" cz="-820" fill="url(#horizon-sun)"/>
    <polygon points="-460,82 -310,-12 -180,35 -70,-28 50,24 190,-38 330,18 460,82"
             zs="-800 -800 -800 -800 -800 -800 -800 -800"
             fill="#1e1b4b" fill-opacity="0.9" stroke="#6366f1" stroke-width="1.2"/>
  `;

  // 2. Receding 3D neon trench grid & arches
  const trenchLines: string[] = [];
  const spacing = 80;
  const offset = s.scrollZ % spacing;

  // Longitudinal floor rails
  for (let gx = -WALL_X; gx <= WALL_X; gx += 37) {
    const isEdge = Math.abs(gx) >= WALL_X - 5;
    trenchLines.push(
      line3d(
        [gx, FLOOR_Y, -780],
        [gx, FLOOR_Y, 40],
        `stroke="${isEdge ? "#ec4899" : "#312e81"}" stroke-width="${isEdge ? 1.8 : 0.9}"`,
      ),
    );
  }
  // Upper canyon rim rails
  trenchLines.push(
    line3d(
      [-WALL_X, -92, -780],
      [-WALL_X, -92, 40],
      `stroke="#06b6d4" stroke-opacity="0.45" stroke-width="1.2"`,
    ),
    line3d(
      [WALL_X, -92, -780],
      [WALL_X, -92, 40],
      `stroke="#06b6d4" stroke-opacity="0.45" stroke-width="1.2"`,
    ),
  );

  // Transverse floor ribs & glowing side trench arches (<path3d>) rushing toward the camera
  for (let i = 0; i < 10; i++) {
    const z = -760 + i * spacing + offset;
    if (z > 30) continue;
    const fade = clamp((z + 780) / 760, 0.18, 0.92);
    trenchLines.push(
      line3d(
        [-WALL_X, FLOOR_Y, z],
        [WALL_X, FLOOR_Y, z],
        `stroke="#6366f1" stroke-opacity="${fade.toFixed(2)}" stroke-width="1.1"`,
      ),
    );
    // Every second rib gets a full 3D canyon arch using <path3d>
    if (i % 2 === 0) {
      trenchLines.push(
        `<path3d fill="none" stroke="#ec4899" stroke-opacity="${(fade * 0.55).toFixed(2)}" stroke-width="1.2"
          d="M ${-WALL_X},${FLOOR_Y},${f(z)} L ${-WALL_X},-92,${f(z)} L ${-WALL_X + 32},-112,${f(z)} M ${WALL_X},${FLOOR_Y},${f(z)} L ${WALL_X},-92,${f(z)} L ${WALL_X - 32},-112,${f(z)}"/>`,
      );
    }
  }

  // 3. Collect all dynamic 3D objects for painter's depth sorting (§3.4)
  const drawables: Drawable[] = [];

  // 3D aiming reticle ahead of the ship
  const retZ = -195;
  const rx = s.shipX;
  const ry = s.shipY;
  drawables.push({
    depth: distSq3([rx, ry, retZ], camPos),
    markup: `<g stroke="#22d3ee" stroke-opacity="0.78" stroke-width="1.2" fill="none">
      <polygon points="${f(rx - 14)},${f(ry)} ${f(rx)},${f(ry - 14)} ${f(rx + 14)},${f(ry)} ${f(rx)},${f(ry + 14)}"
               zs="${retZ} ${retZ} ${retZ} ${retZ}"/>
      <line x1="${f(rx - 22)}" y1="${f(ry)}" z1="${retZ}" x2="${f(rx - 8)}" y2="${f(ry)}" z2="${retZ}"/>
      <line x1="${f(rx + 8)}" y1="${f(ry)}" z1="${retZ}" x2="${f(rx + 22)}" y2="${f(ry)}" z2="${retZ}"/>
    </g>`,
  });

  // Energy Rings (octagonal 3D gates)
  for (const ring of s.rings) {
    const segs = 10;
    const pts: Vec3[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2 + ring.spin;
      pts.push([ring.x + Math.cos(a) * ring.radius, ring.y + Math.sin(a) * ring.radius, ring.z]);
    }
    const stroke = ring.passed ? "#fde047" : "#34d399";
    drawables.push({
      depth: distSq3([ring.x, ring.y, ring.z], camPos),
      markup: poly3d(
        pts,
        `fill="none" stroke="${stroke}" stroke-width="${ring.passed ? 4 : 3.2}" stroke-opacity="0.92"`,
      ),
    });
  }

  // Enemy Drones & Monolith Obstacles
  for (const d of s.drones) {
    const baseFaces = d.kind === "drone" ? DRONE_BASE : MONOLITH_BASE;
    const faces = baseFaces.map((face) =>
      face.map((pt) => add3(rotateY3(rotateX3(pt, d.spin * 0.7), d.spin), [d.x, d.y, d.z])),
    );
    const baseColor = d.flash > 0 ? "#ffffff" : d.kind === "drone" ? "#f43f5e" : "#f59e0b";
    const stroke = d.kind === "drone" ? "#fda4af" : "#fef08a";
    drawables.push(
      ...shadeFaces(faces, {
        baseColor,
        stroke,
        strokeWidth: 0.9,
        camPos,
        cullBackfaces: true,
        ambient: 0.4,
      }),
    );
  }

  // Twin 3D Laser Bolts
  for (const l of s.lasers) {
    drawables.push({
      depth: distSq3([l.x, l.y, l.z], camPos),
      markup: line3d(
        [l.x, l.y, l.z],
        [l.x, l.y, l.z - 48],
        `stroke="#38bdf8" stroke-width="3.2" stroke-linecap="round"`,
      ),
    });
    drawables.push({
      depth: distSq3([l.x, l.y, l.z], camPos) - 1,
      markup: line3d(
        [l.x, l.y, l.z],
        [l.x, l.y, l.z - 42],
        `stroke="#f0f9ff" stroke-width="1.3" stroke-linecap="round"`,
      ),
    });
  }

  // Explosion 3D Shards
  for (const sh of s.shards) {
    const scale = (sh.life / sh.maxLife) * sh.size;
    const p0: Vec3 = [sh.pos[0], sh.pos[1] - scale, sh.pos[2]];
    const p1: Vec3 = [sh.pos[0] + scale, sh.pos[1] + scale * 0.7, sh.pos[2] + scale * 0.4];
    const p2: Vec3 = [sh.pos[0] - scale, sh.pos[1] + scale * 0.6, sh.pos[2] - scale * 0.4];
    drawables.push({
      depth: distSq3(sh.pos, camPos),
      markup: poly3d(
        [p0, p1, p2],
        `fill="${sh.color}" fill-opacity="${(sh.life / sh.maxLife).toFixed(2)}" stroke="#ffffff" stroke-width="0.6"`,
      ),
    });
  }

  // Floating 3D Score Popups (<text x y z>)
  for (const pop of s.popups) {
    const chars = [...pop.text];
    const xs = chars.map((_, i) => f(pop.pos[0] + (i - chars.length / 2) * 8)).join(" ");
    const ys = chars.map(() => f(pop.pos[1])).join(" ");
    const zs = chars.map(() => f(pop.pos[2])).join(" ");
    drawables.push({
      depth: distSq3(pop.pos, camPos) - 5,
      markup: `<text x="${xs}" y="${ys}" z="${zs}" font-size="13" font-weight="700" font-family="ui-monospace,monospace" fill="${pop.color}">${pop.text}</text>`,
    });
  }

  // Player Starfighter (rendered in Chase & Cinematic modes)
  if (s.camMode !== "cockpit") {
    drawables.push(...buildShipDrawables(s, camPos));
  }

  const bgFlash = s.hitFlash > 0 ? "#3b0722" : "#070919";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -135 420 270" style="background:linear-gradient(180deg,#090d24 0%,${bgFlash} 60%,#120826 100%)">
  <defs>
    <linearGradient id="horizon-sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="52%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <camera projection="perspective" fov="${fov}" position="${f(camPos[0])} ${f(camPos[1])} ${f(camPos[2])}" target="${f(camTarget[0])} ${f(camTarget[1])} ${f(camTarget[2])}" up="0 1 0" near="4" far="920"/>
  ${horizonMarkup}
  ${trenchLines.join("\n")}
  ${sortDrawables(drawables)}
</svg>`;
}

// ---------------------------------------------------------------------------
// Game simulation tick
// ---------------------------------------------------------------------------

function spawnExplosion(s: GameState, pos: Vec3, color: string, count = 8): void {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const el = rand(-1, 1);
    const spd = rand(65, 165);
    s.shards.push({
      pos: [...pos],
      vel: [Math.cos(a) * spd, Math.sin(a) * spd, el * spd],
      life: 0.55,
      maxLife: 0.55,
      size: rand(6, 13),
      color: i % 2 === 0 ? color : "#fef08a",
    });
  }
}

function stepGame(
  s: GameState,
  dt: number,
  keys: Set<string>,
  pointerTarget: { x: number; y: number } | null,
  firing: boolean,
  synth: RetroSynth,
  joystick: { x: number; y: number } | null = null,
): void {
  s.time += dt;
  s.scrollZ += s.speed * dt;
  if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt);

  // Attract mode autopilot on title / gameover screens
  if (s.phase !== "playing") {
    const targetX = Math.sin(s.time * 0.9) * 58;
    const targetY = Math.cos(s.time * 1.3) * 22;
    s.shipVx = (targetX - s.shipX) * 3;
    s.shipVy = (targetY - s.shipY) * 3;
    s.shipX += s.shipVx * dt;
    s.shipY += s.shipVy * dt;
    s.bank = clamp(-s.shipVx * 0.004, -0.5, 0.5);
    s.pitch = clamp(-s.shipVy * 0.003, -0.35, 0.35);
    // Keep any existing shards animating
    for (const sh of s.shards) {
      sh.pos = add3(sh.pos, [sh.vel[0] * dt, sh.vel[1] * dt, sh.vel[2] * dt]);
      sh.life -= dt;
    }
    s.shards = s.shards.filter((sh) => sh.life > 0);
    return;
  }

  // Escalate wave & speed smoothly with score
  s.wave = 1 + Math.floor(s.score / 1800);
  s.speed = Math.min(540, 315 + (s.wave - 1) * 32);

  // Ship steering (keyboard takes priority, optional pointer steering when dragging/moving)
  let ix = 0;
  let iy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) ix -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) ix += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) iy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) iy += 1;

  const moveSpeed = 210;
  if (ix !== 0 || iy !== 0) {
    const len = Math.hypot(ix, iy);
    s.shipVx += ((ix / len) * moveSpeed - s.shipVx) * Math.min(1, dt * 11);
    s.shipVy += ((iy / len) * moveSpeed - s.shipVy) * Math.min(1, dt * 11);
  } else if (joystick && (joystick.x !== 0 || joystick.y !== 0)) {
    // Analog on-screen joystick: stick deflection (0..1) scales ship speed.
    s.shipVx += (joystick.x * moveSpeed - s.shipVx) * Math.min(1, dt * 11);
    s.shipVy += (joystick.y * moveSpeed - s.shipVy) * Math.min(1, dt * 11);
  } else if (pointerTarget) {
    const dx = pointerTarget.x - s.shipX;
    const dy = pointerTarget.y - s.shipY;
    s.shipVx += (clamp(dx * 5.5, -moveSpeed, moveSpeed) - s.shipVx) * Math.min(1, dt * 10);
    s.shipVy += (clamp(dy * 5.5, -moveSpeed, moveSpeed) - s.shipVy) * Math.min(1, dt * 10);
  } else {
    s.shipVx *= Math.max(0, 1 - dt * 9);
    s.shipVy *= Math.max(0, 1 - dt * 9);
  }

  s.shipX = clamp(s.shipX + s.shipVx * dt, -BOUNDS_X, BOUNDS_X);
  s.shipY = clamp(s.shipY + s.shipVy * dt, BOUNDS_Y_TOP, BOUNDS_Y_BOT);
  s.bank += (clamp(-s.shipVx * 0.0026, -0.58, 0.58) - s.bank) * Math.min(1, dt * 10);
  s.pitch += (clamp(-s.shipVy * 0.0022, -0.38, 0.38) - s.pitch) * Math.min(1, dt * 10);

  // Twin laser firing
  s.fireCooldown = Math.max(0, s.fireCooldown - dt);
  if ((firing || keys.has("Space") || keys.has("KeyZ")) && s.fireCooldown <= 0) {
    s.lasers.push(
      { x: s.shipX - 18, y: s.shipY + 4, z: -20, side: -1 },
      { x: s.shipX + 18, y: s.shipY + 4, z: -20, side: 1 },
    );
    s.fireCooldown = 0.16;
    synth.laser();
  }

  // Advance lasers
  for (const l of s.lasers) {
    l.z -= 920 * dt;
  }
  s.lasers = s.lasers.filter((l) => l.z > -820);

  // Spawn enemies & monoliths
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    const isMonolith = Math.random() < 0.3;
    const x = rand(-BOUNDS_X * 0.85, BOUNDS_X * 0.85);
    const y = rand(BOUNDS_Y_TOP * 0.8, BOUNDS_Y_BOT * 0.8);
    s.drones.push({
      id: s.nextId++,
      x,
      y,
      z: -780,
      baseX: x,
      baseY: y,
      phase: rand(0, Math.PI * 2),
      spin: rand(0, Math.PI * 2),
      hp: isMonolith ? 3 : 1,
      kind: isMonolith ? "monolith" : "drone",
      radius: isMonolith ? 24 : 20,
      flash: 0,
    });
    s.spawnTimer = Math.max(0.38, 1.05 - (s.wave - 1) * 0.08);
  }

  // Spawn neon energy rings
  s.ringTimer -= dt;
  if (s.ringTimer <= 0) {
    s.rings.push({
      x: rand(-BOUNDS_X * 0.72, BOUNDS_X * 0.72),
      y: rand(BOUNDS_Y_TOP * 0.7, BOUNDS_Y_BOT * 0.65),
      z: -780,
      radius: 34,
      passed: false,
      spin: 0,
    });
    s.ringTimer = rand(2.6, 3.8);
  }

  // Update rings & check fly-through
  for (const ring of s.rings) {
    ring.z += s.speed * dt;
    ring.spin += dt * 1.4;
    if (!ring.passed && ring.z >= -18 && ring.z <= 22) {
      const dist = Math.hypot(ring.x - s.shipX, ring.y - s.shipY);
      if (dist < ring.radius + 10) {
        ring.passed = true;
        s.combo = Math.min(8, s.combo + 1);
        const pts = 200 * s.combo;
        s.score += pts;
        s.shield = Math.min(100, s.shield + 12);
        s.popups.push({
          pos: [ring.x, ring.y - 16, -25],
          text: `RING x${s.combo}!`,
          color: "#34d399",
          life: 0.9,
        });
        synth.ring();
      }
    }
  }
  s.rings = s.rings.filter((r) => r.z < 75);

  // Update drones & collisions
  const survivingDrones: Drone[] = [];
  for (const d of s.drones) {
    d.z += s.speed * (d.kind === "drone" ? 1.08 : 0.95) * dt;
    d.spin += dt * (d.kind === "drone" ? 2.4 : 0.9);
    if (d.flash > 0) d.flash = Math.max(0, d.flash - dt);
    if (d.kind === "drone") {
      d.x = clamp(d.baseX + Math.sin(s.time * 2.2 + d.phase) * 32, -BOUNDS_X, BOUNDS_X);
      d.y = clamp(d.baseY + Math.cos(s.time * 1.7 + d.phase) * 16, BOUNDS_Y_TOP, BOUNDS_Y_BOT);
    }

    // Check laser hits
    let destroyed = false;
    for (let i = s.lasers.length - 1; i >= 0; i--) {
      const l = s.lasers[i]!;
      if (Math.abs(l.z - d.z) < 42 && Math.hypot(l.x - d.x, l.y - d.y) < d.radius + 11) {
        s.lasers.splice(i, 1);
        d.hp -= 1;
        d.flash = 0.09;
        if (d.hp <= 0) {
          destroyed = true;
          const pts = (d.kind === "drone" ? 150 : 250) * s.combo;
          s.score += pts;
          spawnExplosion(s, [d.x, d.y, d.z], d.kind === "drone" ? "#f43f5e" : "#f59e0b", 9);
          s.popups.push({
            pos: [d.x, d.y - 12, d.z],
            text: `+${pts}`,
            color: "#fde047",
            life: 0.85,
          });
          synth.explode();
          break;
        }
      }
    }
    if (destroyed) continue;

    // Check player collision
    if (d.z >= -24 && d.z <= 22 && Math.hypot(d.x - s.shipX, d.y - s.shipY) < d.radius + 15) {
      s.shield = Math.max(0, s.shield - (d.kind === "monolith" ? 32 : 24));
      s.combo = 1;
      s.hitFlash = 0.25;
      spawnExplosion(s, [d.x, d.y, d.z], "#fb7185", 10);
      synth.hit();
      if (s.shield <= 0) {
        s.phase = "gameover";
        s.best = Math.max(s.best, Math.floor(s.score));
        spawnExplosion(s, [s.shipX, s.shipY, 0], "#38bdf8", 14);
      }
      continue;
    }

    if (d.z < 75) survivingDrones.push(d);
  }
  s.drones = survivingDrones;

  // Passive distance score
  s.score += dt * 18 * s.combo;
  if (s.score > s.best) s.best = Math.floor(s.score);

  // Shards & popups
  for (const sh of s.shards) {
    sh.pos = add3(sh.pos, [sh.vel[0] * dt, sh.vel[1] * dt, sh.vel[2] * dt]);
    sh.life -= dt;
  }
  s.shards = s.shards.filter((sh) => sh.life > 0);

  for (const pop of s.popups) {
    pop.pos[1] -= 28 * dt;
    pop.life -= dt;
  }
  s.popups = s.popups.filter((p) => p.life > 0);
}

// ---------------------------------------------------------------------------
// Story definition
// ---------------------------------------------------------------------------

const cabinetStyle =
  "position:relative;display:flex;flex-direction:column;gap:10px;width:100%;height:100vh;box-sizing:border-box;overflow:hidden;padding:14px;border-radius:14px;background:#070a14;color:#e2e8f0;font:13px/1.4 system-ui,-apple-system,sans-serif;border:1px solid rgba(56,189,248,0.28);box-shadow:0 18px 42px rgba(2,6,23,0.65);user-select:none";
const hudStyle =
  "display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border-radius:8px;background:rgba(15,23,42,0.85);border:1px solid rgba(148,163,184,0.2);font-family:ui-monospace,SFMono-Regular,monospace";
const hudBtn =
  "padding:4px 10px;border-radius:6px;border:1px solid rgba(148,163,184,0.35);background:#1e293b;color:#f8fafc;font:11px/1.3 ui-monospace,monospace;cursor:pointer";
const overlayStyle =
  "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(5,8,20,0.64);backdrop-filter:blur(2px);text-align:center;padding:20px";
const ctaBtn =
  "padding:10px 24px;border-radius:8px;border:1px solid #38bdf8;background:linear-gradient(135deg,#0284c7,#6366f1);color:#ffffff;font:700 14px/1.2 system-ui,sans-serif;letter-spacing:0.06em;cursor:pointer;box-shadow:0 0 22px rgba(56,189,248,0.45)";

export const NeonVectors3D: Story = {
  name: "Neon Vectors 3D (Space Trench Shooter)",
  render: (): TemplateResult => html`
    <style>
      .neon-cabinet {
        width: 100%;
        height: 100vh;
        height: 100dvh;
      }
      .neon-playfield svg3d-viewer {
        touch-action: none;
      }
      .touch-only {
        display: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        touch-action: none;
      }
      @media (pointer: coarse) {
        .touch-only {
          display: flex;
        }
      }
      @media (max-width: 640px) {
        .neon-cabinet {
          padding: 8px !important;
          gap: 6px !important;
        }
      }
      .neon-cabinet:fullscreen {
        width: 100vw;
        height: 100vh;
        border-radius: 0;
        border: none;
        box-shadow: none;
      }
    </style>
    <div class="neon-cabinet" style=${cabinetStyle} data-game="neon-vectors" tabindex="0">
      <div style=${hudStyle}>
        <div style="display:flex;gap:16px;align-items:center">
          <div>
            <span style="color:#94a3b8;font-size:10px">SCORE</span>
            <div data-hud="score" style="font-size:16px;font-weight:700;color:#38bdf8">00000</div>
          </div>
          <div>
            <span style="color:#94a3b8;font-size:10px">BEST</span>
            <div data-hud="best" style="font-size:14px;color:#cbd5e1">00000</div>
          </div>
          <div>
            <span style="color:#94a3b8;font-size:10px">COMBO</span>
            <div data-hud="combo" style="font-size:15px;font-weight:700;color:#34d399">x1</div>
          </div>
          <div>
            <span style="color:#94a3b8;font-size:10px">WAVE</span>
            <div data-hud="wave" style="font-size:15px;color:#facc15">1</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:110px">
            <div
              style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-bottom:3px"
            >
              <span>SHIELD</span>
              <span data-hud="shield-pct">100%</span>
            </div>
            <div style="height:7px;background:#1e293b;border-radius:999px;overflow:hidden">
              <div
                data-hud="shield-bar"
                style="height:100%;width:100%;background:#34d399;transition:width 0.1s"
              ></div>
            </div>
          </div>
          <button data-action="cam" style=${hudBtn}>CAM: CHASE</button>
          <button data-action="sound" style=${hudBtn}>SFX: ON</button>
          <button data-action="pause" style=${hudBtn}>PAUSE</button>
          <button data-action="fs" style=${hudBtn}>⛶ FULLSCREEN</button>
        </div>
      </div>

      <div
        class="neon-playfield"
        style="position:relative;flex:1;min-height:0;width:100%;border-radius:10px;overflow:hidden;border:1px solid rgba(56,189,248,0.22)"
      >
        <svg3d-viewer
          .markup=${buildGameSvg(createInitialState())}
          style="width:100%;height:100%;cursor:crosshair"
        ></svg3d-viewer>

        <button
          class="touch-only"
          data-action="fire"
          style="position:absolute;right:20px;bottom:20px;width:104px;height:104px;border-radius:999px;border:2px solid #f43f5e;background:rgba(244,63,94,0.28);color:#fecdd3;font:800 16px/1 system-ui,sans-serif;letter-spacing:0.08em;align-items:center;justify-content:center;padding:0"
        >
          FIRE
        </button>

        <div
          class="touch-only"
          data-control="joystick"
          style="position:absolute;left:20px;bottom:20px;width:128px;height:128px;border-radius:999px;border:2px solid rgba(56,189,248,0.55);background:rgba(56,189,248,0.14);align-items:center;justify-content:center"
        >
          <div
            data-control="joystick-knob"
            style="width:56px;height:56px;border-radius:999px;border:2px solid #38bdf8;background:rgba(56,189,248,0.4);box-shadow:0 0 14px rgba(56,189,248,0.5);pointer-events:none;will-change:transform"
          ></div>
        </div>

        <div data-overlay="panel" style=${overlayStyle}>
          <div
            style="font:800 30px/1.1 ui-monospace,monospace;letter-spacing:0.12em;color:#f8fafc;text-shadow:0 0 20px rgba(56,189,248,0.8)"
          >
            NEON VECTORS 3D
          </div>
          <div data-overlay="sub" style="font-size:13px;color:#cbd5e1;max-width:460px">
            100% rendered in real time through <code>&lt;svg3d-viewer&gt;</code> using SVG 3D Level
            1 <code>&lt;camera&gt;</code>, <code>&lt;polygon zs&gt;</code>,
            <code>&lt;path3d&gt;</code>, <code>&lt;line z1/z2&gt;</code>, and 3D
            <code>&lt;text&gt;</code>.
          </div>
          <div
            data-overlay="stats"
            style="font:700 15px/1.4 ui-monospace,monospace;color:#fde047;display:none"
          ></div>
          <button data-action="start" style=${ctaBtn}>LAUNCH MISSION</button>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px">
            <b>WASD / Arrows</b> or <b>Mouse</b> steer · <b>Space / Click</b> fire · <b>C</b> camera
            · <b>P</b> pause · <b>F</b> fullscreen ·
            <b>Touch: left stick steers, right button fires</b>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
        <span
          >Blast red <b>Octahedron Drones</b> &amp; amber <b>Monoliths</b>. Fly through green
          <b>Rings</b> for combos &amp; shield!</span
        >
        <span>Press <b>C</b> to switch <code>&lt;camera&gt;</code> modes</span>
      </div>
    </div>
  `,
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-game="neon-vectors"]');
    const viewer = root?.querySelector<HTMLElement & { markup: string }>("svg3d-viewer");
    if (!root || !viewer) return;

    const scoreEl = root.querySelector<HTMLElement>('[data-hud="score"]')!;
    const bestEl = root.querySelector<HTMLElement>('[data-hud="best"]')!;
    const comboEl = root.querySelector<HTMLElement>('[data-hud="combo"]')!;
    const waveEl = root.querySelector<HTMLElement>('[data-hud="wave"]')!;
    const shieldPctEl = root.querySelector<HTMLElement>('[data-hud="shield-pct"]')!;
    const shieldBarEl = root.querySelector<HTMLElement>('[data-hud="shield-bar"]')!;
    const overlay = root.querySelector<HTMLElement>('[data-overlay="panel"]')!;
    const overlaySub = root.querySelector<HTMLElement>('[data-overlay="sub"]')!;
    const overlayStats = root.querySelector<HTMLElement>('[data-overlay="stats"]')!;
    const startBtn = root.querySelector<HTMLButtonElement>('[data-action="start"]')!;
    const camBtn = root.querySelector<HTMLButtonElement>('[data-action="cam"]')!;
    const soundBtn = root.querySelector<HTMLButtonElement>('[data-action="sound"]')!;
    const pauseBtn = root.querySelector<HTMLButtonElement>('[data-action="pause"]')!;
    const fsBtn = root.querySelector<HTMLButtonElement>('[data-action="fs"]')!;
    const fireBtn = root.querySelector<HTMLButtonElement>('[data-action="fire"]')!;
    const joyEl = root.querySelector<HTMLElement>('[data-control="joystick"]')!;
    const joyKnob = root.querySelector<HTMLElement>('[data-control="joystick-knob"]')!;

    const synth = new RetroSynth();
    let state = createInitialState();
    const keys = new Set<string>();
    let pointerTarget: { x: number; y: number } | null = null;
    let pointerDown = false;
    // Touch controls track their own pointers so the joystick and fire button
    // can be used simultaneously (multi-touch) without clobbering each other.
    let fireHeld = false;
    let joystick: { x: number; y: number } | null = null;

    // Pointer lock: on fine-pointer devices the cursor is captured while
    // playing; steering uses movementX/Y deltas. Touch devices keep drag
    // steering (pointer events cover both).
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let locked = false;
    let lockedAim: { x: number; y: number } | null = null;

    const lockPointer = () => {
      if (!finePointer || locked || state.phase !== "playing") return;
      try {
        const res = (
          viewer as HTMLElement & { requestPointerLock?: () => Promise<void> | void }
        ).requestPointerLock?.();
        if (res && typeof (res as Promise<void>).catch === "function") {
          (res as Promise<void>).catch(() => {});
        }
      } catch {
        // pointer lock unavailable on this platform
      }
    };
    const unlockPointer = () => {
      if (document.pointerLockElement) document.exitPointerLock();
    };
    const onLockChange = () => {
      locked = document.pointerLockElement === viewer;
      if (locked) lockedAim = { x: state.shipX, y: state.shipY };
      else lockedAim = null;
    };
    document.addEventListener("pointerlockchange", onLockChange);

    const cycleCam = () => {
      const order: CamMode[] = ["chase", "cockpit", "cinematic"];
      const next = order[(order.indexOf(state.camMode) + 1) % order.length]!;
      state.camMode = next;
      camBtn.textContent = `CAM: ${next.toUpperCase()}`;
    };

    const startGame = () => {
      const best = state.best;
      const cam = state.camMode;
      state = createInitialState(best);
      state.camMode = cam;
      state.phase = "playing";
      overlay.style.display = "none";
      pauseBtn.textContent = "PAUSE";
      root.focus();
      lockPointer();
    };

    const togglePause = () => {
      if (state.phase === "playing") {
        state.phase = "paused";
        if (timeline.isRunning) timeline.stop();
        unlockPointer();
        overlay.style.display = "flex";
        overlaySub.textContent = "Mission paused. Press P or click Resume to continue.";
        overlayStats.style.display = "none";
        startBtn.textContent = "RESUME";
        pauseBtn.textContent = "RESUME";
      } else if (state.phase === "paused") {
        state.phase = "playing";
        last = performance.now(); // avoid a dt jump across the pause
        if (!timeline.isRunning) timeline.start();
        overlay.style.display = "none";
        pauseBtn.textContent = "PAUSE";
        root.focus();
      }
    };

    startBtn.onclick = () => {
      if (state.phase === "paused") togglePause();
      else startGame();
    };
    camBtn.onclick = cycleCam;
    soundBtn.onclick = () => {
      synth.enabled = !synth.enabled;
      soundBtn.textContent = synth.enabled ? "SFX: ON" : "SFX: OFF";
    };
    pauseBtn.onclick = togglePause;

    const toggleFullscreen = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        const res = root.requestFullscreen?.() as Promise<void> | undefined;
        if (res && typeof res.catch === "function") res.catch(() => {});
      }
    };
    fsBtn.onclick = toggleFullscreen;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!root.isConnected) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      keys.add(e.code);
      if (e.code === "KeyC") cycleCam();
      if (e.code === "KeyP") togglePause();
      if (e.code === "KeyF") toggleFullscreen();
      if ((e.code === "Enter" || e.code === "KeyR") && state.phase !== "playing") {
        startGame();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    viewer.addEventListener("pointermove", (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // touch uses the on-screen controls
      if (state.phase !== "playing") return;
      if (locked) {
        if (lockedAim) {
          lockedAim = {
            x: clamp(lockedAim.x + e.movementX * 0.38, -BOUNDS_X, BOUNDS_X),
            y: clamp(lockedAim.y + e.movementY * 0.38, BOUNDS_Y_TOP, BOUNDS_Y_BOT),
          };
          pointerTarget = lockedAim;
        }
        return;
      }
      const rect = viewer.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      pointerTarget = {
        x: clamp(nx * BOUNDS_X * 1.15, -BOUNDS_X, BOUNDS_X),
        y: clamp(ny * 74, BOUNDS_Y_TOP, BOUNDS_Y_BOT),
      };
    });
    viewer.addEventListener("pointerleave", () => {
      pointerTarget = null;
      pointerDown = false;
    });
    viewer.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (state.phase !== "playing") return;
      pointerDown = true;
      lockPointer();
    });
    viewer.addEventListener("contextmenu", (e) => e.preventDefault());

    // On-screen FIRE button (touch devices): hold to fire.
    let firePointer: number | null = null;
    fireBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (firePointer !== null) return;
      firePointer = e.pointerId;
      fireBtn.setPointerCapture?.(e.pointerId);
      fireHeld = true;
      fireBtn.style.background = "rgba(244,63,94,0.55)";
    });
    const releaseFire = (e: PointerEvent) => {
      if (e.pointerId !== firePointer) return;
      firePointer = null;
      fireHeld = false;
      fireBtn.style.background = "rgba(244,63,94,0.28)";
    };
    fireBtn.addEventListener("pointerup", releaseFire);
    fireBtn.addEventListener("pointercancel", releaseFire);
    fireBtn.addEventListener("contextmenu", (e) => e.preventDefault());

    // On-screen analog JOYSTICK (touch devices): drag the knob to steer.
    const JOY_RADIUS = 48;
    const JOY_DEADZONE = 0.12;
    let joyPointer: number | null = null;
    const updateJoystick = (e: PointerEvent) => {
      const r = joyEl.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(1, len / JOY_RADIUS);
      if (mag < JOY_DEADZONE) {
        joystick = null;
      } else {
        // Rescale so output ramps smoothly from 0 just outside the deadzone.
        const scaled = (mag - JOY_DEADZONE) / (1 - JOY_DEADZONE);
        joystick = {
          x: (dx / JOY_RADIUS) * (scaled / mag),
          y: (dy / JOY_RADIUS) * (scaled / mag),
        };
      }
    };
    const releaseJoystick = (e: PointerEvent) => {
      if (e.pointerId !== joyPointer) return;
      joyPointer = null;
      joystick = null;
      joyKnob.style.transform = "";
    };
    joyEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (joyPointer !== null) return;
      joyPointer = e.pointerId;
      joyEl.setPointerCapture?.(e.pointerId);
      updateJoystick(e);
    });
    joyEl.addEventListener("pointermove", (e) => {
      if (e.pointerId === joyPointer) updateJoystick(e);
    });
    joyEl.addEventListener("pointerup", releaseJoystick);
    joyEl.addEventListener("pointercancel", releaseJoystick);
    joyEl.addEventListener("contextmenu", (e) => e.preventDefault());

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerDown = false;
    };
    window.addEventListener("pointerup", onPointerUp);

    let last = performance.now();
    let prevPhase: GamePhase = state.phase;

    // Simulation/render loop driven by @two-web/kit/animations:
    // - Timeline owns the loop lifecycle (started here, stopped while
    //   paused, stopped permanently when the story unmounts).
    // - The per-frame DOM writes are scheduled through animate() with
    //   animation() identifiers, so the many 1ms Timeline ticks between
    //   display frames coalesce into a single markup/HUD write per frame.
    const renderId = animation("neon-vectors:render");
    const hudId = animation("neon-vectors:hud");

    const updateHud = () => {
      scoreEl.textContent = String(Math.floor(state.score)).padStart(5, "0");
      bestEl.textContent = String(Math.floor(state.best)).padStart(5, "0");
      comboEl.textContent = `x${state.combo}`;
      waveEl.textContent = String(state.wave);
      shieldPctEl.textContent = `${Math.round(state.shield)}%`;
      shieldBarEl.style.width = `${state.shield}%`;
      shieldBarEl.style.background =
        state.shield > 50 ? "#34d399" : state.shield > 25 ? "#facc15" : "#f43f5e";

      if (state.phase !== prevPhase) {
        prevPhase = state.phase;
        if (state.phase === "gameover") {
          unlockPointer();
          overlay.style.display = "flex";
          overlaySub.textContent = "Shields depleted! Ready for another trench run?";
          overlayStats.style.display = "block";
          overlayStats.textContent = `FINAL SCORE: ${Math.floor(state.score)}  ·  WAVE ${state.wave}  ·  BEST: ${Math.floor(state.best)}`;
          startBtn.textContent = "PLAY AGAIN";
        }
      }
    };

    const timeline = new Timeline(() => {
      if (!viewer.isConnected) {
        if (timeline.isRunning) timeline.stop();
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointerlockchange", onLockChange);
        unlockPointer();
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (state.phase === "paused" || dt <= 0) return;
      stepGame(state, dt, keys, pointerTarget, pointerDown || fireHeld, synth, joystick);
      animate(() => {
        viewer.markup = buildGameSvg(state);
      }, renderId);
      animate(() => {
        updateHud();
      }, hudId);
    });
    timeline.start();
  },
};
