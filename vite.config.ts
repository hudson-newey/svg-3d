import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Library mode: the component (and its public helpers) as a single
    // ES module. `lit` stays external — it is a runtime dependency.
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "svg-3d-viewer",
    },
    rollupOptions: {
      external: (id: string) => id === "lit" || id.startsWith("lit/"),
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
