import react from "@vitejs/plugin-react";
import { defaultClientConditions } from "vite";
import { defaultExclude, defineConfig } from "vitest/config";

import { SOURCE_CONDITION } from "./vite.shared.ts";

/**
 * The jsdom project from vite.config.ts, on its own, for the mutation pass.
 *
 * The two specs excluded below assert the toolchain, so neither can kill a
 * mutant in src/, and both are the slowest in the suite.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: [SOURCE_CONDITION, ...defaultClientConditions] },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      ...defaultExclude,
      "src/**/*.browser.test.tsx",
      "e2e/**",
      "src/bundle.test.ts",
      "src/toolchain.test.ts",
    ],
  },
});
