# svg-3d

## Usage

```html
<script src="https://cdn.jsdelivr.net/npm/@hudson-newey/svg-3d-viewer" type="module"></script>

> The URL above has no version: jsDelivr resolves the package's default file > via the
`jsdelivr`/`main` field in `package.json`, and serves the latest > release. Pin a version
(`@hudson-newey/svg-3d-viewer@0.1.0`) for > production use, and note the URL only resolves once the
package is > published to npm. > > The bundle is fully self-contained (`lit` is inlined at build
time), so no > import map is needed and there is no risk of duplicate `lit` copies from > CDN module
rewriting. `lit` stays external for source-tree usage > (`pnpm dev` / Storybook resolve it from
`node_modules`).

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
