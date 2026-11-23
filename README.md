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
<svg3d-viewer style="width: 480px; height: 360px"
  .markup='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 160 160">
    <camera projection="perspective" fov="50" position="220 180 280" target="50 50 50"/>
    <line x1="0" y1="0" z1="0" x2="100" y2="100" z2="100"/>
  </svg>'>
</svg3d-viewer>
```

Run `pnpm install && pnpm storybook` for interactive examples (shapes,
`path3d` grammar, camera flythroughs, spec examples). `pnpm test` runs the
Node smoke tests of the projection and path grammars.

## Repository layout

- `docs/plan.md` — the specification-writing plan (compatibility rules,
  inventory, open questions)
- `specs/svg-3d-level-1.md` — the SVG 3D Level 1 draft specification
- `.spec-cache/` — local cached copies of the W3C SVG 2 chapters used as
  reference material (not committed)
