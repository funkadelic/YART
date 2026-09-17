# Front-end practices

This repo exists to show what a table app looks like when the usual corners are not cut. The practices it weighed and skipped are recorded here beside the ones it adopted, because the answers change as the app grows and a commit message is a poor place to find them later.

The per-decision records are in [decision records](adr/README.md).

## Already in place

- 100% coverage as a hard gate, plus mutation testing run by hand to check the tests assert something.
- Accessibility checked twice: axe under jsdom and axe in a real browser, since contrast needs a layout engine.
- Four locales including a right-to-left pseudo-locale, with every rendered string arriving as a prop and no physical inline-axis property in any stylesheet.
- An end-to-end suite against a production build, with visual regression snapshots.
- Design tokens generated from a single source, with the generated stylesheet committed and guarded against drift.

## Adopted

- **Property-based tests.** The pure modules have laws: a state written into the address and read back is the state it started as, apart from the search term, which the address trims; a page slice never exceeds the page size; sorting is a permutation of its input. An example test asserts the cases someone thought of, while a property test states the law and lets the runner hunt for a counterexample. The seed is pinned so a failure is reproducible and CI does not flake.
- **Forced-colors support.** Windows High Contrast replaces the app's colors, and the usual result is that borders and focus rings disappear, because both are painted with colors the user agent has thrown away. axe cannot test this, so nothing here covered it before.
- **Row semantics for the whole dataset.** The table renders one page, so assistive technology was told how many rows that page holds rather than how many the search found. `aria-rowcount` and `aria-rowindex` describe the full set and the absolute position of each row.
- **Decision records.** The arguments behind the structure lived in planning files that are not committed, which left a reader with conclusions and no reasoning.
- **An interaction latency gate.** `e2e/latency.spec.ts` slows the processor fourfold and fails CI when the median time to sort, page, change the page size, type a search or show its results goes over a budget set from a measured baseline. Sorting the whole dataset is the known outlier, at about 330 ms against a 500 ms budget, because the sort runs synchronously inside the click.

## Weighed and deferred

Each has a cost, and each has a trigger that would change the answer.

### Sorting and filtering in a worker

Sorting the full dataset is roughly 800,000 comparisons on the main thread. A worker is the honest answer at scale, and it is the first thing a reviewer looks for.

It is deferred because the boundary is not free: rows have to be copied to the worker and back, which can cost more than the sort saves at this size. The version worth building is one where the worker owns the dataset and returns row ids, and the measurement is what to publish.

Revisit with the numbers: measure the current sort, then measure the worker.

### Row virtualization

Covered in [record 8](adr/0008-no-row-virtualization.md). Pagination bounds the DOM, so the case for it here is about what a reviewer expects to see rather than about a problem the app has.

### Running the end-to-end suite on more than one engine

The suite runs in Chromium. Safari is where a client-only app breaks, and `light-dark()` plus logical properties are exactly the surface where engines disagree.

It is deferred on cost and on a constraint: CI installs one browser binary on purpose, and every spec pulls a multi-megabyte dataset with a single worker, so the wall clock grows with each engine added. Adding an engine means rewriting that constraint rather than quietly breaking it.

Revisit when a bug reaches a reader through an engine the suite never runs.
