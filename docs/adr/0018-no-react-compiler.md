# 18. The demo app is not compiled with React Compiler

Status: accepted
Date recorded: 2026-11-27

## Context

React Compiler has been stable since 1.0 in October 2025, and the React plugin for Vite exports `reactCompilerPreset` for the Babel route, through `@rolldown/plugin-babel` and `babel-plugin-react-compiler`. The page keeps its derived data in `useMemo` and its callbacks on empty dependency arrays, which is the memoization the compiler would otherwise insert.

Vitest's jsdom project runs in Vite's client environment, so the compiler also transforms the gated test suite. The coverage tool then attributes the compiler's generated cache checks to source lines, and the 100% gate counts them.

The spike ran on the merged search code in a scratch checkout, with `@babel/core` held at 7.29.7.

## Decision

Do not adopt it. The rule was to adopt only if `npm run test:coverage` exits 0 with the compiler on, and it exits 1.

|            | compiler off    | compiler on     |
| ---------- | --------------- | --------------- |
| tests      | 785/785 passing | 784/785 passing |
| statements | 848/848         | 1187/1195       |
| branches   | 393/393         | 728/742         |
| functions  | 298/298         | 292/292         |
| lines      | 774/774         | 922/922         |

The uncovered code is in `src/components/icons.tsx` (lines 42 to 54) and `src/components/DataTable/DataTable.tsx` (lines 109 to 112, 117 and 204). The failing test is "serves a settled order from the cache on the next render" in `useSortedRows`: the hook reads the module-scope order cache inside a memo, and the compiler splits that memo into per-branch slots.

At its default panic threshold the compiler also skips, silently, the component that writes the address. Under `panicThreshold: "all_errors"` the build fails on the ternary inside the address write's `try` (`DatasetPage.tsx`, line 235), which the compiler does not support inside a `try/catch`.

Bundle, from `dist/assets/*.js`: 259,853 bytes raw and 80,635 gzip -9 off, 268,001 and 83,751 on, so +8,148 raw (+3.1%) and +3,116 gzipped (+3.9%). `lib/index.js` is 18,697 bytes either way, because the library build does not carry the plugin.

Re-renders of `TableBody` while typing "san" into the search, counted in a test that stubs the search to return the same rows: 3 off and 0 on, and 6 off against 0 on once the debounce commits. The stub is the compiler's best case, and fewer re-renders are the only thing it gains.

Meeting the gate with coverage-ignore hints, or with tests that execute the generated cache branches, would make the 100% figure stop measuring our code, so neither is used.

## Consequences

`TableBody` keeps re-rendering on each keystroke, over at most one page of rows (ADR 8). The existing memoization stays where it is.

The comment above `plugins` in `vite.config.ts` now points here and no longer rests on the compiler being experimental.

Revisit when the compiler's cache checks stop counting against branch coverage, or when the keystroke re-renders become visible on a real page. Then the work is to hoist the address ternary out of the `try` in `DatasetPage.tsx`, opt `useSortedRows` out with the `"use no memo"` directive or restructure its cache read, install the three packages at exact versions, and set `panicThreshold: "all_errors"` so a skipped component fails the build.
