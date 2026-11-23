# SVG 3D Extension — Specification-Writing Plan

Status: draft plan (pre-specification)
Target: extend SVG with 3D point coordinates (`z`) while remaining **fully backwards
compatible** with SVG 2 as published at <https://www.w3.org/TR/SVG2/>.
This document is the working plan for writing that specification. Each section
identifies (a) what the spec will say, (b) which SVG 2 rules constrain it, and
(c) open decisions to resolve during drafting.

---

## 1. Goals and non-goals

**Goals**

1. A third coordinate axis (`z`) on SVG geometry, defined so that every document
   that is valid SVG 2 remains valid and renders identically under the new spec.
2. Graceful degradation: an SVG 2 renderer that ignores every 3D feature must
   still produce the correct 2D projection (the flat, `z = 0` interpretation).
3. Reuse, not reinvent: CSS Transforms already defines 3D transforms, and SVG's
   filter lighting primitives already define `z` attributes. The spec builds on
   both.

**Non-goals**

- Full 3D scene-graph features (depth testing, occlusion, lighting models for
  fills) beyond what projection needs. These can be future modules.
- Supporting renderers that violate SVG 2's own error-handling rules. Where the
  plan says "per the spec", non-compliant parsers are out of scope by design.
- DOM/IDL bindings: this module defines **no new DOM interfaces**. The 3D
  vocabulary is declarative and complete without IDL; scripting surfaces are
  deferred to a future module.

---

## 2. Ground rules taken from SVG 2 (normative constraints on our design)

These passages decide every compatibility question below. Cite them in the spec.

| # | SVG 2 rule | Consequence for the 3D extension |
|---|------------|----------------------------------|
| G1 | §5.10 *Foreign namespaces and private data*: "The SVG user agent must include unknown attributes in the DOM but should otherwise ignore unknown attributes." | **New attributes are a safe extension channel.** A 2D renderer ignores `z`, `z1`, `cz`, … and renders the flat shape. |
| G2 | §5.10: unknown (foreign-namespaced) elements are "included in the DOM but … ignore[d] and exclude[d] … for rendering purposes." | **New elements are a safe extension channel with silent fallback**: a 2D renderer drops them entirely (no partial rendering). |
| G3 | §9.5.4 *Error handling in path data*: the user agent "shall render a 'path' element up to (but not including) the path command containing the first error"; a command with a wrong parameter count "is rendered up to and including the last correctly defined path segment". The spec's own example is `M 10,10 L 20,20,30`. | **Path data must never be extended in place.** See §4.1. |
| G4 | §9.3.1 (moveto): "If a moveto is followed by multiple pairs of coordinates, the subsequent pairs are treated as implicit lineto commands." | A third coordinate after `M x y` is *not ignored*: with an odd trailing number it is a parse error (G3 truncates); with an even count it is silently consumed as implicit lineto geometry. |
| G5 | §10.3/§10.4 (`polyline`/`polygon` `points`, grammar `[ <number>+ ]#`): "If an odd number of coordinates is provided, then the element is in error … the user agent will drop the last, odd coordinate and otherwise render the shape." | **`points` must never carry interleaved `z` values.** `x y z x y z` reparses as pairs `(x,y),(z,x),(y,z)` — corrupted geometry with no error. |
| G6 | SVG 2 defines `transform` as the CSS `transform` property (4×4 homogeneous matrices per CSS Transforms, referenced from the SVG 2 coordinate-systems chapter). | **3D transform functions (`translate3d`, `rotate3d`, `matrix3d`, `perspective`, …) are already valid** on `transform`, `gradientTransform`, `patternTransform` for any SVG 2-compliant renderer. No new transform grammar is needed. Transforms are used for **geometry placement only** — the camera is a separate viewport concept (§4.2.3), never expressed with `transform`. |
| G7 | Precedent: `fePointLight` and `feSpotLight` (Filter Effects 1) already define `x`, `y`, `z`, `pointsAtX/Y/Z`; `feDistantLight` defines an `azimuth`/`elevation` direction in 3D. | There is in-spec precedent for adding `z` as a plain attribute. Follow the same pattern and cite it. |
| G8 | SVG 2 geometry attributes on shapes (`x`, `y`, `cx`, `cy`, …) are **geometry properties** (CSS properties with presentation-attribute syntax). | New `z`-attributes should be geometry properties too: initial value `0`, invalid values fall back to the initial value rather than disabling rendering. |

