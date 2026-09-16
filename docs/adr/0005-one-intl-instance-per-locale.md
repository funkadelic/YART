# 5. One Intl instance per locale, built in one module

Status: accepted
Date recorded: 2026-09-15

## Context

Sorting 50,250 rows is roughly 800,000 comparisons. Constructing an
`Intl.Collator` inside the comparison function builds 800,000 collators for one
sort. Formatting a number inside a cell builds one formatter per cell per
render. Both are easy to write by accident and neither shows up as anything
except a slow page.

## Decision

`src/i18n/format.ts` is the only module that constructs a platform locale
object. It caches one collator, one number formatter and one plural rules
instance per resolved language tag, keyed by tags drawn from a four-entry frozen
record, so the cache has a fixed ceiling rather than one that grows with input.

The column builder fuses a collator into each comparator when the columns are
built. The comparison helper takes a collator as a parameter and holds none.

## Consequences

The component layer never reaches the locale layer, and a collator handed to it
is a value rather than a dependency.

Two lint rules fail the build when any non-test module outside that one file
constructs an `Intl` object or calls a locale-aware helper such as
`toLocaleString` or `localeCompare`. Two claims sit outside what a lint rule can
express and live in `src/toolchain.test.ts` instead: the inline script in the
HTML shells, which ESLint does not lint, and the positive claim that the
formatter module still builds all three cached instances.

Columns are rebuilt when the language changes, in a memo keyed on the catalog
and the tag. A rebuild on any other render re-sorts the whole dataset for
nothing, so a test counts the builds.
