export { Svg3dViewer } from "./svg3d-viewer.ts";
export { renderSvg3d, SUPPORTED_EXTENSIONS } from "./lib/render.ts";
export { flattenPath3d, type Subpath, type P3 } from "./lib/path3d.ts";
export {
  DEFAULT_CAMERA,
  parseCameraElement,
  projectPoint,
  toView,
  viewBasis,
} from "./lib/camera.ts";
export { parseTransform } from "./lib/transform.ts";
export { applyPoint, IDENTITY, multiply, type Mat4, type Vec3 } from "./lib/mat4.ts";
