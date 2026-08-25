import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
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
  prettierConfig, // must go last
]);
