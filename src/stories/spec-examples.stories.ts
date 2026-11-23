import { html, type TemplateResult } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../svg3d-viewer.ts";

const meta = {
  title: "SVG3D/4 Spec Examples",
  component: "svg3d-viewer",
  parameters: { docs: { autodocs: true } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

import { unsafeHTML } from "lit/directives/unsafe-html.js";

/**
 * Static content is delivered through the default slot (declarative usage);
 * unsafeHTML places the full <svg> document as a light-DOM child, which the
 * viewer's hidden slot picks up and projects.
 */
const viewer = (markup: string, w = 340, h = 260): TemplateResult =>
  html`<svg3d-viewer style="width:${w}px;height:${h}px">${unsafeHTML(markup)}</svg3d-viewer>`;

/** The exact examples printed in specs/svg-3d-level-1.md. */
export const SpecSnippets: Story = {
  name: "Examples from the specification text",
  render: () =>
    html`<div style="display:grid;grid-template-columns:repeat(3,auto);gap:16px;align-items:start">
      <div>
        <div style="font:12px sans-serif;margin-bottom:4px">§6.1 line z1/z2</div>
        ${viewer(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
        <line x1="10" y1="10" z1="0" x2="80" y2="60" z2="40" stroke="#3182ce" stroke-width="3"/>
      </svg>`,
        )}
      </div>
      <div>
        <div style="font:12px sans-serif;margin-bottom:4px">§8.2 polygon zs</div>
        ${viewer(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
        <polygon points="10,10 80,20 50,70" zs="0 40 20" fill="#f6ad55" stroke="#c05621"/>
      </svg>`,
        )}
      </div>
      <div>
        <div style="font:12px sans-serif;margin-bottom:4px">§6.6 text z list</div>
        ${viewer(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
        <text x="10 30 50" y="20 20 20" z="0 10 20" font-size="28" font-family="monospace" fill="#2d3748">3D</text>
      </svg>`,
        )}
      </div>
    </div>`,
};

export const SwitchFallback: Story = {
  name: "§12.2 switch + requiredExtensions",
  render: () =>
    html`<div style="display:flex;gap:16px">
      <div>
        <div style="font:12px sans-serif;margin-bottom:4px">
          ours (urn:svg3d:1.0) → path3d branch
        </div>
        ${viewer(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160">
        <switch>
          <path3d d="M 20,140,0 l 60,-90,30 l 40,20,50 l -80,50,-40 Z" fill="#bee3f8" stroke="#2b6cb0"
                  requiredExtensions="urn:svg3d:1.0"/>
          <path d="M 20,140 L 80,50 L 120,70 L 40,120 Z" fill="#e2e8f0" stroke="#718096"/>
        </switch>
      </svg>`,
        )}
      </div>
      <div>
        <div style="font:12px sans-serif;margin-bottom:4px">
          unknown extension → 2D fallback branch
        </div>
        ${viewer(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160">
        <switch>
          <path3d d="M 20,140,0 l 60,-90,30 l 40,20,50 l -80,50,-40 Z" fill="#bee3f8" stroke="#2b6cb0"
                  requiredExtensions="urn:some-other-thing:9.9"/>
          <path d="M 20,140 L 80,50 L 120,70 L 40,120 Z" fill="#e2e8f0" stroke="#718096"/>
        </switch>
      </svg>`,
        )}
      </div>
    </div>`,
};

export const SlideScene: Story = {
  name: "Combined scene (shapes + path3d + text + camera)",
  render: () =>
    viewer(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220">
    <camera projection="perspective" fov="50" position="170 140 260" target="50 60 40" up="0 1 0" near="1"/>
    <rect x="0" y="0" width="100" height="100" z="100" fill="#ebf8ff" stroke="#90cdf4"/>
    <path3d fill="none" stroke="#3182ce" stroke-width="2"
      d="M 0,0,100 l 0,100,0 l 100,0,0 M 100,0,100 l -100,100,0"/>
    <polygon points="20,80 80,80 80,30 20,30" zs="100 100 100 100" fill="#fbd38d" fill-opacity="0.9" stroke="#c05621"/>
    <line x1="20" y1="30" z1="100" x2="80" y2="30" z2="60" stroke="#e53e3e" stroke-width="2"/>
    <text x="8 20 32 44 56 68 80 92" y="112 112 112 112 112 112 112 112" z="100 100 100 100 100 100 100 100"
          font-size="10" font-family="sans-serif" fill="#4a5568">SVG 3D!</text>
  </svg>`,
      460,
      400,
    ),
};
