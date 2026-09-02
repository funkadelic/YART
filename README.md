# Yet Another React Table (YART)

[![codecov](https://codecov.io/gh/funkadelic/YART/branch/main/graph/badge.svg)](https://codecov.io/gh/funkadelic/YART)

A React and TypeScript single-page app for browsing a large dataset in the browser: search, sort, and paginate a list of world cities without a table library.

**[Live demo](https://funkadelic.github.io/YART/)**, published from `main` by the pipeline once every gate passes.

## Contents

- [Features](#features)
  - [Search](#search)
  - [Sorting](#sorting)
  - [Pagination](#pagination)
  - [Shareable links](#shareable-links)
  - [Theme](#theme)
  - [Accessibility](#accessibility)
- [Internationalization](#internationalization)
  - [What ships](#what-ships)
  - [What stays in the source language](#what-stays-in-the-source-language)
- [Stack](#stack)
  - [Build target](#build-target)
- [Data attribution](#data-attribution)
- [Getting started](#getting-started)
- [Usage](#usage)
  - [Props](#props)
  - [Why `getRowId` must be injective](#why-getrowid-must-be-injective)
  - [Why the container debounces](#why-the-container-debounces)
- [Configuring](#configuring)
  - [Columns](#columns)
  - [Sort comparison](#sort-comparison)
  - [Page size options](#page-size-options)
- [Testing](#testing)
- [Scripts](#scripts)
- [Notes and next steps](#notes-and-next-steps)
- [License](#license)

## Features

### Search

- Search cities by city name, ascii name, country name, or country code
- The Capital column is rendered but not searched, because its only values are the upstream classification codes `primary`, `admin`, and `minor`
- Empty state when a search matches nothing
- A failed dataset load replaces the table with the message and a retry control
- Search is debounced by 150ms after the last keystroke, using a hand-rolled `useDebouncedCallback` hook rather than a utility library

### Sorting

- Click any column header to sort
- Each column cycles through ascending, descending, and unsorted
- Sorting resets to the first page so results are never skipped
- Sort state is announced to screen readers through a live region

### Pagination

- Page size defaults to 10 and can be changed at runtime
- Previous and next navigation, plus jumps to the first and last page
- Page size changes reset to the first page

### Shareable links

- The search term, the sort, the page, and the page size all live in the query string, so a view can be copied out of the address bar and reopened as itself
- Four keys: `q`, `sort`, `page`, and `size`. A descending sort is the column id behind a hyphen, so `?sort=-population` is population, largest first
- A value equal to its default is left out, so the plain view is a bare path
- One address is one view, per resolved locale: the query string carries the search term, the sort column and direction, the page and the page size, and the resolved locale is deliberately not among them, so two readers opening the same link see the same rows in the order and the number format their own locale produces. Putting the locale in the address would force the sender's language on the recipient and would make the locale part of the table's view state
- Every parameter is validated on its own and falls back on its own, so `?page=0&size=25` still opens at 25 rows a page
- Written with `replaceState` rather than `pushState`, so one Back press leaves the site instead of walking back through positions nobody asked to record
- Parameters the app does not own, a tracking tag for instance, survive the write untouched

### Theme

- Light, dark, and system, chosen from a three-way control in the header
- System follows the operating system setting and changes with it, with no reload
- An explicit choice survives a reload and follows into the other open tabs
- The theme is resolved before the first paint, so no wrong-theme frame is ever shown

### Accessibility

- Sorting is a real button inside each column header, so Enter and Space work without a mouse, and the button is named for its column alone so a press does not re-announce the whole control
- Icons are hidden from assistive technology, since the header text already carries the meaning
- Live regions announce sort changes and result counts
- The table scrolls horizontally on narrow viewports instead of overflowing
- The theme control is three native radios, so the arrow keys move between them and the whole group is a single tab stop
- Every foreground and background pair is checked against the WCAG contrast ratio in both themes, computed from the shipped stylesheet rather than from a copy of it

Every push sweeps the running app for violations of a set of automated rules and fails on any of them, once against a simulated DOM and once in a real browser across both themes, a paged table and a right-to-left reading direction. Contrast is the reason the second run exists: measuring it needs a layout engine, which the simulated DOM does not have. Automated rules cannot establish conformance, so the sweeps catch regressions rather than prove the list above.

## Internationalization

### What ships

- Four catalogs: English, Spanish, French, and a right-to-left pseudo-locale. The pseudo-locale is readable English, padded and wrapped in direction marks. It ships so the direction and the truncation can be tested, because the other three all read left to right
- A language picker in the header, offering the machine's own preference first and then each catalog named in its own language, so a reader who cannot read the interface in front of them can still find their own
- Every reader-facing string comes from a catalog, the failure messages and the licence attribution included. One key union is derived from the base catalog, so a missing or misspelled key fails the type check rather than rendering at runtime
- The document's language and direction follow the resolved locale, and both are stamped before the first paint, so no wrong-language and no wrong-direction frame is ever shown
- Collation and number formatting follow it too: the city name column sorts by the reader's own language rules and the population column is grouped the way that language groups digits
- Direction-dependent geometry is written on the inline axis, so one stylesheet serves both directions

### What stays in the source language

City and country names stay in their source form in every locale: the dataset carries a name and an ascii name and nothing else, so a reader of the French interface still reads the English country name. Translating them would need a translated column and a regenerated asset, which is a data pipeline rather than an internationalization change.

The static head of the document stays in the base language too. Its title, its description, its two social strings and its no-script paragraph are all served before any module can run, and no catalog can reach them without script.

## Stack

- [TypeScript](https://www.typescriptlang.org) 6
- [React](https://reactjs.org) 19
- [Vite](https://vitejs.dev/) 8
- [Vitest](https://vitest.dev) 4 and [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev) for the end-to-end suite
- [Sass](https://sass-lang.com/) for the CSS Modules stylesheets
- [React Icons](https://react-icons.github.io/react-icons/)
- [axe-core](https://github.com/dequelabs/axe-core) for the accessibility sweeps
- [Chromatic](https://www.chromatic.com/) for the visual regression snapshots
- [ESLint](https://eslint.org/), [Stylelint](https://stylelint.io/), and [Prettier](https://prettier.io/)

### Build target

The browser target follows the Baseline Widely available rule, taken on 2026-08-20:

- Chrome 111 and above
- Edge 111 and above
- Firefox 111 and above
- Safari 16.4 and above

Two places carry these versions and they have to be edited together. The `browserslist` field in `package.json` names them explicitly instead of using a percentage or "not dead" query, so browser support data changes cannot move build output; it governs which vendor prefixes the stylesheet gets. The `build.target` array in `vite.config.ts` repeats them, because the bundler does not read `browserslist`, and it governs which syntax is lowered.

Raising the baseline is a deliberate edit to both lists and to the date above. Nothing asserts that the two agree.

## Data attribution

City data from [simplemaps.com World Cities](https://simplemaps.com/data/world-cities), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified: unused columns removed, rows ordered by population.

The upstream release is World Cities Database (basic) v1.91.3. The full terms ship with the data as `src/data/worldcities/license.txt` and `src/data/worldcities/license.pdf`.

The committed asset is `src/data/worldcities/cities.json`, 50,250 rows. It was serialized by `scripts/generate-cities.mjs` from the row data this repository already carried, not from a fresh run over the upstream CSV export. Later revisions are regenerated by that script from the upstream `worldcities.csv` export, which orders rows by descending population and breaks ties by ascending id, so a regenerated file is not expected to be byte-identical to the committed one. `src/data/worldcities/license.txt` records the same provenance.

## Getting started

Node 24 is required, and `.npmrc` sets `engine-strict=true`, so an older runtime fails the install instead of warning. `.nvmrc` names the version for a version manager to pick up.

```sh
npm ci
npm run dev
```

Then open [http://localhost:5173/](http://localhost:5173/).

The history contains a one-time commit that reformatted every file. Run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once in your clone so `git blame` skips it and keeps pointing at the commit that wrote each line.

## Usage

The table comes in two pieces. `DataTable<T, Id>` renders any collection and holds nothing: sort, page, page size and the committed query all arrive in one object and leave as callbacks describing what the user did. A container decides what the next object is and supplies the columns, the row identity and every string that names what the rows are.

`CityTable` is that container for this app. Writing another one is how the table renders something other than cities.

Start with the columns. `columns<T>()` is curried because TypeScript infers all of a call's type arguments or none of them: the row type is the one thing you know and the compiler cannot guess, so you supply it once and the column id and value type are inferred per call.

```tsx
import { columns } from "./components/DataTable/column";
import { collatorFor, numberFormatFor } from "./i18n/format";

// A builder rather than a constant, because both halves of a column follow the
// reader: the label comes out of the catalog and the population cell is grouped
// by the reader's own rule. The collator is fused into the default comparator
// here, which is what keeps the sort module free of any of this.
export function buildCityColumns(catalog: Catalog, tag: string) {
  const col = columns<City>(collatorFor(tag));
  const number = numberFormatFor(tag);

  return [
    col.key("name", { label: catalog.columnName }),
    col.key("country", { label: catalog.columnCountry }),
    col.key("population", {
      label: catalog.columnPopulation,
      renderCell: (value) => number.format(value),
    }),
  ];
}

// The literal union of the ids above, with no assertion written anywhere. It
// comes off one base build kept at module scope for this purpose alone: which
// columns exist is the same in every language, only what they are called moves.
const BASE_COLUMNS = buildCityColumns(en, "en-US");
export type CityColumnId = (typeof BASE_COLUMNS)[number]["id"];
```

Three of the five columns are shown. `src/features/CityTable/cityColumns.ts` has the whole build.

Call the builder from a component body, never bare during render, and key the memo on exactly the catalog and the tag. A new array identity re-sorts the whole collection and re-slices the page, which over fifty thousand rows is the most expensive thing the container can do by accident.

Every string that names what the rows are comes from the same place, because a shared component carrying one collection's nouns would be shared in name only.

```tsx
export function buildTableLabels(
  catalog: Catalog,
  tag: string,
): DataTableLabels {
  return {
    loading: catalog.loading,
    empty: catalog.empty,
    emptyAnnouncement: catalog.emptyAnnouncement,
    results: (shown, total) => catalog.results(tag, shown, total),
    caption: (total, sortSummary) => catalog.caption(tag, total, sortSummary),
  };
}
```

Five of the entries are shown. The rest, the retry and error copy, the sort announcements and summary, and the whole pagination slice, are built the same way in `src/features/CityTable/cityLabels.ts`; the type is what makes a missing one a compile error.

An entry that weaves a value takes that value rather than an already-composed phrase. A caller handing over a finished word has made a grammatical decision one layer too early, which is what made the old sort summary untranslatable.

Then hold the state and hand it down:

```tsx
import { useCallback, useState } from "react";

import { DataTable } from "./components/DataTable/DataTable";
import {
  DEFAULT_TABLE_STATE,
  applyTableAction,
  type TableState,
} from "./components/DataTable/tableState";

function CityTable({ data, loading, datasetReady, error, onRetry }: Props) {
  const [state, setState] =
    useState<TableState<CityColumnId>>(DEFAULT_TABLE_STATE);

  // The functional updater keeps these dependency arrays empty, so the
  // callbacks hold one identity for the life of the table.
  const handleSort = useCallback((columnId: CityColumnId) => {
    setState((s) => applyTableAction(s, { type: "sort", columnId }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setState((s) => applyTableAction(s, { type: "page", page }));
  }, []);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setState((s) => applyTableAction(s, { type: "pageSize", pageSize }));
  }, []);

  return (
    <DataTable
      rows={data}
      columns={cityColumns}
      getRowId={(city) => String(city.id).padStart(10, "0")}
      state={state}
      onSortChange={handleSort}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      loading={loading}
      datasetReady={datasetReady}
      error={error}
      onRetry={onRetry}
      labels={cityTableLabels}
    />
  );
}
```

### Props

| Prop               | Type                         | Description                                                                                                                                                                                     |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`             | `readonly T[]`               | Rows to display. Already filtered by the caller.                                                                                                                                                |
| `columns`          | `readonly Column<T, Id>[]`   | Built with `columns<T>()`. The id union is inferred from this array alone.                                                                                                                      |
| `getRowId`         | `(row: T) => string`         | Must be injective. See below.                                                                                                                                                                   |
| `state`            | `TableState<Id>`             | Sort column and direction, page, page size, committed query, and whether a sort has ever been applied.                                                                                          |
| `onSortChange`     | `(columnId: Id) => void`     | A header was activated. Feed it to `applyTableAction` to get the next state.                                                                                                                    |
| `onPageChange`     | `(page: number) => void`     | A pagination control was activated.                                                                                                                                                             |
| `onPageSizeChange` | `(pageSize: number) => void` | The page size select changed.                                                                                                                                                                   |
| `loading`          | `boolean`                    | True while a request is in flight. A refetch leaves the table mounted and marks it busy.                                                                                                        |
| `datasetReady`     | `boolean`                    | False until the collection has arrived at least once. The download message renders only while `loading` is true and this is false, so a refetch that returns no rows does not claim a download. |
| `error`            | `Error \| null`              | Renders the error message in place of the table, in a live region so it is announced. Pass `onRetry` alongside it when the failure is not something editing the query can correct.              |
| `onRetry`          | `() => void`                 | Optional. Called when the user activates the retry control. Omit it when the caller has no retry to offer.                                                                                      |
| `labels`           | `DataTableLabels`            | Every rendered string that names what the rows are: `loading`, `empty`, `emptyAnnouncement`, and the `results` and `caption` functions that weave counts into a sentence.                       |

If both `loading` and `error` are set, `error` wins.

Every column is sortable. There is no per-column opt out, because the previous one existed to keep a hand-written `<tbody>` in step with the header array, and neither is hand-written now.

### Why `getRowId` must be injective

It does two jobs: it keys the rows for reconciliation, and it breaks ties between equal values in the sort. Two rows sharing an id lose their identity and their ordering in the same stroke.

It returns a string, and the tiebreak compares that string as text, so an id that is really a number has to be padded to sort as one. Unpadded, `"2"` follows `"1934976309"` and the two lowest ids land at the end of every group of rows whose sorted values are equal. `cityRowId` pads to ten digits for that reason.

### Why the container debounces

`SearchInput` calls `onChange` on every keystroke and `DataTable` renders whatever `rows` it is given. Neither of them knows what a pause in typing means. The container between them does: `CityTable` holds what is in the box, and the one term that typing settles on drives the page reset, the address write, and the request behind it. Swapping the 150ms delay for 300ms, or replacing the simulated API with a real endpoint, touches no table code.

`useDebouncedCallback` debounces the call rather than a value, so it stays usable straight from an event handler. It hands back a scheduler and a cancel:

```tsx
const { schedule, cancel } = useDebouncedCallback(
  commitSearch,
  SEARCH_DEBOUNCE_MS,
);
```

Cancelling covers a back navigation that lands inside the window. Without it, the term the reader typed a moment ago lands on top of the view they navigated back to.

## Configuring

### Columns

Columns are built with `columns<T>()`, which returns two methods. `key` names a field on the row and reads it; `accessor` computes a value the row does not carry:

```tsx
const col = columns<Part>();

col.key("name", { label: "Part" });
col.accessor("total", (row) => row.qty * row.unitPrice, { label: "Total" });
```

`key` is constrained to the row type's own string keys, so a misspelled field is a compile error rather than a column of `undefined`. `accessor` takes any id, because its value is computed and answers to no field.

Ids have to be unique: one collides with another on the key React reconciles a row by, and on the lookup that resolves the sorted column. A builder throws on an id it has already issued, so one builder per column array and a second table takes a second builder.

Both accept `renderCell` and `compare`. Each is handed the column's value already read, so neither has to know where it came from:

```tsx
col.key("population", {
  label: catalog.columnPopulation,
  renderCell: (value) => numberFormatFor(tag).format(value),
  compare: (a, b, direction) => (direction === "asc" ? a - b : b - a),
});
```

Omit `renderCell` and the value is stringified, or left blank if it is nullish. Omit `compare` and the shared comparator runs.

Adding or reordering a column is one edit to the array. The header and the cells both come from the descriptor, so there is no second place to keep in step.

### Sort comparison

The shared comparator takes the direction rather than being flipped by its caller, which is what lets blanks sort last in both directions. Negating a direction-free comparator instead puts every blank first on descending, and on real data that is a first page of empty cells.

It dispatches on the runtime type of the value: numbers compare as numbers, everything else through a single module-scope `Intl.Collator`. There is one collator, built once, because constructing one per comparison is the expensive part.

Rows whose values compare equal are then ordered by `getRowId`, so the result is total: the same rows in the same order however they arrived.

Dates or a custom ordering belong in a column's own `compare`, not in the shared one.

### Page size options

The page size select is populated from `PAGE_SIZE_OPTIONS` in `src/components/DataTable/tableState.ts`, the one place the list is written down. 10 is the default:

```tsx
<select id={pageSizeId} value={pageSize} onChange={handlePageSizeChange}>
  {PAGE_SIZE_OPTIONS.map((size) => (
    <option key={size} value={size}>
      {size}
    </option>
  ))}
</select>
```

Changing the page size, the sort, or the query returns to page 1, so no rows are silently skipped. `applyTableAction` applies that reset once for all three rather than in each of their branches. The first, previous, next, and last controls hide when there is only one page; the page size select stays.

The page position is clamped where it is read, not where it is stored. A result set that narrows renders the last available page; one that widens again restores the user to where they were. Nothing writes a corrected page back into state, which is what lets a position arrive from outside, from a click today or a restored address later.

## Testing

The suite drives the component the way a user does, through roles and labels rather than internals:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect } from "vitest";

it("sorts by population descending on the second activation", async () => {
  const user = userEvent.setup();
  render(<CityTable {...defaultProps} />);

  // The activation lives on the button, the state lives on the cell.
  const header = screen.getByRole("columnheader", { name: /Population/ });
  const sortButton = screen.getByRole("button", { name: "Population" });

  await user.click(sortButton); // ascending
  await user.click(sortButton); // descending

  expect(header).toHaveAttribute("aria-sort", "descending");
});
```

The assertions read `aria-sort`, the same attribute a screen reader announces, so a passing test is evidence the announcement is right.

A second suite under `e2e/` runs in a real browser against a production build, covering five things a simulated DOM cannot show: that reopening a link restores the search, sort and page it carries; that Back and Forward move through history the way the shareable-link design intends; that the theme and the language are stamped before the first paint rather than after the page loads; that the dataset arrives over the network as a separate content-hashed asset; and how the table actually renders, captured as snapshots for visual comparison.

The pipeline sends three reports to [Codecov](https://codecov.io/gh/funkadelic/YART): the coverage the hundred percent gate is measured on, a JUnit report from each of the three suites, and the size of every emitted asset. A test that fails intermittently is flagged as a flake. The asset sizes come from Codecov's standalone analyzer, which reports assets and not individual modules.

## Scripts

| Script                    | What it does                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `npm run dev`             | Start the dev server with hot reload                                  |
| `npm run build`           | Build the production bundle                                           |
| `npm run preview`         | Serve the built bundle locally                                        |
| `npm test`                | Run the test suite once                                               |
| `npm run test:watch`      | Run the test suite in watch mode                                      |
| `npm run test:coverage`   | Run the test suite once with coverage, which CI enforces at 100%      |
| `npm run test:browser`    | Run the accessibility checks in a real Chromium                       |
| `npm run test:e2e`        | Run the end-to-end suite in a real Chromium against a built bundle    |
| `npm run chromatic`       | Upload the snapshots the end-to-end run archived, for visual review   |
| `npm run typecheck`       | Check types without emitting output                                   |
| `npm run lint`            | Run ESLint then Stylelint; a warning fails it (`lint:fix` to autofix) |
| `npm run format`          | Run Prettier                                                          |
| `npm run format:check`    | Check formatting without rewriting anything                           |
| `npm run generate:cities` | Regenerate the committed dataset asset from the upstream CSV export   |

`npm run test:browser` and `npm run test:e2e` both drive a real Chromium. `npm ci` downloads neither that browser nor the system libraries it needs, so a clean clone fetches both once with `npx playwright install --with-deps --only-shell chromium`, whose `--with-deps` half needs `sudo` on Linux. CI runs that same command, so every path installs the same binary.

`npm run test:e2e` serves a production build rather than making one, so run `npm run build` first. Without a build it stops in well under a second and names the command to run.

Both are optional for ordinary development. `npm test` runs the same accessibility checks as `npm run test:browser` against a simulated DOM and needs nothing extra.

The three suites CI runs each write a JUnit report into `junit/`, which is gitignored. Nothing local reads them; they exist for the upload.

## Notes and next steps

There is no server. `getCities` fakes network latency over an array held in memory, so everything below is what a real backend would change. Worth doing before it ships:

- The dataset arrives as a separate content-hashed JSON asset rather than being compiled into the bundle, but filtering and sorting still run over the whole result set on the main thread. That is fine at this size. Past it, the work belongs behind a paginated, sorted API rather than in the browser.
- Every row renders, so a page size of 100 is 100 rows in the DOM and there is no way to ask for all 50,250. Virtualization would fix both.
- Sorting multiple columns at once is not implemented.

## License

The source in this repository is MIT licensed; see `LICENSE`.

The city dataset is not covered by that license. It is redistributed from SimpleMaps under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and keeps those terms, which the Data attribution section above states.
