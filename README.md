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
<svg3d-viewer style="width: 480px; height: 360px">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
    <camera projection="perspective" fov="50" position="220 180 280" target="50 50 50" />
    <line x1="0" y1="0" z1="0" x2="100" y2="100" z2="100" />
  </svg>
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
</script>

<svg3d-viewer style="display:block;width:480px;height:360px">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
    <!-- The whole cube rotates: SMIL animateTransform passes through the
         projection and animates the mirrored output group. -->
    <g>
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0"
        to="360"
        dur="14s"
        repeatCount="indefinite"
      />
      <rect
        x="-40"
        y="-40"
        width="80"
        height="80"
        z="-40"
        fill="#3182ce"
        fill-opacity="0.45"
        stroke="#93c5fd"
      >
        <animate
          attributeName="fill-opacity"
          values="0.2;0.6;0.2"
          dur="3s"
          repeatCount="indefinite"
        />
      </rect>
      <rect
        x="-40"
        y="-40"
        width="80"
        height="80"
        z="40"
        fill="#f6ad55"
        fill-opacity="0.45"
        stroke="#fbd38d"
      >
        <animate
          attributeName="fill-opacity"
          values="0.6;0.2;0.6"
          dur="3s"
          repeatCount="indefinite"
        />
      </rect>
      <g stroke="#cbd5e1" stroke-width="1.2">
        <line x1="-40" y1="-40" z1="-40" x2="40" y2="-40" z2="-40" />
        <line x1="40" y1="-40" z1="-40" x2="40" y2="40" z2="-40" />
        <line x1="40" y1="40" z1="-40" x2="-40" y2="40" z2="-40" />
        <line x1="-40" y1="40" z1="-40" x2="-40" y2="-40" z2="-40" />
        <line x1="-40" y1="-40" z1="40" x2="40" y2="-40" z2="40" />
        <line x1="40" y1="-40" z1="40" x2="40" y2="40" z2="40" />
        <line x1="40" y1="40" z1="40" x2="-40" y2="40" z2="40" />
        <line x1="-40" y1="40" z1="40" x2="-40" y2="-40" z2="40" />
        <line x1="-40" y1="-40" z1="-40" x2="-40" y2="-40" z2="40" />
        <line x1="40" y1="-40" z1="-40" x2="40" y2="-40" z2="40" />
        <line x1="40" y1="40" z1="-40" x2="40" y2="40" z2="40" />
        <line x1="-40" y1="40" z1="-40" x2="-40" y2="40" z2="40" />
      </g>
      <circle cx="0" cy="0" r="5" cz="0" fill="#e53e3e" />
    </g>
  </svg>
</svg3d-viewer>
```

Notes:

- **No JavaScript drives the animation.** The cube is authored declaratively
  in the default slot; SMIL `<animateTransform>` (the spin) and `<animate>`
  (the pulsing face glow) are carried through the projection onto the output
  elements, so the browser's own SVG animation engine runs them.
- Passthrough applies **child-targeted** animations (no `href`) on groups and
  shapes, and only for effects that are expressible after projection:
  transforms (rotation about the view axis — exact under the default camera)
  and paint/opacity attributes. Geometry and `<camera>` attribute values are
  baked at projection time and do not animate.
- `@0.1.0` pins the version; use `@latest` (or a range) once the package is
  published to npm — jsDelivr only serves published packages.
- Alternatively, load
  `https://cdn.jsdelivr.net/npm/@hudson-newey/svg-3d-viewer@0.1.0/dist/svg-3d-viewer.js/+esm`
  with no import map at all: jsDelivr's `+esm` transform rewrites the `lit`
  imports for you.
- For per-frame procedural scenes (like the game story), keep using the
  `markup` property — the slot is for static documents.

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
