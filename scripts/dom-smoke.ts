/**
 * End-to-end check of the project-early renderer through a real DOM
 * implementation. Run: node scripts/dom-smoke.ts
 */
import { Window } from "happy-dom";

const win = new Window();
// The renderer uses document.* only; register the happy-dom globals.
globalThis.document = win.document as unknown as Document;

const { renderSvg3d } = await import("../src/lib/render.ts");
const { SUPPORTED_EXTENSIONS } = await import("../src/lib/render.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name} ${detail}`);
  }
}

function project(markup: string): SVGSVGElement {
  const doc = new win.DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement as unknown as SVGSVGElement;
  return renderSvg3d(root, (m) => console.warn(`  [warn] ${m}`));
}

// 1. Default camera identity: 2D content projects unchanged.
const flat = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <line x1="10" y1="20" z1="0" x2="30" y2="40" z2="0" stroke="black"/>
   </svg>`,
);
const line1 = flat.querySelector("path");
check(
  "identity line path",
  line1?.getAttribute("d") === "M 10,20 L 30,40",
  line1?.getAttribute("d"),
);
check("paint attr copied", line1?.getAttribute("stroke") === "black");
check("root viewBox copied", flat.getAttribute("viewBox") === "0 0 100 100");

// 2. Perspective camera: aim point lands on film origin; nearer is larger.
const persp = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-90 -90 180 180">
     <camera projection="perspective" fov="60" position="200 0 300" target="50 0 50" up="0 1 0"/>
     <line x1="0" y1="0" z1="0" x2="100" y2="0" z2="0"/>
   </svg>`,
);
const d2 = persp.querySelector("path")!.getAttribute("d")!;
const nums = d2.match(/-?[\d.]+/g)!.map(Number);
check(
  "perspective line crosses film origin",
  nums.length === 4 && nums[0]! < 0 && nums[2]! > 0,
  d2,
);
check("near end scales larger (perspective)", Math.abs(nums[0]!) < Math.abs(nums[2]!), d2);

// 3. zs parallel attribute.
const zs = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <polygon points="10,10 30,10 20,30" zs="5 15 25" fill="red"/>
   </svg>`,
);
// default camera ortho ignores z: flat coords preserved.
check(
  "polygon zs flat",
  zs.querySelector("path")!.getAttribute("d")!.startsWith("M 10,10 L 30,10 L 20,30"),
);

// 4. zs visible through an oblique ortho camera (z shifts projected y/x).
const zsOblique = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120">
     <camera projection="orthographic" position="100 0 100" target="0 0 0" up="0 1 0"/>
     <polyline points="0,0 50,0" zs="0 40"/>
   </svg>`,
);
const d4 = zsOblique.querySelector("path")!.getAttribute("d")!;
check("zs shifts geometry off-axis", !d4.startsWith("M 0,0 L 50,0"), d4);

// 5. switch + requiredExtensions evaluation (§12.2).
const sw = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <switch>
       <path3d d="M 10,10,0 L 60,60,0" stroke="blue" requiredExtensions="${SUPPORTED_EXTENSIONS}"/>
       <path d="M 10,10 L 60,60" stroke="gray"/>
     </switch>
   </svg>`,
);
check(
  "switch picks path3d branch",
  sw.querySelector("path3d") === null &&
    sw.querySelector("path")?.getAttribute("stroke") === "blue",
);

const sw2 = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <switch>
       <path3d d="M 10,10,0 L 60,60,0" requiredExtensions="urn:other:1.0"/>
       <path d="M 10,10 L 60,60" stroke="green"/>
     </switch>
   </svg>`,
);
check(
  "switch falls back for foreign extension",
  sw2.querySelectorAll("path").length === 1 &&
    sw2.querySelector("path")!.getAttribute("stroke") === "green",
);

// 6. text z list per-character.
const text = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <text x="10 30 50" y="20 20 20" z="0 10 20" font-size="10">3D</text>
   </svg>`,
);
const chars = text.querySelectorAll("text");
check("text renders per character", chars.length === 2, String(chars.length));
check(
  "first char at identity position",
  chars[0]!.getAttribute("x") === "10" && chars[0]!.getAttribute("y") === "20",
);

// 7. Group transform + inheritance.
const group = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <g fill="tomato" transform="translate(10 5)">
       <rect x="0" y="0" width="20" height="10"/>
     </g>
   </svg>`,
);
const gEl = group.querySelector("g");
const rect = group.querySelector("path");
check("g copied with fill", gEl?.getAttribute("fill") === "tomato");
check(
  "g transform baked into geometry",
  rect?.getAttribute("d")?.startsWith("M 10,5 L 30,5 L 30,15 L 10,15") ?? false,
  rect?.getAttribute("d"),
);
check("g transform not copied", gEl?.getAttribute("transform") === null);

// 8. path3d error truncation still renders the good prefix.
const partial = project(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <path3d d="M 1,2,3 L 4,5,6 L 7,8"/>
   </svg>`,
);
check(
  "path3d partial data renders prefix",
  partial.querySelector("path")!.getAttribute("d")!.startsWith("M 1,2 L 4,5"),
);

console.log(failures === 0 ? "\nAll DOM checks passed" : `\n${failures} DOM check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
