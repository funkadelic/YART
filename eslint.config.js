import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { defineConfig } from "eslint/config";

// src/test/ is excluded from coverage, and unlike the other three exclude
// patterns its contents actually execute. Nothing but the runner's own
// structure keeps a module with real logic from being placed there and imported
// by the app, which would put executing application code outside the measured
// set with every guard still green.
//
// Declared once rather than written into each block below, because
// no-restricted-imports is configured per rule and not per pattern: a later
// block naming the rule replaces the earlier configuration outright for the
// files it matches, so a second block that forgot this group would silently
// unrestrict it for exactly those files.
const TEST_SCAFFOLDING_IMPORT = {
  group: ["**/test/**"],
  message:
    "src/test/ holds test scaffolding and is excluded from coverage. Importing it from application code moves executing code outside the coverage gate.",
};

// The four attributes whose string value a reader perceives. `aria-sort` and
// `aria-live` carry strings in that layer too and are deliberately outside the
// set: both take a value the standard defines and assistive technology matches
// on, so translating either would break the feature rather than localize it.
//
// no-restricted-syntax is configured per rule and not per selector, exactly as
// no-restricted-imports is above, so each selector set is declared once here and
// composed per block below. A block that named the rule and forgot a set would
// silently unrestrict it for every file that block matches.
const READER_FACING_ATTRIBUTE = {
  selector:
    'JSXAttribute[name.name=/^(aria-label|title|placeholder|alt)$/][value.type="Literal"]',
  message:
    "src/components/ renders any collection for any reader, so a string here is a claim about which reader. Add the entry to the catalogs and read it off DataTableLabels, PaginationLabels or SearchInputLabels.",
};

// Every way a file asks the platform for a locale: a namespace construction, and
// a call to one of the six value-level helpers that read a locale from the
// machine when called with no argument. A fifth surface resolving a locale of its
// own reintroduces the defect the locale layer closed, and does it invisibly on a
// machine whose own preference is the base tag.
//
// Matched on the tree rather than on the text, which matters twice here: a
// namespace named inside a comment is not a call site, and a type annotation
// naming the same constructor is not one either.
const LOCALE_CALL_SITE = [
  {
    selector:
      ':matches(NewExpression, CallExpression)[callee.object.name="Intl"]',
    message:
      "src/i18n/format.ts is the one module that builds a platform locale object, so its caches hold one instance per resolved tag. Reach for collatorFor, numberFormatFor or pluralRulesFor instead.",
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(localeCompare|toLocaleString|toLocaleDateString|toLocaleTimeString|toLocaleLowerCase|toLocaleUpperCase)$/]",
    message:
      "This reads a locale from the machine rather than the one the application resolved, and builds a formatter per call. Take a collator or a formatter from src/i18n/format.ts instead.",
  },
];

// The way the mirror rule is undone in JavaScript rather than in CSS: a branch
// choosing between two glyph components on the reading direction. It is
// invisible to the stylelint rules that hold the stylesheets, because it is not
// CSS, and invisible to the literal rule above, because a glyph component is
// neither a text child nor a string.
const DIRECTION_BRANCH = [
  {
    selector:
      "ConditionalExpression[consequent.type=/^JSX(Element|Fragment)$/][alternate.type=/^JSX(Element|Fragment)$/]",
    message:
      "Two glyph components chosen on a condition are a prop, a branch and a coverage line for what one transform: scaleX(-1) under an attribute selector already does. Mirror in the stylesheet.",
  },
  {
    selector:
      "IfStatement[alternate] ReturnStatement[argument.type=/^JSX(Element|Fragment)$/]",
    message:
      "Two glyph components returned from two branches are a prop, a branch and a coverage line for what one transform: scaleX(-1) under an attribute selector already does. Mirror in the stylesheet.",
  },
];

export default defineConfig([
  // Build output and test-runner output, not authored source. `eslint .` walks
  // the working tree, so without this the gate reports parse errors for an
  // emitted bundle, a coverage report, and the page resources the visual spec
  // archives under test-results/.
  {
    ignores: ["dist/", "coverage/", "test-results/", "playwright-report/"],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"],
    languageOptions: { globals: globals.browser },
  },
  eslint.configs.recommended,
  // Type-aware rather than syntax-only, which is what puts the promise rules in
  // play: a floating promise and a promise passed where a void callback is
  // expected are both invisible without types, and this tree is built on a
  // request seam, effects and a debounce. projectService reads the tsconfig
  // this repository already has, so the linted set and the typechecked set are
  // the same set by construction rather than by a second list kept here.
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
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
  // Test files are exempt from the scaffolding restriction because importing
  // that scaffolding is what it is for.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/**/*.test-d.ts", "src/test/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [TEST_SCAFFOLDING_IMPORT] },
      ],
    },
  },
  // The shared components take every rendered string as a prop, which is the
  // one property that lets them show something other than cities. A component
  // reaching the locale layer directly would weld the table to this app's copy
  // and to this app's idea of a catalog, and it would do so invisibly: the tree
  // still renders, the tests still pass, and the layer rule is gone. Cheaper to
  // fail here than to catch in review every time.
  {
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/**/*.test-d.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            TEST_SCAFFOLDING_IMPORT,
            {
              group: ["**/i18n/**", "**/useLocale*"],
              message:
                "src/components/ takes its strings as props so that it stays reusable. Pass them in through the labels prop instead of reaching for a catalog here.",
            },
          ],
        },
      ],
    },
  },
  // The formatter module is exempt because it is the module the rule names. The
  // test globs are exempt because a test asserting a formatted string has to
  // compute its expectation through the platform rather than type it: the French
  // group separator is a narrow no-break space, and a typed literal fails on a
  // difference no terminal renders. So the ban is on shipped call sites.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/i18n/format.ts",
      "src/**/*.test.{ts,tsx}",
      "src/**/*.test-d.ts",
      "src/test/**",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...LOCALE_CALL_SITE],
    },
  },
  // The same layer rule one level down from the imports above: a hardcoded
  // sentence needs no import, so the two import rules cannot see it. ignoreProps
  // is deliberate, because the attribute half is narrower than every prop and is
  // the selector beside it.
  {
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/**/*.test-d.ts"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        { noStrings: true, ignoreProps: true, allowedStrings: [] },
      ],
      "no-restricted-syntax": [
        "error",
        READER_FACING_ATTRIBUTE,
        ...LOCALE_CALL_SITE,
      ],
    },
  },
  // The component holding the four glyphs that mean a direction. All three
  // selector sets, because no-restricted-syntax is configured per rule: this
  // block replaces the two above outright for this file, and naming only the
  // direction set would unrestrict the other two for exactly the component most
  // likely to regain a literal.
  {
    files: ["src/components/DataTable/Pagination.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        READER_FACING_ATTRIBUTE,
        ...LOCALE_CALL_SITE,
        ...DIRECTION_BRANCH,
      ],
    },
  },
  // The type-aware rules need declarations to reason about, and the plain
  // JavaScript in this tree has none: a build script reading an untyped CSV
  // parser and a flat config importing a plugin that ships no types. Every
  // value there is `any`, so the rules report the absence of types rather than
  // a defect. Syntax and correctness rules still apply.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Recommended as of the next major, enabled ahead of it. A symptom error
  // that drops the one it was raised from costs the reader the stack that
  // says where the failure started, and the data module already carries the
  // original as a cause at every boundary it wraps.
  {
    rules: {
      "preserve-caught-error": "error",
    },
  },
  prettierConfig, // must go last
]);
