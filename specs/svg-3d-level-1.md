# SVG 3D Level 1

**Draft community specification — not a W3C publication.**
This document extends [SVG 2](https://www.w3.org/TR/SVG2/) with a third
coordinate axis. It is written to be normatively self-sufficient where it adds
vocabulary and to patch SVG 2 by reference everywhere else.

| | |
|--|--|
| Version       | 1.0-draft |
| This version  | `specs/svg-3d-level-1.md` (repository draft) |
| Depends on    | SVG 2, CSS Transforms Module Level 1, Filter Effects Module Level 1 |
| Related plan  | [`docs/plan.md`](../docs/plan.md) |

## Abstract

SVG 3D Level 1 adds a `z` coordinate axis to SVG geometry. It introduces:

- new **geometry attributes** on existing elements (`z`, `z1`, `z2`, `cz`, `fz`, `dz`, `zs`);
- a new **`path3d`** graphics element whose path data carries 3D coordinate triples;
- a new **`camera`** element (and a `camera` attribute on `svg`) that gives the
  viewport a 3D camera with orthographic and perspective projection.

Every feature is designed so that a renderer implementing SVG 2 exactly — and
nothing else — renders an SVG 3D document as the correct flat (`z = 0`)
projection of itself. All normative requirements of SVG 2 that this document
does not explicitly modify remain in force.

## Status of this document

Work in progress; the vocabulary and the compatibility model are stable, the
open issues in Appendix C are not. Comments are tracked in the repository issue
tracker. This specification is an independent community draft and has no
standing in the W3C process.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Conformance](#2-conformance)
3. [Rendering model](#3-rendering-model)
4. [Coordinate systems and transforms](#4-coordinate-systems-and-transforms)
5. [Camera and viewport](#5-camera-and-viewport)
6. [Basic shapes and text: `z` geometry attributes](#6-basic-shapes-and-text-z-geometry-attributes)
7. [The `path3d` element](#7-the-path3d-element)
8. [Point-list shapes: the `zs` attribute](#8-point-list-shapes-the-zs-attribute)
9. [Paint servers](#9-paint-servers)
10. [Filters](#10-filters)
11. [Fallback and extensibility](#11-fallback-and-extensibility)
12. [Error handling](#12-error-handling)
13. [Security, privacy, and accessibility](#13-security-privacy-and-accessibility)
- [Appendix A: Attribute and element summary](#appendix-a-attribute-and-element-summary)
- [Appendix B: Changes since SVG 2, and decision log](#appendix-b-changes-since-svg-2-and-decision-log)
- [Appendix C: Open issues](#appendix-c-open-issues)

---

## 1. Introduction

### 1.1 Motivation

SVG 2 defines all geometry in two coordinates. This document adds a third
coordinate, `z`, to point-valued geometry, a path grammar that carries it, and
a viewport camera that projects 3D geometry onto the existing 2D rendering
pipeline.

### 1.2 Design rules

The extension is built on rules taken from SVG 2 itself. Each rule is cited
where it is applied; they are restated here for convenience.

- **R1 — Unknown attributes are ignored.** SVG 2 §5.10: "The SVG user agent
  must include unknown attributes in the DOM but should otherwise ignore
  unknown attributes." All new attributes in this specification are unknown
  attributes to an SVG 2 renderer.
- **R2 — Unknown elements are not rendered.** SVG 2 §5.10: unknown elements
  are "included in the DOM but … ignore[d] and exclude[d] … for rendering
  purposes." The `path3d` and `camera` elements are unknown elements to an
  SVG 2 renderer.
- **R3 — Existing value grammars are never extended in place.** SVG 2 defines
  deterministic, geometrical error handling for its value grammars: path data
  errors truncate rendering at the error ([SVG 2 §9.5.4](https://www.w3.org/TR/SVG2/paths.html#PathDataErrorHandling)),
  and an odd `points` count drops the last coordinate and renders the rest
  (SVG 2 §10.3/§10.4). Interleaving `z` values into `d` or `points` therefore
  produces silently corrupted or truncated geometry, not an ignored third
  value. This specification adds no new syntax to any SVG 2 value grammar.
- **R4 — CSS Transforms is already 3D.** SVG 2 defines `transform` as the CSS
  `transform` property; 3D transform functions are already valid there. This
  specification adds rendering semantics for them and nothing new to the
  grammar. `transform` is used for geometry placement only; the camera is
  defined in [§5](#5-camera-and-viewport) and is never expressed with
  `transform`.
- **R5 — Precedent.** Filter Effects 1 already defines `z` attributes
  (`fePointLight`, `feSpotLight`: `x`, `y`, `z`, `pointsAtX/Y/Z`). The `z`
  attributes here follow the same pattern.

### 1.3 Goals

1. Every document valid under SVG 2 is valid under this specification and
   renders identically.
2. A 2D renderer (an SVG 2 renderer that implements nothing from this
   document) renders an SVG 3D document as its correct flat projection, per
   the degradation rules in [§11](#11-fallback-and-extensibility).
3. The 2D paint model is reused unchanged after the projection stage.

### 1.4 Non-goals

- Depth testing, occlusion culling, or any hidden-surface removal. Painting
  order is document order, as in SVG 2 (see §3.4). These are future modules.
- Lighting or shading of fills. (Filter lighting primitives already exist and
  are unaffected.)
- New DOM/IDL bindings. The vocabulary here is declarative and complete;
  scripting surfaces are deferred to a future module.
- Supporting renderers that do not conform to SVG 2. Where this document says
  "per SVG 2", non-compliant parsers are out of scope by design.

### 1.5 Terminology

- **2D renderer**: a user agent conformant to SVG 2 that implements none of
  this specification.
- **3D renderer**: a user agent conformant to SVG 2 *and* to this
  specification's 3D conformance class (§2.2).
- **3D point**: a triple `(x, y, z)` of user units; `z` defaults to `0`
  everywhere in this specification.
- **Projected geometry**: the 2D geometry that results from applying the
  pipeline of §3.1 to 3D geometry.
- **Film plane**: the 2D rectangle, in the coordinate system of the `viewBox`,
  onto which 3D geometry is projected (§5.4).

---

## 2. Conformance

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be
interpreted as described in [RFC 2119].

### 2.1 Normative references

- [SVG2] **Scalable Vector Graphics (SVG) 2**, W3C Recommendation,
  <https://www.w3.org/TR/SVG2/>
- [CSS-TRANSFORMS-1] **CSS Transforms Module Level 1**,
  <https://www.w3.org/TR/css-transforms-1/> (including its 3D transform
  functions)
- [FILTER-EFFECTS-1] **Filter Effects Module Level 1**,
  <https://www.w3.org/TR/filter-effects-1/>
- [RFC2119] **Key words for use in RFCs**, <https://www.rfc-editor.org/rfc/rfc2119>

### 2.2 Conformance classes

- **SVG 3D 2D-conformant renderer**: conformant to [SVG2]; no further
  requirements. Such a renderer automatically satisfies every degradation
  requirement in this specification, because the degradation rules (§11) are
  exactly SVG 2's own rules for unknown attributes and unknown elements.
- **SVG 3D 3D-conformant renderer**: conformant to [SVG2] and to all
  normative requirements in §3–§10 of this specification.

**Authoring conformance**: a conformant SVG 3D document is a conformant SVG 2
document that additionally uses only the elements and attributes defined in
this specification, with the syntax defined here.

### 2.3 Namespaces

No new namespace is introduced. The `path3d` and `camera` elements are in the
SVG namespace, `http://www.w3.org/2000/svg`. (Decision log: Appendix B, D-6.)

---

## 3. Rendering model

### 3.1 Pipeline overview

A 3D renderer **MUST** process geometry in this order:

1. **Model stage.** The element's local 3D geometry (as defined in §6–§8) is
   transformed by the element's `transform`, then by ancestor transforms, as
   in SVG 2 — except that all transforms are 4×4 matrices per
   [CSS-TRANSFORMS-1], and 3D transform functions are fully applied.
2. **View stage.** The geometry is transformed by the active camera's view
   matrix (§5.4).
3. **Projection stage.** The geometry is projected onto the film plane
   (§5.4), producing 2D geometry in the `viewBox` coordinate system.
4. **Viewport mapping.** The `viewBox` maps to the viewport exactly as in
   SVG 2, including `preserveAspectRatio`.
5. **Paint stage.** The SVG 2 paint model runs on the projected 2D geometry,
   unmodified.

**The project-early principle (normative).** Everything at and after step 5 —
fill, stroke, stroke dashing, markers, text layout and text-on-path, gradient
positioning, clipping, masking, hit testing geometry — operates on the
**projected 2D geometry** and is governed by [SVG2] as if the projected
geometry had been authored directly. Consequences, all normative:

- Markers with `orient="auto"` orient to the tangent of the *projected*
  outline. No 3D marker orientation is defined in this version.
- `textPath` follows the *projected* outline of the referenced path.
- `stroke-width` is applied in projected space: strokes have constant width on
  screen and are not foreshortened. (Known limitation; Appendix C, C-1.)
- Gradient positioning follows §9.

A 2D renderer performs none of steps 2–3; it renders geometry as authored,
which is by construction the `z = 0` projection under the default camera
(§5.5).

### 3.2 Projection semantics for shapes

Basic shapes and `path3d` define 3D geometry. A 3D renderer **MUST** render
the exact projection of that geometry. For a planar shape (all shapes in §6,
and `path3d` subpaths whose points are coplanar), the projected outline is a
conic section; when that conic is an ellipse, the outline is the full ellipse;
otherwise the outline is the projected conic within the visible depth range
(§5.6). A renderer **MAY** approximate the outline by flattening, provided the
rendered outline does not deviate from the exact projection by more than one
device pixel.

Informative note: with the default camera (§5.5) or any orthographic camera,
projections of axis-aligned shapes remain exact circles, ellipses, rectangles,
and lines; the conic machinery only matters under perspective or oblique
transforms.

### 3.3 Degenerate projections

A projection may degenerate (zero area, or a line seen edge-on). The SVG 2
rendering rules for the degenerate 2D geometry apply unchanged: e.g. a
zero-area projected shape is filled per SVG 2's fill rules for zero-area
shapes, and stroked per its zero-length/zero-area stroke rules.

### 3.4 Painting order

Painting order is **document order**, exactly as in SVG 2. The `z` coordinate
**MUST NOT** affect painting order in this version. Overlapping geometry is
resolved by document order (author-controlled), not by depth. Hidden-surface
removal is excluded by §1.4.

---

## 4. Coordinate systems and transforms

### 4.1 3D user space

The user coordinate system in effect for an element is extended from a 2D
coordinate system to a 3D one: a right-handed coordinate system where `x`
points right, `y` points down (as in SVG 2), and `z` points **toward the
viewer** (out of the screen) at the default camera. Positive `z` is closer to
the viewer; a point with larger `z` is in front of a point with smaller `z`.

All coordinates and lengths in the attributes defined by this specification
are in user units in the current user coordinate system, as in SVG 2.

### 4.2 Transforms

The `transform`, `gradientTransform`, and `patternTransform` attributes have
the syntax and semantics defined by [CSS-TRANSFORMS-1] (as referenced by
[SVG2]), including the 3D transform functions `translate3d`, `scale3d`,
`rotate3d`, `rotateX`, `rotateY`, `rotateZ`, `matrix3d`, and `perspective`.

A `transform` **MUST NOT** be used to define the camera. It moves the
element's geometry; it never moves the viewer (§5).

### 4.3 Rotation direction

`rotateX`, `rotateY`, and `rotateZ` rotate geometry as defined by
[CSS-TRANSFORMS-1]. With `y` pointing down and `z` toward the viewer (§4.1),
`rotateZ` is clockwise on screen — identical to SVG 2's 2D `rotate`.

---

## 5. Camera and viewport

### 5.1 The `camera` element

- **Categories**: never-rendered element; structural element.
- **Contexts**: child of `svg`, child of `defs`, child of a nested `svg`.
- **Content model**: descriptive elements only (`title`, `desc`).
- **Attributes**: `projection`, `position`, `target`, `up`, `fov`, `near`,
  `far`; common attributes (`id`, and so on).

The `camera` element defines a camera for the viewport established by its
parent `svg` element (or for any `svg` that references it; §5.2). Each `svg`
element establishes its own camera scope, exactly as it establishes its own
viewport: nested viewports may declare their own `camera`.

Attribute definitions:

| Attribute | Value | Initial value | Animatable |
|-----------|-------|---------------|------------|
| `projection` | `orthographic \| perspective` | `orthographic` | yes |
| `position` | `<x> <y> <z>` (3 numbers) | `0 0 0` | yes |
| `target` | `<x> <y> <z>` (3 numbers) | `0 0 -1` | yes |
| `up` | `<x> <y> <z>` (3 numbers) | `0 1 0` | yes |
| `fov` | `<number>` (degrees, vertical field of view) | `45` | yes |
| `near` | `<number>` (distance in front of the camera) | `0` | yes |
| `far` | `<number>` (distance in front of the camera) | unbounded (no far clipping) | yes |

All attributes above are unknown attributes to a 2D renderer (R1). The
`camera` element itself is an unknown element to a 2D renderer (R2).

### 5.2 The `camera` attribute on `svg`

| Attribute | Value | Initial value | Animatable |
|-----------|-------|---------------|------------|
| `camera` (on `svg`) | `none \| <url>` | `none` | no |

The `camera` attribute selects the **active camera** of the viewport,
in this order of precedence:

1. If `camera` is a valid URL reference to a `camera` element (typically in
   `defs`), that camera is active.
2. Otherwise, if the `svg` has a `camera` child element, the **first** such
   child is active.
3. Otherwise, the default camera (§5.5) is active.

An unresolvable or invalid URL reference is an error at the `camera`
attribute; the resolution falls through to rule 2, then 3 (see §12).

### 5.3 Viewport relationship

The film plane is the `viewBox` rectangle: `min-x`, `min-y`, `width`, `height`
in the `svg`'s own coordinate system. Projection (§5.4) produces coordinates
in this rectangle; the SVG 2 `viewBox`-to-viewport mapping (including
`preserveAspectRatio`) then applies unchanged. The `viewBox` **MUST** remain
2D; this specification defines no 3D extension of it.

### 5.4 Projection mathematics

Let the active camera have position **p**, target **t**, up vector **u** (all
3D points/vectors in the `svg`'s user space, before any ancestor transform of
the `svg` element itself). Define the orthonormal view basis:

- `z_cam = normalize(p − t)` (points from target toward the camera)
- `x_cam = normalize(u × z_cam)`
- `y_cam = z_cam × x_cam`

A geometry point **q** (in the `svg`'s user space, after the model stage of
§3.1) has view-space coordinates:

```
qv = ( (q − p) · x_cam ,  (q − p) · y_cam ,  (q − p) · z_cam )
```

so that points in front of the camera have `zv < 0`, and let
`d = −zv` be the distance in front of the camera.

Let the film plane be the `viewBox` rectangle `(mx, my, w, h)` (§5.3), with
center `(cx, cy) = (mx + w/2, my + h/2)`.

**Orthographic projection.** The projected point is:

```
x_f = cx + xv
y_f = cy − yv
```

One user unit in view space is one user unit on the film plane; the `viewBox`
therefore also fixes the orthographic extents, and no additional scale
attributes are needed.

**Perspective projection.** With `fov` in degrees, the film distance is

```
D = (h / 2) / tan(fov / 2)
```

and the projected point is:

```
x_f = cx + xv · D / d
y_f = cy − yv · D / d
```

This is a pinhole camera whose film plane is the `viewBox` rectangle at
distance `D`; geometry at distance `D` in front of the camera is rendered at
its view-space size, and geometry farther away is proportionally smaller. The
`fov` semantics match CSS `perspective` with
`perspective = D` (in user units).

**Validity.** If the camera basis is degenerate — `p = t`, `u` parallel to
`z_cam`, or a zero-length `u` — the projection is undefined; per §12, the
default camera is used instead. If `d ≤ 0` for a point, that point is behind
the camera and is not rendered (§5.6).

### 5.5 The default camera

A viewport with no active camera per §5.2 **MUST** use the default camera:

- `projection: orthographic`, `position: 0 0 0`, `target: 0 0 -1`,
  `up: 0 1 0`, unbounded depth.

The view matrix of the default camera is the identity, and orthographic
projection with this camera maps `(x, y, z)` to `(x, y)` for every `z`.

**Backwards-compatibility guarantee (normative):** a 3D renderer with no
`camera` element or `camera` attribute in scope renders every SVG 2 document
exactly as an SVG 2 renderer does, and renders every SVG 3D document exactly
as the corresponding `z = 0` flat document.

### 5.6 Clipping

A point is **visible** if and only if `near ≤ d < far` (§5.1), where `d` is
the point's distance in front of the camera (§5.4). With the default values,
this means every point in front of the camera is visible.

A 3D renderer **MUST** clip geometry to the visible depth range: a segment or
curve crossing the `near` or `far` boundary is clipped as if by a clip path at
that boundary (the clip is performed on the 3D geometry before projection).
Geometry at or behind the camera plane is not rendered. A 2D renderer performs
no depth clipping.

---

## 6. Basic shapes and text: `z` geometry attributes

This section adds geometry attributes to existing elements. Each new attribute
is a **geometry property** in the sense of SVG 2 (a CSS property with a
presentation attribute), with initial value `0`, unitless user units, and
`Animatable: yes`. Invalid values fall back to the initial value (§12); the
element still renders.

A 2D renderer ignores all of these attributes (R1) and renders the element as
SVG 2 defines it — which is exactly the `z = 0` interpretation of this
section. This is the ideal degradation and requires no author action.

### 6.1 `line`

| Attribute | Meaning |
|-----------|---------|
| `z1` | `z` of the start point; the line runs from `(x1, y1, z1)` to `(x2, y2, z2)` |
| `z2` | `z` of the end point |

```xml
<line x1="10" y1="10" z1="0" x2="80" y2="60" z2="40"/>
```

The projected geometry is the projection of the 3D segment.

### 6.2 `rect`

| Attribute | Meaning |
|-----------|---------|
| `z` | The rect lies in the plane `z = z` |

The rect's geometry is the rectangle `(x, y)` to `(x + width, y + height)` in
the plane `z = z`, including rounded corners (`rx`/`ry`). Volumetric boxes are
not defined in this version (Appendix C, C-3).

### 6.3 `circle` and `ellipse`

| Attribute | Meaning |
|-----------|---------|
| `cz` | The shape lies in the plane `z = cz` |

The circle/ellipse geometry is the SVG 2 geometry translated to the plane
`z = cz`. The radius/radii remain in-plane lengths. Spheres are not defined in
this version.

### 6.4 `image` and `foreignObject`

| Attribute | Meaning |
|-----------|---------|
| `z` | The element's plane is `z = z` |

The element occupies the same rectangle as in SVG 2, at depth `z`. Rendering
of the raster/foreign content happens after projection (project-early
principle, §3.1): the content is mapped onto the projected rectangle.

### 6.5 `use`

| Attribute | Meaning |
|-----------|---------|
| `z` | The `use` translation includes `z` |

The `use` element's implied translate becomes `(x, y, z)`, applied before the
referenced content's own transforms. All other `use` semantics are unchanged.

### 6.6 `text` and `tspan`

| Attribute | Meaning |
|-----------|---------|
| `z` | List of per-character `z` positions, aligned exactly as the `x`/`y` lists |
| `dz` | List of per-character `z` deltas, aligned exactly as the `dx`/`dy` lists |

The `z` and `dz` lists follow, respectively, the exact alignment, repetition,
and delta-chaining rules that SVG 2 defines for the `x`/`y` and `dx`/`dy`
lists; each character's position is `(x, y, z)` after delta application.
Characters are laid out in 3D along the line, then projected per §3.1; glyphs
are rendered as the SVG 2 glyphs at their projected positions (no glyph
rotation toward the camera in this version; Appendix C, C-4).

```xml
<text x="10 30 50" y="20 20 20" z="0 10 20">3D</text>
```

---

## 7. The `path3d` element

### 7.1 Element definition

- **Categories**: graphics element, renderable, shape-adjacent.
- **Contexts**: anywhere a `path` is allowed.
- **Content model**: descriptive elements only.
- **Attributes**: `d` (required for rendering; see §7.4), common attributes,
  paint and stroke attributes as for `path`.
- **DOM**: out of scope (§1.4).

The `path3d` element renders the outline defined by its path data, interpreted
in 3D and projected per §3.1. Its path data grammar is defined in §7.2.

`pathLength`: **not supported** on `path3d` in this version. A `pathLength`
attribute on `path3d` is ignored (R1 analog: unsupported attribute). See
Appendix C, C-2.

### 7.2 Path data grammar

The `d` attribute of `path3d` uses the `svg-path` EBNF grammar of SVG 2 §9.3
with exactly one change: every **coordinate pair production is replaced by a
coordinate triple**.

```
coordinate-triple ::= coordinate wsp+ coordinate (comma-wsp | wsp+) coordinate
```

where `coordinate` and `comma-wsp` are as defined in SVG 2 §9.3. Formally,
with SVG 2's own productions reused verbatim:

```
svg-path3d ::= wsp* (moveto3d | drawto3d)* wsp?
moveto3d  ::= ( "M" | "m" ) wsp* triplet
drawto3d  ::= (
                ( "L" | "l" ) wsp* triplet+          |
                ( "H" | "h" ) wsp* coordinate+       |
                ( "V" | "v" ) wsp* coordinate+       |
                ( "C" | "c" ) wsp* (triplet triplet triplet)+ |
                ( "S" | "s" ) wsp* (triplet triplet)+         |
                ( "Q" | "q" ) wsp* (triplet triplet)+         |
                ( "T" | "t" ) wsp* triplet+                   |
                ( "A" | "a" ) wsp* (arc-params3d)+            |
                ( "Z" | "z" )
              )
arc-params3d ::= nonnegative-number wsp+ nonnegative-number wsp+
                 number wsp+ flag wsp+ flag wsp+ triplet
triplet ::= coordinate wsp+ coordinate (comma-wsp | wsp+) coordinate
```

The grammar is **triples-only**: `M`, `L`, `C`, `S`, `Q`, `T`, and `A` take
3D triples; `H`, `V`, and `Z` are unchanged from SVG 2 (they carry no point
and act on `x`/`y` only, leaving the current `z` unchanged).

**Decision (freezes plan OQ-1).** The plan's "mixed 2D/3D commands" option is
grammatically impossible: with optional `z`, the data `M 1 2 3 4 5 6` could be
one 3D moveto plus one 3D implicit lineto *or* three 2D points — no parser can
decide. Since `path3d` is a new element with no legacy grammar to preserve
(R3 applies to `path`, not to new elements), triples are mandatory. A 2D
`d` value can be converted mechanically by appending `,0` to each coordinate
pair; see the fallback idiom in §11.2.

**Relative commands.** For relative commands (`m`, `l`, `c`, `s`, `q`, `t`,
`a`), the third coordinate of each triple is a **relative `z` delta**: it is
added to the current point's `z`, exactly as relative `x`/`y` are added. A
relative `moveto` as the first command is treated as absolute in `x`/`y` per
SVG 2 §9.3.1; its `z` is likewise treated as absolute (added to the current
`z`, which is `0` at path start).

**Implicit linetos.** As in SVG 2, a `moveto` followed by further triplets
treats each subsequent triplet as an implicit `lineto` (relative if the
moveto is relative).

**Current point.** The current point is a 3D point; every command updates
`x`, `y`, *and* `z`. `H`/`V` update only their axis and leave `z` unchanged.
`Z`/`z` returns to the subpath's start point in all three coordinates.

**Reflection (S/T).** The reflected control point is reflected in all three
coordinates, extending SVG 2 §9.5.2 to 3D.

**Arcs (A/a).** The radii, rotation, and flags act on the `x`/`y` projection
of the segment exactly as in SVG 2, including the out-of-range parameter
correction of SVG 2 §9.5.1. The arc's `z` varies **linearly** from the current
point's `z` to the endpoint's `z` along the arc parameter. An arc between two
points with equal `z` is planar in the plane `z = const`.

```xml
<path3d d="M 10,10,0 L 80,60,40 C 100,20,40 140,80,40 160,40,0 Z"/>
```

### 7.3 Degradation

A 2D renderer does not recognize `path3d`; per R2 it is excluded from
rendering entirely — no partial geometry, no error. §11.2 defines the author
fallback idiom.

### 7.4 Error handling

Path data errors in `path3d` follow SVG 2 §9.5.4 with the parameter counts of
§7.2: the element renders up to (but not including) the command containing the
first error; a command with a wrong parameter count renders up to and
including the last correctly defined segment. An empty `d`, or `d` with no
valid commands, disables rendering as in SVG 2.

---

## 8. Point-list shapes: the `zs` attribute

### 8.1 Definition

`polyline` and `polygon` gain one attribute:

| Attribute | Value | Initial value | Animatable |
|-----------|-------|---------------|------------|
| `zs` | `<number-list>` (comma-wsp separated) | empty list | yes |

The `points` attribute **MUST** continue to use the exact SVG 2 grammar and
error handling (R3). The `zs` list is **parallel** to the parsed vertex list:
its *i*-th number is the `z` of the *i*-th vertex of the `points` list, where
vertices are counted in the order the SVG 2 grammar parses them.

Alignment rules:

- If `zs` has fewer entries than vertices, missing entries are `0`.
- If `zs` has more entries than vertices, extra entries are ignored.
- If `points` is invalid per SVG 2 (odd count, last coordinate dropped), the
  vertex list is the SVG 2-corrected list, and `zs` aligns to that list.

### 8.2 Decision (freezes plan OQ-2/OQ-3)

The parallel attribute is chosen over `polygon3d`/`polyline3d` elements
because its degradation is strictly better: a 2D renderer ignores `zs` (R1)
and still renders the flat polygon — the new elements would render nothing
(R2). The attribute name is frozen as `zs`, following the naming convention of
§6. New elements are reserved as future aliases only.

```xml
<polygon points="10,10 80,20 50,70" zs="0 40 20"/>
```

### 8.3 Degradation

A 2D renderer ignores `zs` and renders the SVG 2 flat shape. No author action
required.

---

## 9. Paint servers

### 9.1 `linearGradient`

| Attribute | Meaning |
|-----------|---------|
| `z1`, `z2` | The gradient vector runs from `(x1, y1, z1)` to `(x2, y2, z2)` |

The gradient vector is 3D geometry: it is transformed by the referencing
element's model-stage transforms and projected per §3.1; the gradient axis on
the film plane is the projection of the 3D vector. Gradient stops, `spreadMethod`,
and all other semantics are unchanged. With the default camera, this is
exactly SVG 2's behavior (a `z1 = z2 = 0` vector projects to itself).

### 9.2 `radialGradient`

| Attribute | Meaning |
|-----------|---------|
| `cz` | The gradient's center lies at `z = cz` |
| `fz` | The gradient's focal point lies at `z = fz` |

The center and focal point are 3D points `(cx, cy, cz)` and `(fx, fy, fz)`,
projected per §3.1 like any geometry point; the projected center/focal point
define the projected radial gradient. `r` and `fr` remain in-plane radii of
the 3D geometry before projection; the projected radius is the projection of
the circle of radius `r` about the center (which under perspective is handled
by the general conic rule of §3.2).

### 9.3 `gradientTransform`

`gradientTransform` accepts 3D transform functions per §4.2. The gradient's
3D geometry (vector, center, focal circle) is transformed by
`gradientTransform` before projection.

### 9.4 `pattern` and `patternTransform`

The `pattern` tile is 2D content, positioned by `x`/`y`/`width`/`height` in
the plane `z = 0` of the pattern's coordinate system; `patternTransform`
accepts 3D transform functions, and the tile geometry participates in the
projection pipeline. (A `z` placement attribute for `pattern` is future work;
Appendix C, C-5.)

---

## 10. Filters

- `feOffset` gains a `dz` attribute (initial `0`, animatable): the offset is
  `(dx, dy, dz)` applied to the filter primitive subregion in the filter's
  coordinate system before projection-related filter-region computations. All
  other filter primitives remain 2D raster operations and **MUST NOT** be
  extended in this version.
- The lighting primitives (`feDistantLight`, `fePointLight`, `feSpotLight`)
  are already 3D ([FILTER-EFFECTS-1]); no changes are made, and they are cited
  as the precedent for attribute-carried `z` (R5).
- Filters apply to the projected rendering, exactly as they apply to SVG 2
  rendering today. This specification does not introduce 3D filter pipelines.

---

## 11. Fallback and extensibility

### 11.1 Degradation summary (normative)

| Feature | 2D renderer behavior | Normative basis |
|---------|----------------------|-----------------|
| `z`, `z1`, `z2`, `cz`, `fz`, `dz` attributes | Ignored; flat SVG 2 rendering | R1 |
| `zs` attribute | Ignored; flat SVG 2 rendering | R1 |
| `path3d` element | Not rendered (silently) | R2 |
| `camera` element | Not rendered (silently); default camera applies | R2 |
| `camera` attribute on `svg` | Ignored | R1 |
| 3D transform functions | Already valid in SVG 2; z effect invisible in 2D rendering | R4 |

### 11.2 Author fallback for `path3d`

Because `path3d` renders nothing on a 2D renderer, authors who need flat
fallback **MUST** use the conditional-processing idiom:

```xml
<switch>
  <!-- 3D renderer: exact 3D geometry -->
  <path3d d="M 10,10,0 L 80,60,40"
          requiredExtensions="http://svg.example/svg3d/1.0"/>
  <!-- 2D fallback: flat projection of the same segment -->
  <path d="M 10,10 L 80,60"/>
</switch>
```

Rules:

- The SVG 3D extension identifier is
  `http://svg.example/svg3d/1.0` (placeholder pending registration;
  Appendix C, C-6). A 3D-conformant renderer **MUST** evaluate
  `requiredExtensions` as *true* for this identifier; a 2D renderer evaluates
  it as *false* per SVG 2 §5.6.4.
- A 2D renderer's unknown-element handling (R2) does not affect `switch`
  child selection: the fallback `path` is rendered, the `path3d` is not.

Authors who do not need a flat fallback may author `path3d` directly; 2D
renderers will show nothing for it, which the degradation table presents as
the defined behavior.

---

## 12. Error handling

This specification follows SVG 2's error philosophy: render what is
deterministically recoverable, and degrade to the SVG 2 interpretation.

| Situation | Behavior |
|-----------|----------|
| Invalid value for `z`, `z1`, `z2`, `cz`, `fz`, `dz`, `zs` entry | Use the initial value (`0` / empty list); element renders |
| `zs` count mismatch | §8.1 alignment rules |
| `path3d` path data error | SVG 2 §9.5.4 model with §7.2 parameter counts |
| `path3d` on a 2D renderer | Not rendered (R2); §11.2 fallback applies |
| Invalid `camera` attribute value (e.g. a malformed number in `position`) | Use that attribute's initial value |
| `camera` URL reference unresolvable | Fall through the §5.2 resolution order |
| Degenerate camera (§5.4 validity) | Use the default camera for that viewport |
| Point behind the camera plane | Not rendered; §5.6 depth clipping applies |
| `pathLength` on `path3d` | Ignored (§7.1) |

A 2D renderer implements none of this table beyond what SVG 2 already
requires of it; every row is written so that the 2D behavior is SVG 2's own
behavior.

---

## 13. Security, privacy, and accessibility

- **Security/privacy.** The projection mathematics are local computations on
  document-supplied numbers; no new network, timing, or device-access surface
  is introduced. Extremely large `z` values under perspective can produce very
  large projected coordinates; renderers already handle large coordinate
  magnitudes in SVG 2 and the same mitigations apply.
- **Accessibility.** No changes to the accessibility tree are introduced by
  this version. The `camera` element accepts descriptive elements (`title`,
  `desc`); authors are encouraged to describe cameras that substantially
  change the reading of a diagram. DOM/IDL accessibility APIs for new
  attributes follow the DOM deferral of §1.4.

---

## Appendix A: Attribute and element summary

### New elements

| Element | Namespace | Categories | Purpose |
|---------|-----------|------------|---------|
| `path3d` | SVG | graphics element | Path outline in 3D (§7) |
| `camera` | SVG | never-rendered element | Viewport camera (§5) |

### New attributes on existing elements

| Element(s) | Attribute | Initial | Mirrors |
|------------|-----------|---------|---------|
| `line` | `z1`, `z2` | `0` | `x1/y1`, `x2/y2` |
| `rect`, `image`, `foreignObject`, `use` | `z` | `0` | `x`, `y` |
| `circle`, `ellipse` | `cz` | `0` | `cx`, `cy` |
| `text`, `tspan` | `z`, `dz` | empty list | `x`/`y`, `dx`/`dy` |
| `polyline`, `polygon` | `zs` | empty list | parallel to `points` |
| `linearGradient` | `z1`, `z2` | `0` | `x1/y1`, `x2/y2` |
| `radialGradient` | `cz`, `fz` | `0` | `cx/cy`, `fx/fy` |
| `feOffset` | `dz` | `0` | `dx`, `dy` |
| `svg` | `camera` | `none` | — |

### Naming convention (normative)

- Position/plane: `z` — mirrors `x`, `y`.
- Endpoints: `z1`, `z2` — mirrors `x1,y1,x2,y2`.
- Centers and focal points: `cz`, `fz` — mirrors `cx,cy`, `fx,fy`.
- Deltas: `dz` — mirrors `dx`, `dy`.
- Parallel vertex-depth list: `zs` — mirrors `points`.

## Appendix B: Changes since SVG 2, and decision log

1. **D-1 — `path3d` grammar is triples-only** (§7.2). The plan's proposed
   mixed 2D/3D baseline was found grammatically ambiguous (`M 1 2 3 4 5 6`)
   and is rejected. Because `path3d` is a new element, no SVG 2 grammar is
   broken.
2. **D-2 — Parallel `zs` attribute for `polyline`/`polygon`** (§8). New
   elements rejected in favor of ideal degradation.
3. **D-3 — Camera is a viewport-level `camera` element** (§5), never a
   `transform`. `viewBox` remains the film plane; the default camera is the
   identity, guaranteeing SVG 2-identical rendering.
4. **D-4 — Project-early principle** (§3.1): projection happens before the
   paint stage; markers, text-on-path, stroking, and gradient positioning act
   on projected geometry. Constant screen-space stroke width is a documented
   consequence (C-1).
5. **D-5 — No depth testing** (§3.4): painting order is document order.
6. **D-6 — No new namespace** (§2.3): SVG 2's extension channels
   (§5.10) suffice.
7. **D-7 — No DOM/IDL in this version** (§1.4).
8. Everything else: new geometry attributes per §6, §9, §10 and Appendix A.

## Appendix C: Open issues

- **C-1** Strokes are screen-space constant width (§3.1). A 3D-space stroke
  model (foreshortened width) is future work.
- **C-2** `pathLength` on `path3d`: excluded in v1 because the distance is
  ambiguous between 3D user-space length and projected length. Revisit with a
  normative choice if authoring feedback requires it.
- **C-3** Volumetric `rect` (`depth` attribute or a box element): deferred;
  plan OQ-4 default (planar only) is in force.
- **C-4** Glyph orientation toward the camera for 3D text: deferred; glyphs
  are billboard-free in v1.
- **C-5** `pattern` plane placement attribute: deferred.
- **C-6** The extension identifier `http://svg.example/svg3d/1.0` (§11.2) is a
  placeholder; it must be registered before publication.
- **C-7** `camera` on `svg` is an attribute in this version; whether it should
  be a CSS presentation property is open.
- **C-8** Marker 3D orientation (`orient` tangent frames in 3D): resolved for
  v1 via the project-early principle; true 3D marker orientation is future
  work.
- **C-9** `textPath`/`animateMotion` over 3D paths beyond the projected
  outline: future work.
