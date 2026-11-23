import { LitElement, css, html, nothing } from "lit";
import { property } from "lit/decorators.js";
import { type CameraDef, viewBasis } from "./lib/camera.ts";
import { renderSvg3d, resolveCamera } from "./lib/render.ts";

/**
 * `<svg3d-viewer>` — reference viewer for the SVG 3D Level 1 draft.
 *
 * Takes an SVG 3D document (markup string or `src` URL), applies the spec's
 * project-early pipeline (§3.1): model transforms → camera view → projection
 * → plain SVG 2 output that the browser paints directly.
 *
 * Supported (v1): line z1/z2, rect/circle/ellipse z & cz, polyline/polygon
 * zs, path3d (full grammar), text x/y/z lists, 3D transform functions,
 * <camera> (orthographic + perspective), <switch> with the urn:svg3d:1.0
 * extension. Not supported: image, use, SMIL animation (static snapshot).
 *
 * With the `controls` attribute, the viewer is focusable and the camera can
 * be driven from the keyboard:
 *
 * - Arrow ←/→: orbit around the camera's target
 * - Arrow ↑/↓: orbit elevation
 * - + / −: dolly toward/away from the target (perspective)
 * - Shift + arrows: pan the view plane
 * - R: reset all deltas
 */
const ORBIT_STEP = (5 * Math.PI) / 180;
const ELEV_STEP = (3 * Math.PI) / 180;
const ELEV_MAX = (85 * Math.PI) / 180;
const PAN_STEP = 6;
const ZOOM_IN = 0.85;
const ZOOM_OUT = 1.18;

