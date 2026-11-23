import { html, type TemplateResult } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";

type Story = StoryObj<typeof meta>;
import "../svg3d-viewer.ts";

const meta = {
  title: "SVG3D/2 Path3d",
  component: "svg3d-viewer",
  parameters: { docs: { autodocs: true } },
} satisfies Meta;

export default meta;

import { unsafeHTML } from "lit/directives/unsafe-html.js";

/**
 * Static content is delivered through the default slot (declarative usage);
 * unsafeHTML places the full <svg> document as a light-DOM child, which the
 * viewer's hidden slot picks up and projects.
 */
const viewer = (markup: string, w = 460, h = 380): TemplateResult =>
  html`<svg3d-viewer style="width:${w}px;height:${h}px">${unsafeHTML(markup)}</svg3d-viewer>`;

/** Oblique orthographic camera shared by these stories. */
const CAM =
  '<camera projection="orthographic" position="260 180 260" target="100 100 40" up="0 1 0"/>';

export const CurveRibbon: Story = {
  name: "Cubic triples (C with 3D control points)",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -120 240 240">
    ${CAM}
    <path3d fill="none" stroke="#2b6cb0" stroke-width="3"
      d="M 20,180,0 C 60,40,90 120,40,90 180,160,0 S 60,20,-60 20,20,-40"/>
    <path3d fill="none" stroke="#dd6b20" stroke-width="2" stroke-dasharray="4 3"
      d="m 20,180,0 l 40,-140,90 l 60,0,0 l 60,120,-90"/>
  </svg>`,
    ),
};

export const ArcsAndStraight: Story = {
  name: "Arcs (A) and axis lines (H/V)",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -120 240 240">
    ${CAM}
    <path3d fill="#bee3f8" fill-opacity="0.6" stroke="#2b6cb0" stroke-width="2"
      d="M 30,60,40 A 40,40,0 1,1 150,120,-30 Z"/>
    <path3d fill="none" stroke="#276749" stroke-width="2"
      d="M -40,90,10 H 60 V 150 Z M 80,-60,50 h 70 v 40 z"/>
    <circle cx="30" cy="60" r="4" cz="40" fill="#e53e3e"/>
    <circle cx="150" cy="120" r="4" cz="-30" fill="#e53e3e"/>
  </svg>`,
    ),
};

export const ClosedSubpaths: Story = {
  name: "Closed subpaths and relative triples",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -120 240 240">
    ${CAM}
    <path3d fill="#faf089" fill-opacity="0.75" stroke="#b7791f" stroke-width="2"
      d="M 0,0,0 l 60,-30,40 l 30,60,10 l -60,30,-40 Z
         m 40,40,60 l 50,-20,30 l 10,50,20 Z
         M -80,40,-30 l 40,10,-20 l -10,40,10 Z"/>
  </svg>`,
    ),
};