### 2.1 Answering the motivating question directly

*"If I put a third coordinate in `path`'s `d`, would renderers simply ignore it?"*

**No — and a compliant renderer behaves worse than ignoring it.** Per G3/G4:

- `d="M 10,10,30"` → the trailing `30` starts an *implicit lineto* that is missing
  its second coordinate → error → the path renders only the moveto, i.e. the
  geometry silently disappears (or truncates there, for implementations that
  render up to the error).
- `d="M 1,2,3,4"` → parses cleanly as `M 1,2 L 3,4` — the "z" values are
  reinterpreted as 2D geometry.

Same for `points="1,2,3"` (G5): error, last coordinate dropped; and
`points="1,2,3,4,5,6"` silently becomes three *wrong* 2D vertices.

**Therefore `z` values must travel in channels that the SVG 2 grammar ignores by
specification: new attributes (G1) and new elements (G2). New path-data command
letters are *not* such a channel** — an unknown command letter is an error under
G3, so a compliant 2D renderer truncates the path at that command (partial,
misleading rendering). That rules out smuggling 3D into `d` even with new
letters.

---

## 3. Extension taxonomy

Every 3D feature falls into one of three mechanisms. The spec will state which
mechanism each element uses, and the degradation column is normative.

| Mechanism | How a 2D SVG 2 renderer behaves | Use for |
|-----------|--------------------------------|---------|
| **M-A: new attribute** on an existing element | Renders the existing 2D shape (`z` ignored, G1) | Elements whose 2D grammar lives in *attributes*, not *values* |
| **M-B: new element** | Renders nothing (G2); optional flat fallback via `switch`/`requiredExtensions` | Elements whose geometry lives in *value grammars* that cannot be split (`path`), and the viewport `camera` |
| **M-C: already-3D channel** (CSS Transforms / filter lighting) | Renders the 2D projection it already implements | `transform`, gradient/pattern transforms, lighting filters |

Fallback elements that *do* render flat in 2D (M-A) are preferred over elements
that render nothing (M-B) wherever the geometry allows it, because M-A
degradation is strictly better for authors.

---

## 4. Element-by-element inventory

### 4.1 Category A — add `z` attributes directly (mechanism M-A)

The 2D grammar of these elements is entirely attribute-based; unknown
attributes are ignored (G1), so 2D renderers keep rendering the flat shape.
All new attributes become geometry properties (G8) with initial value `0`.

| Element | Existing | Add | Notes |
|---------|----------|-----|-------|
| `line` | `x1 y1 x2 y2` | `z1`, `z2` | The motivating case. 3D segment from `(x1,y1,z1)` to `(x2,y2,z2)`. |
| `circle` | `cx cy r` | `cz` | Circle lies in the plane `z = cz`. Radius stays in-plane. |
| `ellipse` | `cx cy rx ry` | `cz` | Same plane model as `circle`. |
| `rect` | `x y width height rx ry` | `z` | Plane `z = z`. Volumetric box: open question OQ-4. |
| `image` | `x y width height` | `z` | Plane placement. |
| `foreignObject` | `x y width height` | `z` | Plane placement. |
| `use` | `x y width height` | `z` | Translation includes z (like `x`/`y` today). |
| `text`, `tspan` | `x y dx dy` (lists) | `z`, `dz` (lists) | Mirrors the existing `x,y` + delta-list pattern exactly. Per-glyph `z` lists align 1:1 with `x`/`y` lists. |
| `linearGradient` | `x1 y1 x2 y2` | `z1`, `z2` | Identical shape to `line`. |
| `radialGradient` | `cx cy r fx fy fr` | `cz`, `fz` | Naming follows the `cx`→`cz` / focal-point convention. |
| `feOffset` | `dx dy` | `dz` | Only raster-primitive that is a pure translation. |
| lighting filters | — | (already 3D, G7) | No change; cite as precedent. |

Naming conventions (to be frozen as normative rules in the spec):

- Position/plane: `z` (mirrors `x`, `y`)
- Endpoints: `z1`, `z2` (mirrors `x1,y1,x2,y2`)
- Centers/focal points: `cz`, `fz` (mirrors `cx,cy`, `fx,fy`)
- Deltas: `dz` (mirrors `dx`, `dy`)

### 4.2 Category B — value grammars that cannot be extended in place

#### 4.2.1 `path` / `d`  → new `path3d` element (mechanism M-B)

`d` is a single string grammar; G3/G4 make every in-place option invalid:

