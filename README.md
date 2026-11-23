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

## Repository layout

- `docs/plan.md` — the specification-writing plan (compatibility rules,
  inventory, open questions)
- `specs/svg-3d-level-1.md` — the SVG 3D Level 1 draft specification
- `.spec-cache/` — local cached copies of the W3C SVG 2 chapters used as
  reference material (not committed)
