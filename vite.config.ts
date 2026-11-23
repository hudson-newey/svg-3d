import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Library mode: the component (and its public helpers) as a single
    // self-contained ES module (lit inlined — see rollupOptions note).
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "svg-3d-viewer",
    },
    // lit is inlined: the dist bundle is fully self-contained, so it can be
    // loaded from a CDN with a single <script type="module"> tag — no import
    // map, and no dual-instance hazard from shared lit subpath builds.
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
