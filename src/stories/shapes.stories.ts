import { html, type TemplateResult } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";

type Story = StoryObj<typeof meta>;
import "../svg3d-viewer.ts";

const meta = {
  title: "SVG3D/1 Shapes",
  component: "svg3d-viewer",
  parameters: { docs: { autodocs: true } },
} satisfies Meta;

export default meta;

const viewer = (markup: string, w = 420, h = 340): TemplateResult =>
  html`<svg3d-viewer .markup=${markup} style="width:${w}px;height:${h}px"></svg3d-viewer>`;

/** Wireframe box edges, as `line` elements with z1/z2. */
const boxEdges = (): string => {
  const v = [
    [0, 0, 0],
    [100, 0, 0],
    [0, 100, 0],
    [100, 100, 0],
    [0, 0, 100],
    [100, 0, 100],
    [0, 100, 100],
    [100, 100, 100],
  ];
  const edges = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  return edges
    .map((pair) => {
      const a = pair[0]!;
      const b = pair[1]!;
      return `<line x1="${v[a]![0]}" y1="${v[a]![1]}" z1="${v[a]![2]}" x2="${v[b]![0]}" y2="${v[b]![1]}" z2="${v[b]![2]}"/>`;
    })
    .join("\n    ");
};

export const FlatCompat: Story = {
  name: "Backwards compatibility (z ignored = flat)",
  render: () =>
    html`<div style="display:flex;gap:16px;align-items:center">
      ${viewer(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
      <rect x="10" y="10" width="80" height="60" z="0" fill="#9ae6b4" stroke="#276749"/>
      <circle cx="150" cy="40" r="25" cz="0" fill="#bee3f8" stroke="#2b6cb0"/>
      <line x1="10" y1="100" z1="0" x2="190" y2="130" z2="0" stroke="#4a5568" stroke-width="2"/>
      <polygon points="100,60 140,60 120,95" zs="0 0 0" fill="#fbd38d" stroke="#c05621"/>
    </svg>`,
      )}
      ${viewer(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
      <rect x="10" y="10" width="80" height="60" fill="#9ae6b4" stroke="#276749"/>
      <circle cx="150" cy="40" r="25" fill="#bee3f8" stroke="#2b6cb0"/>
      <line x1="10" y1="100" x2="190" y2="130" stroke="#4a5568" stroke-width="2"/>
      <polygon points="100,60 140,60 120,95" fill="#fbd38d" stroke="#c05621"/>
    </svg>`,
      )}
    </div>`,
};

export const WireframeBoxOrtho: Story = {
  name: "Wireframe box — line z1/z2, orthographic camera",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
    <camera projection="orthographic" position="160 140 180" target="50 50 50" up="0 1 0"/>
    <g stroke="${"#4a5568"}" stroke-width="1.5">
    ${boxEdges()}
    </g>
    <circle cx="50" cy="50" r="6" cz="50" fill="#e53e3e"/>
  </svg>`,
    ),
};

export const PerspectiveBox: Story = {
  name: "Wireframe box — perspective camera",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
    <camera projection="perspective" fov="50" position="220 180 280" target="50 50 50" up="0 1 0" near="1"/>
    <g stroke="${"#4a5568"}" stroke-width="1.5">
    ${boxEdges()}
    </g>
  </svg>`,
    ),
};

export const PolygonZs: Story = {
  name: "Low-poly pyramid — polygon points + zs",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
    <camera projection="orthographic" position="150 130 150" target="50 60 50" up="0 1 0"/>
    <polygon points="0,90 100,90 50,10"  zs="0 0 50"  fill="#fbd38d" fill-opacity="0.9" stroke="#c05621"/>
    <polygon points="100,90 100,90 50,10" zs="0 100 50" fill="#f6ad55" fill-opacity="0.9" stroke="#c05621"/>
    <polygon points="100,90 0,90 50,10"  zs="100 100 50" fill="#f6e05e" fill-opacity="0.9" stroke="#c05621"/>
    <polygon points="0,90 0,90 50,10"    zs="100 0 50"  fill="#ecc94b" fill-opacity="0.9" stroke="#c05621"/>
    <polygon points="0,90 100,90 100,90 0,90" zs="0 0 100 100" fill="#68d391" fill-opacity="0.5" stroke="#276749"/>
  </svg>`,
    ),
};

export const Transforms3d: Story = {
  name: "3D transforms on 2D shapes (default camera)",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 180">
    <g stroke="#2d3748" fill="#bee3f8" fill-opacity="0.7">
      <rect x="10" y="30" width="70" height="70" rx="12" transform="rotateX(60)"/>
      <rect x="100" y="30" width="70" height="70" rx="12" transform="rotateY(55)"/>
      <rect x="185" y="30" width="70" height="70" rx="12" transform="rotateZ(30)"/>
      <circle cx="45" cy="140" r="32" transform="rotateX(65) translate3d(0 0 0)"/>
      <rect x="110" y="110" width="60" height="60" transform="translate3d(10 -20 40) rotate3d(0.5 0.8 0.2 35)" fill="#fbd38d"/>
    </g>
  </svg>`,
    ),
};