- Interleaved triples: rejected (silently corrupted or truncated, §2.1).
- New command letters: unknown commands are path-data errors; compliant 2D
  renderers truncate the path at the first one — partial rendering is worse
  than no rendering. Rejected.

**Solution: a new `path3d` element** with its own `d`-style grammar, so a 2D
renderer's behavior is spec-defined silence (G2) instead of misparse.

Grammar decision for the spec (OQ-1):

- *Option 1 — same commands, triples.* `M x y z`, `L x y z`, `C x1 y1 z1 … x3 y3 z3`, …
  Reuses the mental model and code paths; every point carries `z`.
- *Option 2 — mixed 2D/3D commands.* Keep existing 2D commands valid inside
  `path3d` (missing `z` = `0`) and add nothing; `path3d` then differs from `path`
  only by being parsed as 3D. Simplest migration: an author can copy any `d`
  attribute into `path3d` unchanged.
- *Option 3 — z-per-command suffix.* New commands that take a trailing `z`.
  More compact, but a third grammar variant to document and test.

Recommendation: Option 2 as the baseline (full SVG 2 `svg-path` grammar is
valid inside `path3d`, coordinates are interpreted in 3D with `z = 0` default),
with Option 1's triples added as the 3D command set. Decide with real-world
data from CAD/3D tooling during drafting.

Backwards compatibility of the element itself: 2D renderers render nothing
(G2). The spec defines a fallback idiom so authors get flat rendering in 2D
contexts (see §5).

#### 4.2.2 `polygon` / `polyline` / `points`  → parallel z-list attribute (mechanism M-A)

G5 forbids interleaving. Two viable designs (OQ-2):

- *Option 1 — parallel attribute (recommended).* Keep `points` exactly as SVG 2
  defines it; add `zs="<number-list>"` (name TBD, see OQ-3) whose *i*-th number
  is the `z` of the *i*-th parsed vertex. Degradation is ideal: a 2D renderer
  ignores `zs` and still draws the flat polygon (M-A). Count mismatch →
  missing values default to `0`.
- *Option 2 — new `polygon3d`/`polyline3d` elements.* Cleaner 3D story, but
  degradation is "renders nothing" (M-B) — worse than Option 1 for no
  functional gain, since `points`' grammar is separable.

Recommendation: Option 1. Reserve `polygon3d`/`polyline3d` as *aliases* only if
drafting reveals alignment problems.

#### 4.2.3 Camera & viewport — new `camera` element (mechanism M-B); `viewBox` unchanged

`viewBox` keeps its exact SVG 2 meaning: it describes the 2D projection *plane*
— the film onto which 3D geometry is projected — and `preserveAspectRatio`
continues to control the projected-image-to-viewport mapping.

The camera itself is **not** expressed with `transform`. G6 makes `transform` a
per-element geometry operation; using it as a camera would (a) make the
projection depend on per-element state, (b) be invisible to a 2D renderer that
flattens z anyway, and (c) conflate two independent concerns. Instead, the
**viewport gains a 3D camera** as new vocabulary on the element that
establishes the viewport (`svg`):

```xml
<svg viewBox="0 0 100 100">
  <camera projection="perspective" fov="60"
          position="50 40 200" target="50 40 0" up="0 1 0"
          near="1" far="1000"/>
  <!-- 3D content -->
</svg>
```

Design points for the spec (OQ-5):

- The **active camera** of a viewport is its first `camera` child element. A
  `camera` presentation property on `svg` (`camera="url(#cam)"`) is the reuse
  hook for cameras defined in `defs` and shared across viewports.
- Attribute set (baseline): `projection` (`orthographic | perspective`),
  `position`, `target`, `up`, `fov`, `near`, `far`, plus orthographic extents.
  The camera "behaves like a 3D viewport": the `viewBox` is mapped onto the
  camera's film/projection plane, so all existing viewport sizing and
  `preserveAspectRatio` logic is reused unchanged.
- **Default camera (compat guarantee):** a viewport with no `camera` uses an
  orthographic camera looking along −z with exactly the mapping SVG 2 uses
  today. Every existing document renders pixel-identically, with or without a
  `camera` element present in a 2D renderer.
- Scoping: each `svg` element establishes a viewport and therefore a camera
  scope, exactly as nested viewports work in SVG 2 today.
- Rendering-pipeline ordering becomes: geometry transforms (including 3D CSS
  transform functions, M-C) → camera view transform → projection → `viewBox`
  mapping → SVG 2 paint model. The projection stage always operates on
  post-transform geometry.
