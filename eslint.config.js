import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"],
    languageOptions: { globals: globals.browser },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
  // The plugin's own flat config rather than a hand-built entry, so the shape
  // tracks the installed major instead of the one this file was written against.
  // Note it enables the React Compiler rule family, not just the two classic
  // hook rules.
  reactHooks.configs.flat.recommended,
  // The axe sweeps assert what a rendered tree does; this asserts what the JSX
  // says, which is the half that has no test to render it. A control that no
  // case mounts is invisible to both sweeps and visible here.
  //
  // recommended rather than strict: strict turns on rules whose correct answer
  // depends on the surrounding markup, which is what makes them noisy in a tree
  // this small rather than more careful.
  jsxA11y.flatConfigs.recommended,
  // src/test/ is excluded from coverage, and unlike the other three exclude
  // patterns its contents actually execute. Nothing but the runner's own
  // structure keeps a module with real logic from being placed there and
  // imported by the app, which would put executing application code outside
  // the measured set with every guard still green. Test files are exempt
  // because importing that scaffolding is what it is for.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/**/*.test-d.ts", "src/test/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/test/**"],
              message:
                "src/test/ holds test scaffolding and is excluded from coverage. Importing it from application code moves executing code outside the coverage gate.",
            },
          ],
        },
      ],
    },
  },
  prettierConfig, // must go last
]);
