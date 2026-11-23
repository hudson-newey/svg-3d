import { LitElement, css, html, nothing } from "lit";
import { property } from "lit/decorators.js";
import { renderSvg3d } from "./lib/render.ts";

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
 */
export class Svg3dViewer extends LitElement {
  /** Inline SVG 3D markup to render. */
  @property() markup = "";
  /** URL to fetch SVG 3D markup from (sets `markup`). */
  @property() src = "";

  @property({ state: true }) private error = "";

  static styles = css`
    :host {
      display: block;
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
  `;

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("src") && this.src) void this.#load(this.src);
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("markup") || changed.has("src")) this.#project();
  }

  protected render() {
    return html`
      <div class="frame" part="frame"></div>
      ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
    `;
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
    try {
      frame.replaceChildren(renderSvg3d(root, (m) => console.warn(`[svg3d-viewer] ${m}`)));
    } catch (err) {
      this.error = String(err);
    }
  }
}

customElements.define("svg3d-viewer", Svg3dViewer);

declare global {
  interface HTMLElementTagNameMap {
    "svg3d-viewer": Svg3dViewer;
  }
}
