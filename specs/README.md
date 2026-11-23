# specs/

Specification drafts for the SVG 3D extension.

- [`svg-3d-level-1.md`](svg-3d-level-1.md) — **SVG 3D Level 1** (draft):
  the full specification. Adds `z` geometry attributes, the `path3d`
  element, the `zs` parallel attribute, and the viewport `camera`.

## Reading order

1. [`docs/plan.md`](../docs/plan.md) — why the extension is shaped this way
   (SVG 2 compatibility rules, inventory, open questions).
2. `svg-3d-level-1.md` — the normative draft itself.

## Decisions frozen while drafting (see Appendix B of the spec)

- **`path3d` grammar is triples-only.** The plan's proposed "mixed 2D/3D
  commands" baseline is grammatically ambiguous (`M 1 2 3 4 5 6` could parse
  as one 3D moveto + implicit lineto _or_ three 2D points), so the spec
  requires a `z` on every point-carrying command. `H`, `V`, `Z` are unchanged.
- **`zs`** is the frozen name of the parallel vertex-depth list for
  `polyline`/`polygon`.
- **`camera`** is an element (plus a `camera` attribute on `svg` for reuse);
  `viewBox` is the film plane; the default orthographic camera is the
  identity, which guarantees SVG 2-identical rendering.
- **Project-early principle**: projection happens before the SVG 2 paint
  stage, so markers, text-on-path, stroking, and gradient positioning all act
  on projected 2D geometry and no SVG 2 rule downstream is redefined.
- **Animation is SMIL-only** (spec §10): all existing SMIL machinery applies
  unchanged; `animateTransform` gains 3D types; `path3d` `d` interpolates
  under the identical-command-structure rule; `animateMotion` over 3D
  geometry translates in 3D; camera attributes animate. CSS animations and
  transitions are out of scope.

## Status

Draft. All planning-phase open issues are resolved and frozen in the spec
(Appendix B, decision D-9). No CSS integration: `camera` on `svg` is a plain
XML attribute, and the fallback extension identifier is `urn:svg3d:1.0`.
