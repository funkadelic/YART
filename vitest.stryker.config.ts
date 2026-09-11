import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vitest/config";

/**
 * The jsdom project from vite.config.ts, on its own, for the mutation pass.
 *
 * That file cannot serve here: it also declares the browser project, whose
 * provider pulls @vitest/browser 5.x, and the pass runs on vitest 4. See
 * stryker.conf.js for why.
 *
 * The two specs excluded below assert the toolchain, so neither can kill a
 * mutant in src/, and both are the slowest in the suite. bundle.test.ts also
 * shells out to a real build, which loads vite.config.ts and hits the same
 * browser package.
 */
export default defineConfig({
  plugins: [react()],
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
