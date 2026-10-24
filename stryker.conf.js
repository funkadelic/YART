/**
 * StrykerJS, run by hand as `npm run test:mutation`. Not in CI and not a gate,
 * like `npm run fallow`.
 */
export default {
  $schema: "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  testRunner: "vitest",
  // Its own config, so the pass runs only the jsdom project.
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
    // Instrumentation calls helpers outside bootDocument, which breaks its
    // serialized form in the global-scope test.
    "!src/bootDocument.ts",
  ],
  // Only the tests that reach a mutant run for it. Without it every mutant pays
  // for the whole suite.
  coverageAnalysis: "perTest",
};
