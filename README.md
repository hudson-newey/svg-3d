# svg-3d

Work toward a **3D extension of the SVG specification**: a third coordinate
axis (`z`) for SVG geometry, fully backwards compatible with
[SVG 2](https://www.w3.org/TR/SVG2/).

## Status

Pre-specification. See [`docs/plan.md`](docs/plan.md) for the
specification-writing plan, including:

- which SVG 2 rules govern backwards compatibility (path-data error handling,
  unknown attribute/element handling, `points` grammar),
- the element inventory: what gets a `z` attribute directly, what needs a new
  element (`path3d`) or parallel attribute (`zs`), and what is already 3D
  (CSS Transforms, filter lighting),
- the chapter outline, open questions, and milestones for writing the spec.

## Reference viewer

`<svg3d-viewer>` is a Lit web component that implements the spec's
project-early pipeline (§3.1): it reads SVG 3D markup, projects the geometry
through the active `<camera>`, and paints the result with the browser's
unmodified SVG 2 renderer.

```html
<script type="module" src="./src/index.ts"></script>
<svg3d-viewer
  style="width: 480px; height: 360px"
  .markup='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
    <camera projection="perspective" fov="50" position="220 180 280" target="50 50 50"/>
    <line x1="0" y1="0" z1="0" x2="100" y2="100" z2="100"/>
  </svg>'
>
</svg3d-viewer>
```

### Use from a CDN (jsDelivr)

The Vite build emits a self-contained ES module at `dist/svg-3d-viewer.js`
(with `lit` kept external). The import map below points the two `lit`
specifiers that the bundle imports at jsDelivr's ESM mirror, after which the
component can be loaded straight from the CDN — here, a basic rotating box:

```html
<script type="importmap">
  {
    "imports": {
      "lit": "https://cdn.jsdelivr.net/npm/lit@3/+esm",
      "lit/decorators.js": "https://cdn.jsdelivr.net/npm/lit@3/decorators.js/+esm"
    }
  }
</script>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/@hudson-newey/svg-3d-viewer@0.1.0/dist/svg-3d-viewer.js";

  const viewer = document.getElementById("box");
  const C = [-40, 40];
  const corners = C.flatMap((x) => C.flatMap((y) => C.map((z) => [x, y, z])));
  const edges = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7], // z edges
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7], // y edges
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7], // x edges
  ];

  let angle = 0;
  const frame = () => {
    angle = (angle + 1.2) % 360;
    const lines = edges
      .map(([a, b]) => {
        const A = corners[a],
          B = corners[b];
        return `<line x1="${A[0]}" y1="${A[1]}" z1="${A[2]}" x2="${B[0]}" y2="${B[1]}" z2="${B[2]}"/>`;
      })
      .join("");
    viewer.markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
      <g transform="rotateX(${angle}) rotateY(${angle * 0.7})">
        <rect x="-40" y="-40" width="80" height="80" z="-40" fill="#3182ce" fill-opacity="0.45" stroke="#93c5fd"/>
        <rect x="-40" y="-40" width="80" height="80" z="40" fill="#f6ad55" fill-opacity="0.45" stroke="#fbd38d"/>
        <g stroke="#cbd5e1" stroke-width="1.2">${lines}</g>
      </g>
    </svg>`;
    requestAnimationFrame(frame);
  };
  frame();
</script>

<svg3d-viewer id="box" style="display:block;width:480px;height:360px"></svg3d-viewer>
```

Notes:

- `@0.1.0` pins the version; use `@latest` (or a range) once the package is
  published to npm — jsDelivr only serves published packages.
- Alternatively, load
  `https://cdn.jsdelivr.net/npm/@hudson-newey/svg-3d-viewer@0.1.0/dist/svg-3d-viewer.js/+esm`
  with no import map at all: jsDelivr's `+esm` transform rewrites the `lit`
  imports for you.
- The rotation is driven by rewriting `markup` each frame; per spec §10 the
  viewer itself renders static snapshots and animation is SMIL-only.

Toolchain (Vite):

- `pnpm dev` — Vite dev server with a demo page (`index.html`) showing the
  component against real SVG 3D documents.
- `pnpm build` — Vite library build → `dist/svg-3d-viewer.js` (single ES
  module, `lit` externalized; see `exports` in `package.json`).
- `pnpm typecheck` — strict TypeScript check.
- `pnpm storybook` — Storybook (itself on the Vite integration) with
  interactive examples: shapes, `path3d` grammar, camera flythroughs, spec
  examples.
- `pnpm test` — Node smoke tests of the projection and path grammars.

### Providing the SVG source

Three channels, in priority order (`markup` > `src` > slot):

```html
<!-- Declarative: real SVG children in the default slot (static documents) -->
<svg3d-viewer style="width: 480px; height: 360px">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
    <line x1="0" y1="0" z1="0" x2="100" y2="100" z2="100" />
  </svg>
</svg3d-viewer>

<!-- Dynamic: markup property — rewrite it every frame (how the game story works) -->
<svg3d-viewer .markup="${svgString}"></svg3d-viewer>

<!-- Remote: fetch from a URL -->
<svg3d-viewer src="https://example.com/scene.svg"></svg3d-viewer>
```

Slot children are serialized automatically (a real `<svg>` child is taken with
`XMLSerializer`; text-only slot content is parsed as raw source). Slot content
is intended for static documents — per-frame updates should use `markup`.

Interactive controls: add the `controls` attribute to a viewer and it becomes
focusable (click or Tab), with keyboard camera control — **←/→** orbit,
**↑/↓** elevation, **+/−** dolly, **Shift+arrows** pan, **R** reset.

## Repository layout

- `docs/plan.md` — the specification-writing plan (compatibility rules,
  inventory, open questions)
- `specs/svg-3d-level-1.md` — the SVG 3D Level 1 draft specification
- `.spec-cache/` — local cached copies of the W3C SVG 2 chapters used as
  reference material (not committed)
