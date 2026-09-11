/**
 * StrykerJS, run by hand as `npm run test:mutation`. Not in CI and not a gate,
 * like `npm run fallow`.
 *
 * Stryker 10's runner support stops at vitest 4.1, so against the installed 5.x
 * it reports adapter failures as test failures. Install the older runner
 * without saving it, run the pass, then restore the tree:
 *
 *   npm i -D --no-save --legacy-peer-deps vitest@4
 *   npm run test:mutation
 *   npm ci
 */
export default {
  $schema: "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  testRunner: "vitest",
  // Its own config, because vite.config.ts declares a browser project whose
  // provider pulls a package the 4.x runner cannot load.
  vitest: { configFile: "vitest.stryker.config.ts" },
  // Mirrors the coverage `exclude` array in vite.config.ts. Keep the two in
  // step; nothing checks that they agree.
  mutate: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.test-d.ts",
    "!src/test/**",
    "!src/**/*.d.ts",
    // Translations are copy no test asserts, and none should: that would pin
    // the translator's wording in a test file. Left in, they were most of the
    // survivors.
    "!src/i18n/catalogs/**",
  ],
  // Only the tests that reach a mutant run for it. Without it every mutant pays
  // for the whole suite.
  coverageAnalysis: "perTest",
};