- Degradation: `camera` is an unknown element to a 2D renderer (G2) — it is
  skipped and the default orthographic camera applies, which ignores `z` in
  projection and yields the flat rendering. Ideal M-B fallback: nothing to
  hide.

#### 4.2.4 Things deliberately left 2D in the first version

The spec must explicitly state what does *not* get `z` in v1, so scope stays
testable:

- `marker` orientation: `orient="auto"` is defined by the 2D tangent. 3D marker
  orientation needs a tangent frame definition (OQ-6) — defer or define
  `orient3d`.
- `textPath` on 3D paths, `animateMotion`/`mpath` over 3D paths: 3D arc-length
  parameterization is well-defined but rendering semantics are not — defer
  behind an open question.
- Filters other than lighting/`feOffset`: raster-space operations; keep 2D.
- Stroking/fill rules, painting: unchanged; operate on the projected outline.

### 4.3 Category C — already 3D, no grammar work (mechanism M-C)

- `transform`, `gradientTransform`, `patternTransform`: 3D functions are
  already valid CSS `transform` values (G6). The spec adds only *rendering
  semantics* (how a 4×4-transformed plane projects) and conformance wording.
- `fePointLight`, `feSpotLight`, `feDistantLight`: already carry `z` (G7).

---

## 5. Degradation & fallback specification

A dedicated normative chapter will define what a 2D-only renderer does with
each mechanism, and the author-facing fallback idioms:

1. **M-A attributes**: render as SVG 2 (attribute ignored, G1). No author
   action required.
2. **M-B elements** (`path3d`): render nothing. Define the fallback idiom:

   ```xml
   <svg xmlns="http://www.w3.org/2000/svg">
     <switch>
       <!-- 3D-capable renderer -->
       <path3d d="…" requiredExtensions="http://svg.example/svg3d/1.0"/>
       <!-- 2D fallback -->
       <path d="…"/>
     </switch>
   </svg>
   ```

   The spec must register the extension URI, define `requiredExtensions`
   evaluation for SVG-3D support, and state that `switch` child selection is
   unaffected by unknown-element handling (G2).
3. **Camera**: a `camera` element is unknown to a 2D renderer (G2) and is
   skipped; the viewport then uses the default orthographic camera (§4.2.3),
   which reproduces SVG 2's flat rendering exactly. No author action required.

---

## 6. Error handling to be specified

Mirror SVG 2's error philosophy (render-what-you-can, deterministic fallback):

| Situation | Spec behavior |
|-----------|---------------|
| Invalid `z`/`cz`/`z1`/… attribute value | Geometry property rules (G8): fall back to initial value `0`; element still renders |
| `zs`-list length ≠ vertex count | Missing `z` → `0`; extra values ignored |
| `path3d` data errors | Same model as SVG 2 §9.5.4: render up to the last well-defined segment, with 3D coordinates |
| `path3d` unsupported by renderer | G2: not rendered; §5 fallback applies |
| Invalid `camera` attribute value | Ignore the invalid value; use that attribute's initial value; degenerate camera geometry (e.g. zero-length `up`, `position` = `target`) → use the default camera |
| Zero-width/zero-height + `z` interactions | Reuse SVG 2 rules unchanged (they are z-independent) |

---

## 7. Specification document outline (the writing plan)

The spec will be authored as a standalone module ("SVG 3D Level 1") that
patches SVG 2 by reference, following the structure conventions of W3C SVG
modules.

