# svg-3d

## Usage

```html
<script src="https://cdn.jsdelivr.net/npm/@hudson-newey/svg-3d-viewer" type="module"></script>

<!-- The scene from the 3-camera--camera-reference story: a wireframe box on
     a floor grid, with the perspective camera declared in <defs> and
     selected via the camera="#orbit" attribute. -->
<svg3d-viewer style="display:block;width:480px;height:360px">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -90 180 180" camera="#orbit">
    <defs>
      <camera
        id="orbit"
        projection="perspective"
        fov="55"
        position="220 180 280"
        target="50 50 50"
        up="0 1 0"
        near="1"
      />
    </defs>
    <g stroke="#4a5568" stroke-width="1.5">
      <line x1="0" y1="0" z1="0" x2="100" y2="0" z2="0" />
      <line x1="0" y1="100" z1="0" x2="100" y2="100" z2="0" />
      <line x1="0" y1="0" z1="100" x2="100" y2="0" z2="100" />
      <line x1="0" y1="100" z1="100" x2="100" y2="100" z2="100" />
      <line x1="0" y1="0" z1="0" x2="0" y2="100" z2="0" />
      <line x1="100" y1="0" z1="0" x2="100" y2="100" z2="0" />
      <line x1="0" y1="0" z1="100" x2="0" y2="100" z2="100" />
      <line x1="100" y1="0" z1="100" x2="100" y2="100" z2="100" />
      <line x1="0" y1="0" z1="0" x2="0" y2="0" z2="100" />
      <line x1="100" y1="0" z1="0" x2="100" y2="0" z2="100" />
      <line x1="0" y1="100" z1="0" x2="0" y2="100" z2="100" />
      <line x1="100" y1="100" z1="0" x2="100" y2="100" z2="100" />
    </g>
    <g stroke="#a0aec0" stroke-width="0.75">
      <line x1="-50" y1="140" z1="-100" x2="-50" y2="140" z2="300" />
      <line x1="-100" y1="140" z1="-50" x2="300" y2="140" z2="-50" />
      <line x1="0" y1="140" z1="-100" x2="0" y2="140" z2="300" />
      <line x1="-100" y1="140" z1="0" x2="300" y2="140" z2="0" />
      <line x1="50" y1="140" z1="-100" x2="50" y2="140" z2="300" />
      <line x1="-100" y1="140" z1="50" x2="300" y2="140" z2="50" />
      <line x1="100" y1="140" z1="-100" x2="100" y2="140" z2="300" />
      <line x1="-100" y1="140" z1="100" x2="300" y2="140" z2="100" />
      <line x1="150" y1="140" z1="-100" x2="150" y2="140" z2="300" />
      <line x1="-100" y1="140" z1="150" x2="300" y2="140" z2="150" />
      <line x1="200" y1="140" z1="-100" x2="200" y2="140" z2="300" />
      <line x1="-100" y1="140" z1="200" x2="300" y2="140" z2="200" />
      <line x1="250" y1="140" z1="-100" x2="250" y2="140" z2="300" />
      <line x1="-100" y1="140" z1="250" x2="300" y2="140" z2="250" />
    </g>
    <circle cx="50" cy="50" r="8" cz="50" fill="#e53e3e" />
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
