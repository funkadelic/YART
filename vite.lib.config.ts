import react from "@vitejs/plugin-react";
import { basename, resolve } from "node:path";
import { defineConfig } from "vite";

import { BUILD_TARGET } from "./vite.config";

// The library build: one ESM file plus one stylesheet in lib/, with React and
// the icons left to the consumer. The default export is what Vite looks for.
export default defineConfig({
  plugins: [react()],
  // Otherwise the favicon, manifest and robots file land in lib/.
  publicDir: false,
  css: {
    modules: {
      // ponytail: keyed on the stylesheet basename, unique per component today;
      // a duplicate basename would merge two components' classes.
      generateScopedName: (local, file) =>
        `yart-${basename(file).split(".")[0]}__${local}`,
    },
  },
  build: {
    target: BUILD_TARGET,
    outDir: "lib",
    lib: {
      entry: resolve(import.meta.dirname, "src/yart.lib.ts"),
      formats: ["es"],
      fileName: "index",
      cssFileName: "styles",
    },
    rolldownOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^react-icons($|\/)/],
      // Bundling drops directives, so App Router consumers get it back here.
      output: { banner: '"use client";' },
    },
  },
});