/** Base camera used for interaction when the document declares none. */
function interactionBaseCamera(root: SVGSVGElement): CameraDef {
  const hasDocCamera =
    root.getAttribute("camera") !== null || [...root.children].some((c) => c.tagName === "camera");
  if (hasDocCamera) return resolveCamera(root);
  // Same view direction as the default camera, aimed at the origin so that
  // orbiting behaves sensibly for content centered on the origin.
  return { ...resolveCamera(root), position: [0, 0, 1], target: [0, 0, 0] };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export class Svg3dViewer extends LitElement {
  /** Inline SVG 3D markup to render. */
  @property() markup = "";
  /** URL to fetch SVG 3D markup from (sets `markup`). */
  @property() src = "";
  /** Enable keyboard camera controls (host becomes focusable). */
  @property({ type: Boolean }) controls = false;

  @property({ state: true }) private error = "";

  #root: SVGSVGElement | null = null;
  #orbitAz = 0;
  #orbitEl = 0;
  #zoom = 1;
  #panX = 0;
  #panY = 0;

  static styles = css`
    :host {
      display: block;
      position: relative;
    }
    :host(:focus) {
      outline: 2px solid #3182ce;
      outline-offset: -2px;
    }
    .frame,
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .error {
      color: #b3261e;
      font: 12px/1.5 monospace;
      padding: 8px;
      white-space: pre-wrap;
    }
    .hint {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 6px;
      font: 10px/1.4 monospace;
      color: rgba(255, 255, 255, 0.85);
      background: rgba(0, 0, 0, 0.4);
      border-radius: 4px;
      padding: 3px 8px;
      pointer-events: none;
    }
  `;

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("src") && this.src) void this.#load(this.src);
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("markup") || changed.has("src")) this.#project();
    else if (changed.has("controls")) this.#renderDoc();
  }

  protected render() {
    return html`
      <div class="frame" part="frame"></div>
      ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
      ${
        this.controls
          ? html`<div class="hint">
              ←→ orbit · ↑↓ elevation · +/− dolly · shift+arrows pan · R reset
            </div>`
          : nothing
      }
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    this.addEventListener("keydown", this.#onKeydown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("keydown", this.#onKeydown);
    super.disconnectedCallback();
  }

  async #load(url: string): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
      this.markup = await res.text();
    } catch (err) {
      this.error = String(err);
    }
  }

  #project(): void {
    this.error = "";
    const frame = this.renderRoot.querySelector(".frame");
    if (!frame || !this.markup.trim()) return;
    const doc = new DOMParser().parseFromString(this.markup, "image/svg+xml");
    const root = doc.documentElement;
    if (doc.querySelector("parsererror") || !(root instanceof SVGSVGElement)) {
      this.error = "Invalid SVG markup";
      return;
    }
    this.#root = root;
    this.#renderDoc();
  }

  #renderDoc(): void {
    const frame = this.renderRoot.querySelector(".frame");
    if (!frame || !this.#root) return;
    try {
      frame.replaceChildren(
        renderSvg3d(this.#root, (m) => console.warn(`[svg3d-viewer] ${m}`), {
          camera: this.#cameraOverride(),
        }),
      );
    } catch (err) {
      this.error = String(err);
    }
  }

  /**
   * The document's own camera with orbit/zoom/pan deltas applied, or
   * undefined when no deltas are active (render with the document camera).
   */
  #cameraOverride(): CameraDef | undefined {
    if (!this.controls || !this.#root) return undefined;
    if (
      this.#orbitAz === 0 &&
      this.#orbitEl === 0 &&
      this.#zoom === 1 &&
      this.#panX === 0 &&
      this.#panY === 0
    ) {
      return undefined;
    }
    const base = interactionBaseCamera(this.#root);
    const t = base.target;
    const rx = base.position[0] - t[0];
    const ry = base.position[1] - t[1];
    const rz = base.position[2] - t[2];
    const radius = Math.max(Math.hypot(rx, ry, rz), 1e-6);
    let az = Math.atan2(rx, rz) + this.#orbitAz;
    let el = clamp(Math.asin(clamp(ry / radius, -1, 1)) + this.#orbitEl, -ELEV_MAX, ELEV_MAX);
    const d = radius * this.#zoom;
    let position: [number, number, number] = [
      t[0] + d * Math.cos(el) * Math.sin(az),
      t[1] + d * Math.sin(el),
      t[2] + d * Math.cos(el) * Math.cos(az),
    ];
    let target: [number, number, number] = [...t];
    if (this.#panX !== 0 || this.#panY !== 0) {
      const basis = viewBasis({ ...base, position });
      if (basis) {
        // Drag semantics: the scene follows the arrow keys.
        const off: [number, number, number] = [
          -(basis.x[0]! * this.#panX) - basis.y[0]! * this.#panY,
          -(basis.x[1]! * this.#panX) - basis.y[1]! * this.#panY,
          -(basis.x[2]! * this.#panX) - basis.y[2]! * this.#panY,
        ];
        position = [position[0] + off[0], position[1] + off[1], position[2] + off[2]];
        target = [target[0] + off[0], target[1] + off[1], target[2] + off[2]];
      }
    }
    return { ...base, position, target };
  }

  #reset(): void {
    this.#orbitAz = 0;
    this.#orbitEl = 0;
    this.#zoom = 1;
    this.#panX = 0;
    this.#panY = 0;
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (!this.controls || !this.#root) return;
    const shift = event.shiftKey;
    let handled = true;
    switch (event.key) {
      case "ArrowLeft":
        if (shift) this.#panX += PAN_STEP;
        else this.#orbitAz -= ORBIT_STEP;
        break;
      case "ArrowRight":
        if (shift) this.#panX -= PAN_STEP;
        else this.#orbitAz += ORBIT_STEP;
        break;
      case "ArrowUp":
        if (shift) this.#panY -= PAN_STEP;
        else this.#orbitEl -= ELEV_STEP;
        break;
      case "ArrowDown":
        if (shift) this.#panY += PAN_STEP;
        else this.#orbitEl += ELEV_STEP;
        break;
      case "+":
      case "=":
        this.#zoom = clamp(this.#zoom * ZOOM_IN, 0.05, 100);
        break;
      case "-":
      case "_":
        this.#zoom = clamp(this.#zoom * ZOOM_OUT, 0.05, 100);
        break;
      case "r":
      case "R":
        this.#reset();
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      this.#renderDoc();
    }
  };
}

customElements.define("svg3d-viewer", Svg3dViewer);

declare global {
  interface HTMLElementTagNameMap {
    "svg3d-viewer": Svg3dViewer;
  }
}
