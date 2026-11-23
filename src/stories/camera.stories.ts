import { html, type TemplateResult } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";

type Story = StoryObj<typeof meta>;
import "../svg3d-viewer.ts";

const meta = {
  title: "SVG3D/3 Camera",
  component: "svg3d-viewer",
  parameters: { docs: { autodocs: true } },
} satisfies Meta;

export default meta;

const viewer = (markup: string, w = 460, h = 380): TemplateResult =>
  html`<svg3d-viewer .markup=${markup} style="width:${w}px;height:${h}px"></svg3d-viewer>`;

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

/** Floor grid of lines at y=140. */
const floor = (): string => {
  const lines: string[] = [];
  for (let i = -50; i <= 250; i += 50) {
    lines.push(`<line x1="${i}" y1="140" z1="-100" x2="${i}" y2="140" z2="300"/>`);
    lines.push(`<line x1="-100" y1="140" z1="${i}" x2="300" y2="140" z2="${i}"/>`);
  }
  return lines.join("\n    ");
};

const SCENE = `
    <g stroke="#4a5568" stroke-width="1.5">
    ${boxEdges()}
    </g>
    <g stroke="#a0aec0" stroke-width="0.75">
    ${floor()}
    </g>
    <circle cx="50" cy="50" r="8" cz="50" fill="#e53e3e"/>
`;

export const CameraReference: Story = {
  name: "camera attribute url(#id) reuse (defs)",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -90 180 180" camera="#orbit">
    <defs>
      <camera id="orbit" projection="perspective" fov="55" position="220 180 280" target="50 50 50" up="0 1 0" near="1"/>
    </defs>
    ${SCENE}
  </svg>`,
    ),
};

export const NearFarClipping: Story = {
  name: "Depth clipping (near/far)",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -90 180 180">
    <camera projection="perspective" fov="55" position="220 180 280" target="50 50 50" up="0 1 0" near="260" far="420"/>
    ${SCENE}
  </svg>`,
    ),
};

const flythroughMarkup = (t: number): string => {
  const a = ((t * 0.35 * Math.PI) / 180) * 4; // slow orbit
  const r = 300;
  const x = 50 + r * Math.cos(a);
  const z = 50 + r * Math.sin(a);
  const y = 150 + 60 * Math.sin(a * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -90 180 180">
    <camera projection="perspective" fov="55" position="${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}" target="50 50 50" up="0 1 0" near="1"/>
    ${SCENE}
  </svg>`;
};

export const CameraFlythrough: Story = {
  name: "Animated camera (orbit)",
  render: () => viewer(flythroughMarkup(0)),
  play: ({ canvasElement }) => {
    const host = canvasElement.querySelector<HTMLElement & { markup: string }>("svg3d-viewer");
    if (!host) return;
    const start = performance.now();
    const tick = () => {
      if (!host.isConnected) {
        clearInterval(timer);
        return;
      }
      host.markup = flythroughMarkup((performance.now() - start) / 1000);
    };
    const timer = setInterval(tick, 40);
  },
};

const bobMarkup = (t: number): string => {
  const zb = 60 + 45 * Math.sin((t * Math.PI * 2) / 2.5);
  const za = 60 + 45 * Math.cos((t * Math.PI * 2) / 2.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -90 180 180">
    <camera projection="perspective" fov="50" position="150 150 300" target="50 50 50" up="0 1 0" near="1"/>
    <g stroke="#718096" stroke-width="1">
      <line x1="0" y1="0" z1="0" x2="100" y2="0" z2="0"/>
      <line x1="100" y1="0" z1="0" x2="100" y2="100" z2="0"/>
      <line x1="100" y1="100" z1="0" x2="0" y2="100" z2="0"/>
      <line x1="0" y1="100" z1="0" x2="0" y2="0" z2="0"/>
      <line x1="50" y1="50" z1="0" x2="50" y2="50" z2="110" stroke-dasharray="3 3"/>
    </g>
    <circle cx="50" cy="50" r="14" cz="${za.toFixed(1)}" fill="#e53e3e"/>
    <circle cx="50" cy="50" r="14" cz="${zb.toFixed(1)}" fill="#3182ce" fill-opacity="0.85"/>
  </svg>`;
};

export const DepthBob: Story = {
  name: "Animated cz (depth motion under perspective)",
  render: () => viewer(bobMarkup(0)),
  play: ({ canvasElement }) => {
    const host = canvasElement.querySelector<HTMLElement & { markup: string }>("svg3d-viewer");
    if (!host) return;
    const start = performance.now();
    const timer = setInterval(() => {
      if (!host.isConnected) {
        clearInterval(timer);
        return;
      }
      host.markup = bobMarkup((performance.now() - start) / 1000);
    }, 40);
  },
};