| # | Chapter | Content | Pulls from |
|---|---------|---------|-----------|
| 1 | Introduction | Goals, scope, non-goals (§1 above) | §1 |
| 2 | Conformance | SVG 2 dependency, 2D-conformance profile = SVG 2 + nothing; 3D-conformance profile | §2, §5 |
| 3 | Rendering model | 2D paint model unchanged; add projection stage; `camera` element, `camera` property, and default camera (orthographic, SVG 2-identical); painter's-algorithm z-ordering definition | §4.2.3, OQ-5 |
| 4 | Coordinate systems | 3D user space; relationship to CSS Transforms 4×4 matrices (G6); transform ordering; explicit rule that transforms never define the camera | §4.3 |
| 5 | Basic shapes | All Category A attribute tables (§4.1), each with: syntax, geometry-property status, 2D degradation, examples | §4.1 |
| 6 | `path3d` | New element + grammar (OQ-1 decision), error handling, fallback idiom | §4.2.1, §5 |
| 7 | Point-list shapes | `zs` parallel attribute (OQ-2/OQ-3), alignment rules, error handling | §4.2.2 |
| 8 | Paint servers | Gradient `z` attributes; gradient units in 3D | §4.1 |
| 9 | Text | `z`/`dz` lists; explicit deferrals (textPath 3D) | §4.1, §4.2.4 |
| 10 | Filters | Lighting = already 3D (G7); `feOffset.dz`; everything else stays 2D | §4.1, §4.2.4 |
| 11 | Fallback & extensibility | `switch`/`requiredExtensions` idiom; registered extension URI; unknown-element rules restated (incl. `camera` default-camera fallback) | §5 |
| 12 | Error handling | Table from §6 of this plan | §6 |
| 13 | Security/privacy & accessibility | Carry over SVG 2 boilerplate; assess 3D additions | — |
| A | Attribute/index appendices | Full attribute table, mapping each new attribute to the SVG 2 element/attribute it mirrors | §4 |
| B | Changes since SVG 2 | Standard changes appendix | — |

### 7.1 Drafting order

1. **Freeze decisions**: OQ-1 (path3d grammar), OQ-2/OQ-3 (parallel attribute
   name), naming conventions (§4.1), OQ-5 (camera element & default camera).
2. **Chapters 3–5** (rendering model + shapes): they unblock everything else.
3. **Chapters 6–7** (path3d, point lists): the grammatical core.
4. **Chapters 8–13**: parallelizable, mostly referential.
5. **Chapter 2 + Appendix A last** (they summarize the frozen result).

### 7.2 Open questions to resolve while drafting

- **OQ-1**: `path3d` grammar — mixed 2D/3D commands (recommended baseline) vs.
  triples-only vs. z-suffix commands.
- **OQ-2 / OQ-3**: parallel z-list for `polygon`/`polyline`: attribute name
  (`zs` vs `points-z` vs `points3d`), and whether to also allow it on `path3d`.
- **OQ-4**: does `rect` gain a `depth` attribute (extruded box) or does a box
  become a new element? Default: planar rect only; volume is future work.
- **OQ-5**: camera vocabulary details: full `<camera>` attribute set (baseline:
  `projection`, `position`, `target`, `up`, `fov`, `near`, `far`), orthographic
  extent model, active-camera selection rule (first `camera` child vs.
  `camera="url(#id)"` property — default: first child, property as reuse hook),
  camera scoping with nested `svg` viewports, and whether `fov` semantics
  reference CSS `perspective`. Default: orthographic baseline reproducing SVG 2
  exactly; perspective as defined extension.
- **OQ-6**: 3D marker orientation (`orient="auto"` semantics on 3D tangents).
- **OQ-7**: `circle`/`ellipse` on an oblique plane (tilted by transform) —
  confirm ellipse outline math under 4×4 transform + projection.
- **OQ-8**: versioning signal: is a namespace bump (SVG 3) needed, or is the
  attribute/element extension sufficient? Default: no namespace bump; SVG 2
  extension mechanism only.

### 7.3 Validation & testing plan

- **Compat tests (must all pass on an SVG 2 renderer)**: every Category A
  example renders identically with and without the `z` attributes present;
  `path3d` documents render without partial-geometry artifacts; documents with
  a `camera` element render identically to the same document without it (G2 →
  default orthographic camera); §2.1 misuse
  cases (`d="M 1,2,3"`, `points` with triples) documented as *invalid* with the
  spec-cited 2D outcome.
- **3D tests**: reference renderer prototype (projection + painter's algorithm)
  with golden images per chapter example.
- **Parser tests**: grammar tests for `path3d` and `zs`, error-truncation tests
  mirroring SVG 2 §9.5.4 examples.
- **Interop check**: run the SVG 2 test suite subset against the prototype to
  prove no regressions (the spec's core promise).

### 7.4 Milestones

| Milestone | Exit criteria |
|-----------|---------------|
| M1 — Plan approved | This document accepted; naming conventions frozen |
| M2 — Decisions frozen | OQ-1, OQ-2/3, OQ-5 resolved and recorded |
| M3 — Core draft | Chapters 3–7 complete with examples |
| M4 — Full draft | All chapters + appendices complete |
| M5 — Test suite | Compat + 3D test suites passing on reference renderer |
| M6 — First public draft | Spec + tests published together |
