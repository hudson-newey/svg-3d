/**
 * End-to-end check of the keyboard camera controls: registers the real
 * `<svg3d-viewer>` element in a DOM, dispatches key events, and asserts the
 * projected output changes. Run: node scripts/controls-smoke.ts
 */
import { Window } from "happy-dom";

const win = new Window();
globalThis.document = win.document as unknown as Document;
globalThis.DOMParser = win.DOMParser as unknown as typeof DOMParser;
globalThis.SVGSVGElement = win.SVGSVGElement as unknown as typeof SVGSVGElement;
globalThis.HTMLElement = win.HTMLElement as unknown as typeof HTMLElement;
globalThis.SVGElement = win.SVGElement as unknown as typeof SVGElement;
globalThis.Element = win.Element as unknown as typeof Element;
globalThis.customElements = win.customElements as unknown as typeof CustomElementRegistry;
globalThis.CSSStyleSheet = win.CSSStyleSheet as unknown as typeof CSSStyleSheet;
globalThis.XMLSerializer = win.XMLSerializer as unknown as typeof XMLSerializer;

// Node strip-types cannot execute decorators; pre-transform with esbuild
// (it honors this repo's tsconfig, including experimentalDecorators).
import { build } from "esbuild";
await build({
  entryPoints: ["src/svg3d-viewer.ts"],
  outfile: ".tmp/component.mjs",
  bundle: true,
  format: "esm",
  external: ["lit"],
  tsconfig: "tsconfig.json",
  logLevel: "silent",
});
await import("../.tmp/component.mjs"); // registers <svg3d-viewer>
const { html, render } = await import("lit");
const { unsafeHTML } = await import("lit/directives/unsafe-html.js");

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name} ${detail}`);
  }
}

const MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -90 180 180">
  <camera projection="perspective" fov="55" position="220 180 280" target="50 50 50" up="0 1 0" near="1"/>
  <line x1="0" y1="0" z1="0" x2="100" y2="100" z2="100" stroke="black"/>
</svg>`;

type ViewerEl = HTMLElement & { markup: string; controls: boolean };
const el = document.createElement("svg3d-viewer") as ViewerEl;
el.setAttribute("controls", "");
document.body.appendChild(el);
el.markup = MARKUP;
await el.updateComplete;

function firstPathD(): string {
  const svg = el.shadowRoot!.querySelector(".frame")!.querySelector("svg")!;
  return svg.querySelector("path")!.getAttribute("d")!;
}

function press(key: string, shiftKey = false): void {
  el.dispatchEvent(new win.KeyboardEvent("keydown", { key, shiftKey }));
}

const d0 = firstPathD();
check("initial render has projected path", d0.includes("M "), d0);
check("host is focusable via tabindex", el.getAttribute("tabindex") === "0");

press("ArrowRight");
await el.updateComplete;
const dOrbit = firstPathD();
check("ArrowRight changes projection", dOrbit !== d0, dOrbit);

press("ArrowLeft"); // orbit back
await el.updateComplete;
check("opposite orbit restores projection", firstPathD() === d0, firstPathD());

press("ArrowUp");
await el.updateComplete;
const dEl = firstPathD();
check("ArrowUp changes projection", dEl !== d0 && dEl !== dOrbit);

press("r");
await el.updateComplete;
check("R resets to document camera", firstPathD() === d0, firstPathD());

press("-");
await el.updateComplete;
const dZoomOut = firstPathD();
check("dolly out changes projection", dZoomOut !== d0);

press("+");
press("+");
await el.updateComplete;
const dZoomIn = firstPathD();
check("dolly in changes projection", dZoomIn !== dZoomOut && dZoomIn !== d0);

press("R");
press("Shift", true); // ignored modifier-only event
press("ArrowLeft", true);
await el.updateComplete;
const dPan = firstPathD();
check("shift+arrow pans", dPan !== d0, dPan);

// A viewer without `controls` must ignore keys entirely (degradation).
type PlainEl = HTMLElement & { markup: string };
const plain = document.createElement("svg3d-viewer") as PlainEl;
document.body.appendChild(plain);
plain.markup = MARKUP;
await plain.updateComplete;
const plainD0 = (plain.shadowRoot!.querySelector(".frame")!.querySelector("svg") as SVGSVGElement)
  .querySelector("path")!
  .getAttribute("d")!;
plain.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight" }));
await plain.updateComplete;
check(
  "keys ignored without controls attribute",
  (plain.shadowRoot!.querySelector(".frame")!.querySelector("svg") as SVGSVGElement)
    .querySelector("path")!
    .getAttribute("d") === plainD0,
);

// Declarative usage: SVG source provided via the default slot.
const slotted = document.createElement("svg3d-viewer") as HTMLElement;
slotted.innerHTML =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<line x1="10" y1="20" z1="0" x2="30" y2="40" z2="0" stroke="black"/></svg>';
document.body.appendChild(slotted);
await slotted.updateComplete;
await new Promise((r) => setTimeout(r, 5)); // slotchange is async
await slotted.updateComplete;
const slotD = slotted.shadowRoot!.querySelector(".frame svg path")?.getAttribute("d");
check("slot content projects", slotD === "M 10,20 L 30,40", slotD ?? "no path");

// Slot content delivered through lit's unsafeHTML — the exact path the
// static Storybook stories use.
const unsafeHost = document.createElement("div");
document.body.appendChild(unsafeHost);
render(
  html`<svg3d-viewer>
    ${unsafeHTML(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><line x1="5" y1="5" z1="0" x2="25" y2="25" z2="0" stroke="red"/></svg>',
    )}
  </svg3d-viewer>`,
  unsafeHost,
);
await new Promise((r) => setTimeout(r, 5));
const litViewer = unsafeHost.querySelector("svg3d-viewer") as HTMLElement & {
  updateComplete: Promise<boolean>;
};
await litViewer.updateComplete;
const litD = litViewer.shadowRoot!.querySelector(".frame svg path")?.getAttribute("d");
check("unsafeHTML slot content projects", litD === "M 5,5 L 25,25", litD ?? "no path");

console.log(
  failures === 0
    ? "\nAll keyboard-control checks passed"
    : `\n${failures} keyboard-control check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
