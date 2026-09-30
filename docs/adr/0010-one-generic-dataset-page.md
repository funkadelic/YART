# 10. One generic page serves both datasets

Status: accepted
Date recorded: 2026-09-29

## Context

Each page had its own app root and its own table container: `App` and `CityTable` for cities, `FilmsApp` and `FilmTable` for films. Within each pair the two files differed only in identifiers: the row type, the column module, the stylesheet import and the domain string. The two container stylesheets were byte-identical.

Sonar's copy detector read the four files as 198 duplicated lines and failed its gate on them, so they sat behind `sonar.cpd.exclusions`, with the same four paths in fallow's `duplicates.ignore` and a test in `src/toolchain.test.ts` holding the two lists together. Each file carried a note deferring the merge until a third table arrived.

The committed search term lived in three places: the root's state, the container's view state and the address. An upward `onSearchChange` callback, a report from the back-navigation handler and a root-level `parseSearchTerm` read existed only to keep those three equal.

## Decision

One generic component, `DatasetPage`, holds the request reducer and renders the layout around an inner view that owns the fetch effect, the view state, the search debounce, the address write and the back-navigation listener. Each entry passes it a module-scope config with five fields, `search`, `buildColumns`, `getRowId`, `columnIds` and `domain`, declared in `src/features/cities/` or `src/features/films/`. The fetch is keyed on the committed term held in the view state, so that term has one owner.

Waiting for a third table was rejected: the carve-outs, the guard holding them together and the two parallel sets of test suites already cost more than the abstraction does. Lifting the shared logic into hooks was rejected too, because it would leave two components that still differ only in identifiers.

## Consequences

The tree has one address writer and one owner for the search term. The copy-detector carve-outs and their guard are gone, which also means nothing now fails if an exclusion is added back.

A config has to stay reachable from exactly one entry. Imported from both, its dataset lands in the chunk the two entries share, and the build's preload step throws on an entry with no dataset of its own. The per-dataset folders carry no barrel for that reason.

Everything built from the address sits under the error boundary, so a reset remounts the view from the last committed address. The fetched rows stay above it, so recovery repaints them at once and the remount re-issues the search over the dataset already in memory. The suites drive the page through an injected search. The request and address suites cover both configs, and each dataset keeps a suite for its own columns and copy.

Revisit this when a dataset needs behavior a config field cannot express. The closing paragraph of record 1, about a third shell, is left as written, and nothing is superseded.
