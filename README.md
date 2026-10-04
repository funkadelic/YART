# Yet Another React Table (YART)

[![codecov](https://codecov.io/gh/funkadelic/YART/branch/main/graph/badge.svg)](https://codecov.io/gh/funkadelic/YART)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://app.codspeed.io/funkadelic/YART?utm_source=badge)

A React and TypeScript single-page app for browsing large datasets in the browser: search, sort, and paginate world cities or films without a table library. The table is also published to npm as `yet-another-react-table`, and this demo consumes it through the same entry.

**[Live demo](https://funkadelic.github.io/YART/)**, published from `main` by the pipeline once every gate passes. A second table over a films dataset is served beside it at **[`movies.html`](https://funkadelic.github.io/YART/movies.html)**, and everything described below holds for both pages. The header links each page to the other.

## Contents

- [Features](#features)
  - [Search](#search)
  - [Sorting](#sorting)
  - [Pagination](#pagination)
  - [Shareable links](#shareable-links)
  - [Theming](#theming)
  - [Accessibility](#accessibility)
  - [Internationalization](#internationalization)
    - [What ships](#what-ships)
    - [What stays in the source language](#what-stays-in-the-source-language)
- [Stack](#stack)
- [Browser support](#browser-support)
- [Getting started](#getting-started)
- [Usage](#usage)
  - [Installing](#installing)
  - [Styling](#styling)
  - [A minimal table](#a-minimal-table)
  - [Adding search](#adding-search)
  - [Labels](#labels)
  - [Props](#props)
  - [Table state](#table-state)
  - [What `getRowId` has to guarantee](#what-getrowid-has-to-guarantee)
  - [Adding a dataset to this app](#adding-a-dataset-to-this-app)
- [Configuring](#configuring)
  - [Columns](#columns)
  - [Sort comparison](#sort-comparison)
  - [Page size options](#page-size-options)
- [Design notes](#design-notes)
  - [Why `columns<T>()` is curried](#why-columnst-is-curried)
  - [Why the column builders follow the locale](#why-the-column-builders-follow-the-locale)
  - [Why label entries take values](#why-label-entries-take-values)
  - [Why every column is sortable](#why-every-column-is-sortable)
  - [Why the container debounces](#why-the-container-debounces)
  - [Why the comparator takes the direction](#why-the-comparator-takes-the-direction)
  - [Why the page is clamped where it is read](#why-the-page-is-clamped-where-it-is-read)
- [Testing](#testing)
  - [Unit tests](#unit-tests)
  - [Integration tests](#integration-tests)
  - [Code coverage](#code-coverage)
  - [Mutation testing](#mutation-testing)
  - [Visual regression tests](#visual-regression-tests)
  - [Static analysis](#static-analysis)
- [Benchmarks](#benchmarks)
- [Scripts](#scripts)
- [Decisions](#decisions)
- [Notes and next steps](#notes-and-next-steps)
- [License](#license)
- [Data attribution](#data-attribution)

## Features

### Search

- Search cities by city name, ascii name, country name, or country code
- The Capital column is rendered but not searched, because its only values are the upstream classification codes `primary`, `admin`, and `minor`
- Search films by title only, so a director or genre a reader types matches nothing
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

### Theming

- Light, dark, and system, chosen from a three-way control in the header
- System follows the operating system setting and changes with it, with no reload
- An explicit choice survives a reload and follows into the other open tabs
- The theme is resolved before the first paint, so no wrong-theme frame is ever shown
- Both themes are generated by [Style Dictionary](https://styledictionary.com/) from [DTCG](https://www.designtokens.org/) design tokens in `tokens/`

### Accessibility

- Sorting is a real button inside each column header, so Enter and Space work without a mouse, and the button is named for its column alone so a press does not re-announce the whole control
- Icons are hidden from assistive technology, since the header text already carries the meaning
- Live regions announce sort changes and result counts
- Each row reports its position in the whole result set rather than its position on the page
- Under forced colors the borders, the focus ring and the chosen theme segment are repainted from the reader's own palette
- The table scrolls horizontally on narrow viewports instead of overflowing
- The theme control is three native radios, so the arrow keys move between them and the whole group is a single tab stop
- Every foreground and background pair is checked against the WCAG contrast ratio in both themes, computed from the shipped stylesheet rather than from a copy of it

Every push sweeps the running app for violations of a set of automated rules and fails on any of them, once against a simulated DOM and once in a real browser across both themes, a paged table and a right-to-left reading direction. Contrast is the reason the second run exists: measuring it needs a layout engine, which the simulated DOM does not have. Automated rules cannot establish conformance, so the sweeps catch regressions rather than prove the list above.

### Internationalization

#### What ships

- Four catalogs: English, Spanish, French, and a right-to-left pseudo-locale. The pseudo-locale is readable English, padded and wrapped in direction marks. It ships so the direction and the truncation can be tested, because the other three all read left to right
- A language picker in the header, offering the machine's own preference first and then each catalog named in its own language, so a reader who cannot read the interface in front of them can still find their own
- Every reader-facing string comes from a catalog, the failure messages and the licence attribution included. One key union is derived from the base catalog, so a missing or misspelled key fails the type check rather than rendering at runtime
- The document's language and direction follow the resolved locale, and both are stamped before the first paint, so no wrong-language and no wrong-direction frame is ever shown
- Collation and number formatting follow it too: the city name column sorts by the reader's own language rules and the population column is grouped the way that language groups digits
- Direction-dependent geometry is written on the inline axis, so one stylesheet serves both directions

#### What stays in the source language

City and country names stay in their source form in every locale. The dataset carries a name and an ascii name and nothing else, so a reader of the French interface still reads the English country name. Translating them would need a translated column and a regenerated asset, which is a data pipeline rather than an internationalization change.

Film, director, genre and country names stay in their source form in every locale. The query asks for English labels and nothing else, so a reader of the French interface still reads the English genre name. Translating them would need a translated label per property and a regenerated asset, which is a data pipeline rather than an internationalization change.

The static head of the document stays in the base language too. Its title, its description, its two social strings and its no-script paragraph are all served before any module can run, and no catalog can reach them without script.

## Stack

- [TypeScript](https://www.typescriptlang.org) 6
- [React](https://reactjs.org) 19
- [Vite](https://vitejs.dev/) 8
- [Vitest](https://vitest.dev) 5 and [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev) for the end-to-end suite
- [Sass](https://sass-lang.com/) for the CSS Modules stylesheets
- [Style Dictionary](https://styledictionary.com/) for the design tokens, written in the [DTCG](https://www.designtokens.org/) format
- [React Icons](https://react-icons.github.io/react-icons/)
- [axe-core](https://github.com/dequelabs/axe-core) for the accessibility sweeps
- [Chromatic](https://www.chromatic.com/) for the visual regression snapshots
- [Lighthouse](https://developer.chrome.com/docs/lighthouse) for the advisory performance audit
- [CodSpeed](https://codspeed.io/) and [tinybench](https://github.com/tinylibs/tinybench) for the benchmarks
- [ESLint](https://eslint.org/), [Stylelint](https://stylelint.io/), and [Prettier](https://prettier.io/)

## Browser support

The table and the demo support:

- Chrome 123 and above
- Edge 123 and above
- Firefox 120 and above
- Safari 17.5 and above

These are the first versions with native `light-dark()`, which is what lets the table follow the page's color scheme. [Decision record 13](docs/adr/0013-floor-at-native-light-dark.md) has the reasoning.

`BUILD_TARGET` in `vite.shared.ts` is the one place these versions live, shared by the app build and the library build. It names them explicitly instead of taking the bundler default, so a Vite upgrade cannot change which browsers the output targets. Lightning CSS minifies the stylesheet against the same targets, so the array decides both which syntax is lowered and which vendor prefixes the stylesheet gets.

To raise the floor, edit that array and the list above.

## Getting started

Node 24 is required through `devEngines` in `package.json`. npm 10.9 or later checks it and stops `npm ci`, `npm install` and `npm run` on an older runtime; an older npm ignores the field. `.nvmrc` names the version for a version manager to pick up.

```sh
npm ci
npm run dev
```

Then open [http://localhost:5173/](http://localhost:5173/).

The history contains a one-time commit that reformatted every file. Run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once in your clone so `git blame` skips it and keeps pointing at the commit that wrote each line.

## Usage

The table comes in two pieces. `DataTable<T, Id>` renders any collection and holds no state: the sort, the page, the page size and the search term arrive in one `state` object, and every user action comes back out as a callback. The component above it, the container, keeps that object and decides what comes next. In this app the container is `DatasetPage`.

### Installing

```sh
npm install yet-another-react-table
```

React is a peer dependency, at the range the package declares. Import the components and helpers from the package root, and the stylesheet once anywhere in the app:

```tsx
import { DataTable, columns } from "yet-another-react-table";
import "yet-another-react-table/styles.css";
```

The package is ESM only. Its entry opens with a `"use client"` directive, so a server-component framework treats the table as a client component. That marks every export as client code, the helpers included: in a React Server Components app, call `parseTableState`, `serializeTableState`, `applyTableAction`, `DEFAULT_TABLE_STATE` and the English labels from a client component, not a server one. A TypeScript project whose bundler does not declare CSS imports adds `declare module "*.css";` to a declaration file.

`columns<T>()` takes an `Intl.Collator` that the app builds, so the sort follows whichever language the app picks.

### Styling

The table takes every color, spacing, font size and corner radius from CSS custom properties, and those properties are the stable contract. The stylesheet's class names, `yart-<Component>__<class>`, are best-effort and may change in any release, so override through the properties rather than the classes.

| Family    | Properties                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Color     | `--yart-color-surface`, `--yart-color-surface-raised`, `--yart-color-surface-hover`, `--yart-color-text`, `--yart-color-text-muted`, `--yart-color-border`, `--yart-color-border-strong`, `--yart-color-rule`, `--yart-color-accent`, `--yart-color-error`, `--yart-color-focus-ring`, `--yart-color-brand`, `--yart-color-brand-contrast` |
| Space     | `--yart-space-1`, `--yart-space-1-5`, `--yart-space-2`, `--yart-space-2-5`, `--yart-space-3`, `--yart-space-4`, `--yart-space-5`, `--yart-space-6`, `--yart-space-8`, `--yart-space-10`, `--yart-space-11`                                                                                                                                 |
| Font size | `--yart-font-size-sm`, `--yart-font-size-base`, `--yart-font-size-lg`, `--yart-font-size-xl`, `--yart-font-size-2xl`                                                                                                                                                                                                                       |
| Radius    | `--yart-radius-sm`, `--yart-radius-md`                                                                                                                                                                                                                                                                                                     |

The defaults live in `@layer yart`, so any unlayered rule overrides one without a specificity contest:

```css
:root {
  --yart-color-accent: #6d28d9;
}
```

Light and dark follow the page's `color-scheme`, set on the root or on any ancestor of the table. There is no attribute to set.

Forced colors mode is handled by the package. Its remap sits outside the layer on `:root:root:root`, so it beats a `:root` override like the one above, or a themed one such as `:root[data-theme="dark"]`, whatever order the stylesheets load in. A host rule more specific than that, or an override set on an element below the root, still wins under forced colors, so a host that writes one should remap it too.

The table draws no focus ring of its own and cancels none, so the browser's or the host's focus style applies. `--yart-color-focus-ring` is there for a host that wants the ring in the table's palette.

### A minimal table

```tsx
import { useCallback, useState } from "react";
import {
  DataTable,
  DEFAULT_TABLE_STATE,
  applyTableAction,
  columns,
  englishTableLabels,
  type TableState,
} from "yet-another-react-table";
import "yet-another-react-table/styles.css";

interface Part {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
}

// Built once at module scope, so the array keeps one identity.
const col = columns<Part>(new Intl.Collator("en-US"));
const PART_COLUMNS = [
  col.key("name", { label: "Part" }),
  col.key("qty", { label: "Quantity", numeric: true }),
  col.accessor("total", (part) => part.qty * part.unitPrice, {
    label: "Total",
    numeric: true,
  }),
];
type PartColumnId = (typeof PART_COLUMNS)[number]["id"];

// Unique per row, and declared at module scope for a stable identity.
const partId = (part: Part) => part.sku;

export function PartsTable({ parts }: { parts: readonly Part[] }) {
  const [state, setState] =
    useState<TableState<PartColumnId>>(DEFAULT_TABLE_STATE);

  const onSortChange = useCallback((columnId: PartColumnId) => {
    setState((s) => applyTableAction(s, { type: "sort", columnId }));
  }, []);
  const onPageChange = useCallback((page: number) => {
    setState((s) => applyTableAction(s, { type: "page", page }));
  }, []);
  const onPageSizeChange = useCallback((pageSize: number) => {
    setState((s) => applyTableAction(s, { type: "pageSize", pageSize }));
  }, []);

  return (
    <DataTable
      rows={parts}
      columns={PART_COLUMNS}
      getRowId={partId}
      state={state}
      onSortChange={onSortChange}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      loading={false}
      datasetReady
      errorMessage={null}
      labels={englishTableLabels}
    />
  );
}
```

Hold the state with `useState` and turn each callback into the next state with `applyTableAction`. The rows here are a fixed array, so `loading` is false and `datasetReady` is true from the start. Declare the column array and `getRowId` at module scope, or in a `useMemo`, so they keep one identity across renders: the table sorts again whenever either changes.

### Adding search

`DataTable` does not filter. Keep the committed term in `state.query`, filter the rows yourself, and pass the result as `rows`. A `query` action also returns the table to page 1.

```tsx
import { SearchInput, englishSearchLabels } from "yet-another-react-table";

const [term, setTerm] = useState("");

const handleSearch = useCallback((next: string) => {
  setTerm(next);
  setState((s) => applyTableAction(s, { type: "query", query: next.trim() }));
}, []);

const matching = useMemo(() => {
  const needle = state.query.toLowerCase();
  return parts.filter((part) => part.name.toLowerCase().includes(needle));
}, [parts, state.query]);

const searchBox = (
  <SearchInput
    value={term}
    onChange={handleSearch}
    labels={englishSearchLabels}
  />
);
```

`term` is what the box shows and `state.query` is the trimmed term the rows are filtered by. `SearchInput` is optional; any input that dispatches a `query` action works. Over a large collection, delay the `query` action with `useDebouncedCallback`, as `DatasetPage` does at 150 ms.

### Labels

The package exports English copy for both components, `englishTableLabels` and `englishSearchLabels`. It names no dataset, so spread it and override the entries that should:

```tsx
import {
  englishTableLabels,
  type DataTableLabels,
} from "yet-another-react-table";

const PART_LABELS: DataTableLabels = {
  ...englishTableLabels,
  empty: "No parts match the search.",
  pagination: { ...englishTableLabels.pagination, pageSize: "Parts per page" },
};
```

`DataTable` renders no text of its own. Every string comes from the `labels` prop. An entry that includes a number or a column name is a function, so each language can build the sentence its own way.

| Entry                     | Type                                 | Where it appears                                                       |
| ------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `loading`                 | `string`                             | In place of the table until the rows have arrived once                 |
| `empty`                   | `string`                             | In place of the table when the search matches nothing                  |
| `emptyAnnouncement`       | `string`                             | Announced by the results live region for that same empty result        |
| `results`                 | `(shown, total) => string`           | The results region: rows on this page out of rows matched              |
| `caption`                 | `(total, sortSummary) => string`     | The table caption; `sortSummary` is the output of the next two entries |
| `unsorted`                | `string`                             | Passed to `caption` while no column is sorted                          |
| `sortSummary`             | `(columnLabel, direction) => string` | Passed to `caption` while a column is sorted                           |
| `sortedAnnouncement`      | `(columnLabel, direction) => string` | Announced after a column is sorted                                     |
| `sortClearedAnnouncement` | `string`                             | Announced after a sort is removed                                      |
| `error`                   | `(message) => string`                | The error alert, wrapping the `errorMessage` prop                      |
| `retry`                   | `string`                             | The retry button, shown when `onRetry` is passed                       |
| `pagination`              | `PaginationLabels`                   | The page controls, below                                               |

`PaginationLabels`:

| Entry                                               | Type                           | Where it appears                                        |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| `pageSize`                                          | `string`                       | The label of the page size select                       |
| `navigation`                                        | `string`                       | The accessible name of the landmark around the controls |
| `firstPage`, `previousPage`, `nextPage`, `lastPage` | `string`                       | Each button's tooltip and accessible name               |
| `pageStatus`                                        | `(page, totalPages) => string` | The live region beside the controls                     |

`SearchInput` takes its own two: `name`, the accessible name, and `placeholder`.

### Props

| Prop               | Type                                                                         | Description                                                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rows`             | `readonly T[]`                                                               | Rows to display, already filtered by the caller.                                                                                                                                                                               |
| `columns`          | `readonly Column<T, Id>[]`                                                   | Built with `columns<T>()`. The id union is inferred from this array alone.                                                                                                                                                     |
| `getRowId`         | `(row: T) => string`                                                         | Must be unique per row and keep one identity across renders. See below.                                                                                                                                                        |
| `state`            | `TableState<Id>`                                                             | The sort, page, page size and search term. See Table state.                                                                                                                                                                    |
| `onSortChange`     | `(columnId: Id) => void`                                                     | A header was activated. Feed it to `applyTableAction` to get the next state.                                                                                                                                                   |
| `onPageChange`     | `(page: number) => void`                                                     | A pagination control was activated.                                                                                                                                                                                            |
| `onPageSizeChange` | `(pageSize: number) => void`                                                 | The page size select changed.                                                                                                                                                                                                  |
| `loading`          | `boolean`                                                                    | True while a request is in flight. A refetch leaves the table mounted and marks it busy.                                                                                                                                       |
| `datasetReady`     | `boolean`                                                                    | False until the collection has arrived at least once. The `loading` label renders only while `loading` is true and this is false, so a refetch that returns no rows does not claim a download.                                 |
| `errorMessage`     | `string \| null`                                                             | Renders in place of the table, in a live region so it is announced. Text, not an error object, so no component tier sees a cause. Pass `onRetry` alongside it when the failure is not something editing the query can correct. |
| `onRetry`          | `() => void`                                                                 | Optional. Called when the user activates the retry control. Omit it when the caller has no retry to offer.                                                                                                                     |
| `onSortSettled`    | `(sortColumnId: Id \| null, sortDirection: "asc" \| "desc" \| null) => void` | Optional. Called whenever the sort in `state` becomes the order on screen. A first sort over more than 5,000 rows finishes across frames, so a caller writing the address can wait for this.                                   |
| `labels`           | `DataTableLabels`                                                            | Every string the table renders. See Labels.                                                                                                                                                                                    |

If both `loading` and `errorMessage` are set, `errorMessage` wins. Every column is sortable.

### Table state

| Field           | Type                      | Default | Meaning                                                                                      |
| --------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `sortColumnId`  | `Id \| null`              | `null`  | The sorted column                                                                            |
| `sortDirection` | `"asc" \| "desc" \| null` | `null`  | Its direction                                                                                |
| `page`          | `number`                  | `1`     | The page, counted from 1                                                                     |
| `pageSize`      | `number`                  | `10`    | Rows per page, one of `PAGE_SIZE_OPTIONS`                                                    |
| `query`         | `string`                  | `""`    | The committed search term                                                                    |
| `hasSorted`     | `boolean`                 | `false` | True once a sort has been applied, even if it was removed again, so the removal is announced |

Start from `DEFAULT_TABLE_STATE` and move it only through `applyTableAction`, which takes four actions: `sort`, `page`, `pageSize` and `query`. Sorting the same column cycles ascending, descending, unsorted; a different column starts ascending. A `sort`, `pageSize` or `query` action returns the table to page 1.

### What `getRowId` has to guarantee

It does two jobs: it keys the rows for reconciliation, and it breaks ties between equal values in the sort. So no two rows may share an id. If two do, React can reuse one row's DOM for the other, and the tiebreak cannot order the pair.

It returns a string, and the tiebreak compares that string as text, so an id that is really a number has to be padded to sort as one. Unpadded, `"2"` sorts after `"1934976309"`, so the city with id 2 comes after every city it ties with. `cityRowId` pads to ten digits for that reason.

The function itself has to keep one identity across renders, which is why `cityRowId` is declared at module scope. The sort cache and the background sort both key on it, so passing a new function on every render re-sorts the rows each time, and above 5,000 rows it restarts a sort that is still running.

### Adding a dataset to this app

Each page passes `DatasetPage` one config:

```tsx
export const CITY_PAGE: DatasetConfig<City, CityColumnId> = {
  domain: "cities",
  search: getCities,
  buildColumns: buildCityColumns,
  getRowId: cityRowId,
  columnIds: CITY_COLUMN_IDS,
};

createRoot(container).render(
  <StrictMode>
    <DatasetPage config={CITY_PAGE} />
  </StrictMode>,
);
```

A config is declared at module scope because the identities of its functions key the page's memos and its fetch. `DatasetPage` adds what the minimal example leaves out: the fetch and its retry, the address sync, the search debounce, and the translated labels.

A third dataset takes these steps, with the films page as the model for each:

1. **Data.** Under `src/data/<name>/`, the row type, a row parser and search key, and one call to `createEnvelopeLoader` from `src/data/loadEnvelope.ts`. Import the JSON for its URL, never as a value, and add it to `.prettierignore` and to `sonar.exclusions`.
2. **Search.** `src/api/get<Name>.ts`, like `src/api/getFilms.ts`.
3. **Columns.** `src/features/<name>/<name>Columns.ts`: a `build<Name>Columns(catalog, tag)` builder, the column id union taken from one base build, and a unique `getRowId`. See `src/features/films/filmColumns.ts`.
4. **Config.** `src/features/<name>/<name>Page.ts`, with no barrel file. Import it from one entry only: imported from two, its dataset lands in their shared chunk and the build fails.
5. **Copy.** A block for the new domain in each of the four catalogs in `src/i18n/catalogs/`. The English catalog's keys define `DomainId`, so the header nav fails to compile until it links the new page. Add the data source to the footer's credits as well.
6. **Shell.** An HTML file at the repo root copied from `movies.html`, inline theme and locale script included, plus an entry module like `src/movies.tsx`. Add the shell to `build.rollupOptions.input` in `vite.config.ts` and to `SHELLS` in `src/toolchain.test.ts`, and raise `COMMITTED_SHELLS` beside it. [Decision record 1](docs/adr/0001-two-html-shells.md) names a third shell as the point where a router becomes worth adding.

## Configuring

### Columns

Columns are built with `columns<T>()`, which returns two methods. `key` names a field on the row and reads it; `accessor` computes a value the row does not carry:

```tsx
const col = columns<Part>(new Intl.Collator("en-US"));

col.key("name", { label: "Part" });
col.accessor("total", (row) => row.qty * row.unitPrice, { label: "Total" });
```

`key` is constrained to the row type's own string keys, so a misspelled field is a compile error rather than a column of `undefined`. `accessor` takes any id, because its value is computed and answers to no field.

Ids have to be unique. A builder throws on an id it has already issued, so use one builder per column array.

| Option       | Type                          | Default                                                                  |
| ------------ | ----------------------------- | ------------------------------------------------------------------------ |
| `label`      | `string`                      | Required. The header text and the column's name in sort announcements    |
| `numeric`    | `boolean`                     | `false`. When true, cells align to the end and use tabular figures       |
| `renderCell` | `(value, row) => ReactNode`   | The value as a string, or an empty cell when it is `null` or `undefined` |
| `compare`    | `(a, b, direction) => number` | The shared comparator, below                                             |
| `width`      | `string`                      | Unused. Declared for a future row virtualizer                            |

`renderCell` and `compare` receive the column's value already read, so neither has to know where it came from:

```tsx
const COUNT = new Intl.NumberFormat("en-US");

col.key("qty", {
  label: "Quantity",
  numeric: true,
  renderCell: (value) => COUNT.format(value),
  compare: (a, b, direction) => (direction === "asc" ? a - b : b - a),
});
```

A custom `compare` gets the direction and returns the order for that direction, so it decides where blank values go. Rows it calls equal are still ordered by `getRowId` afterward.

The header and the cells both come from the column array, so adding or reordering a column is one edit.

### Sort comparison

A column without its own `compare` uses the shared comparator in `src/components/compareRows.ts`. Numbers compare as numbers, everything else goes through the collator passed to `columns<T>()`, and blank values (`""`, `null`, `undefined` and `NaN`) sort last in both directions. Rows that compare equal are ordered by `getRowId`, so the same rows always come out in the same order.

Construct the collator once and reuse it; building one inside each comparison is what makes a sort slow. This app keeps one per language through `collatorFor` in `src/i18n/format.ts`. Put dates or a custom ordering in a column's own `compare`.

### Page size options

The page size select offers `PAGE_SIZE_OPTIONS`, a package export whose list the package fixes: 10, 25, 50 and 100. The default is `DEFAULT_TABLE_STATE.pageSize`, 10, and it has to be one of the options. The same list validates `size` in the address, so a link naming a size that was removed opens at the default.

The first, previous, next and last controls hide when there is only one page; the page size select stays. A page past the end of the results shows the last page without changing the stored page.

## Design notes

### Why `columns<T>()` is curried

`columns<T>()` is curried because TypeScript infers all of a call's type arguments or none of them: the row type is the one thing you know and the compiler cannot guess, so you supply it once and the column id and value type are inferred per call.

### Why the column builders follow the locale

```tsx
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

Call the builder from a component body, never bare during render, and key the memo on exactly the catalog and the tag. A new array identity re-sorts the whole collection and re-slices the page, which over fifty thousand rows is the most expensive thing the container can do by accident.

### Why label entries take values

An entry that weaves a value takes that value rather than an already-composed phrase. A caller handing over a finished word has made a grammatical decision one layer too early, which is what made the old sort summary untranslatable.

### Why every column is sortable

There is no per-column opt out, because the previous one existed to keep a hand-written `<tbody>` in step with the header array, and neither is hand-written now.

### Why the container debounces

`SearchInput` calls `onChange` on every keystroke and `DataTable` renders whatever `rows` it is given. Neither of them knows what a pause in typing means. The container between them does: `DatasetView` holds what is in the box, and the one term that typing settles on drives the page reset, the address write, and the request behind it. Swapping the 150ms delay for 300ms, or replacing the simulated API with a real endpoint, touches no table code.

`useDebouncedCallback` debounces the call rather than a value, so it stays usable straight from an event handler. It hands back a scheduler and a cancel:

```tsx
const { schedule, cancel } = useDebouncedCallback(
  commitSearch,
  SEARCH_DEBOUNCE_MS,
);
```

Cancelling covers a back navigation that lands inside the window. Without it, the term the reader typed a moment ago lands on top of the view they navigated back to.

### Why the comparator takes the direction

The shared comparator takes the direction rather than being flipped by its caller, which is what lets blanks sort last in both directions. Negating a direction-free comparator instead puts every blank first on descending, and on real data that is a first page of empty cells.

### Why the page is clamped where it is read

The page position is clamped where it is read, not where it is stored. A result set that narrows renders the last available page; one that widens again restores the user to where they were. Nothing writes a corrected page back into state, which is what lets a position arrive from outside, from a click or from a restored address.

## Testing

### Unit tests

The suite drives the component the way a user does, through roles and labels rather than internals:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect } from "vitest";

it("sorts by population descending on the second activation", async () => {
  const user = userEvent.setup();
  render(
    <DatasetPage
      config={{ ...CITY_PAGE, search: () => Promise.resolve(rows) }}
    />,
  );
  await screen.findByRole("table");

  // The activation lives on the button, the state lives on the cell.
  const header = screen.getByRole("columnheader", { name: /Population/ });
  const sortButton = screen.getByRole("button", { name: "Population" });

  await user.click(sortButton); // ascending
  await user.click(sortButton); // descending

  expect(header).toHaveAttribute("aria-sort", "descending");
});
```

The assertions read `aria-sort`, the same attribute a screen reader announces, so a passing test is evidence the announcement is right.

### Integration tests

A second suite under `e2e/` runs in a real browser against a production build, covering what a simulated DOM cannot show: that reopening a link restores the search, sort and page it carries; that Back and Forward move through history the way the shareable-link design intends; that the theme and the language are stamped before the first paint rather than after the page loads; that the dataset arrives over the network as a separate content-hashed asset; that sorting, paging, changing the page size and searching stay responsive with the processor slowed fourfold; that the films page keeps an address of its own, independent of the cities page; that the page stays legible when the operating system forces its own color palette; and that neither page scrolls sideways on a phone-width screen, in any language.

After the end-to-end suite, CI runs Lighthouse three times on each page in mobile mode against the same build, writes the median of each metric to the job summary and to a comment on the pull request, and attaches the reports. It is advisory, so a slow score or a failed audit never fails the build; `npm run lighthouse` runs it locally after `npm run build`, on the same headless Chromium the browser suites use.

### Code coverage

The pipeline sends two reports to [Codecov](https://codecov.io/gh/funkadelic/YART): the coverage the hundred percent gate is measured on, and a JUnit report from each of the three suites. A test that fails intermittently is flagged as a flake.

### Mutation testing

[StrykerJS](https://stryker-mutator.io) is configured for mutation testing, run by hand as `npm run test:mutation`. Its runner support stops at Vitest 4.1, so install the older runner first and put the tree back afterward. Run all three:

```bash
npm i -D --no-save --legacy-peer-deps vitest@4
npm run test:mutation
npm ci
```

A run takes about ten minutes and writes `reports/mutation/mutation.html`, which is gitignored.

### Visual regression tests

`e2e/visual.spec.ts` captures how the table renders: the cities page in its default view, a searched, sorted and paged view, the dark theme, a right-to-left language, empty results and a hovered row, plus the films page in its default view and a right-to-left language. [Chromatic](https://www.chromatic.com/) compares each snapshot with the accepted baseline. CI uploads them on pull requests and on `main`, where changes are accepted automatically. Locally, `npm run chromatic` uploads the snapshots a full `npm run test:e2e` archived.

### Static analysis

[fallow](https://github.com/fallow-rs/fallow) reads the TypeScript tree without running it and reports unused files, exports and dependencies, duplicated code, and a maintainability score per file. Run it by hand with `npm run fallow`. It exits non-zero on a finding but does not run in CI, so a finding is something to read and decide about rather than a broken build.

Two other analyzers run in CI. [SonarQube Cloud](https://sonarcloud.io/project/overview?id=funkadelic_yart) scans every push and pull request except Dependabot's, and reads the coverage report alongside the code. [CodeQL](https://codeql.github.com/), through GitHub's default setup, checks the JavaScript, TypeScript and workflow files on pushes to `main`, on pull requests, and once a week.

## Benchmarks

The suites under `bench/` run the shipping sort, page slice, view state, column and locale code over seeded rows shaped like each dataset. Every pull request runs them under [CodSpeed](https://app.codspeed.io/funkadelic/YART), which counts instructions instead of timing them and reports changes against the base branch without failing the build.

```bash
npm run bench
```

Codecov also tracks bundle size. After each build, its standalone analyzer uploads the size of every emitted asset, with no breakdown by module. Each pull request shows the change against `main` and flags one over 5%. Separately, `src/bundle.test.ts` fails the test suite if dataset rows show up in any JavaScript chunk, which is what importing a dataset as a value instead of a URL does.

## Scripts

| Script                    | What it does                                                               |
| ------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`             | Start the dev server with hot reload                                       |
| `npm run build`           | Build the production bundle                                                |
| `npm run build:lib`       | Build the npm package into `lib/`                                          |
| `npm run preview`         | Serve the built bundle locally                                             |
| `npm test`                | Run the test suite once                                                    |
| `npm run test:watch`      | Run the test suite in watch mode                                           |
| `npm run test:coverage`   | Run the test suite once with coverage, which CI enforces at 100%           |
| `npm run test:browser`    | Run the accessibility checks in a real Chromium                            |
| `npm run test:e2e`        | Run the end-to-end suite in a real Chromium against a built bundle         |
| `npm run test:package`    | Pack the package and check the tarball a consumer installs                 |
| `npm run lighthouse`      | Audit both pages' performance on a built bundle and report the medians     |
| `npm run test:mutation`   | Change the source a piece at a time and report what no test catches        |
| `npm run chromatic`       | Upload the snapshots a full `npm run test:e2e` archived, for visual review |
| `npm run bench`           | Run the benchmark suites and print a table per suite                       |
| `npm run typecheck`       | Check types without emitting output                                        |
| `npm run fallow`          | Report unreachable code, duplication and per-file maintainability          |
| `npm run lint`            | Run ESLint then Stylelint; a warning fails it (`lint:fix` to autofix)      |
| `npm run format`          | Run Prettier                                                               |
| `npm run format:check`    | Check formatting without rewriting anything                                |
| `npm run generate:cities` | Regenerate the committed cities asset from the upstream CSV export         |
| `npm run generate:films`  | Regenerate the committed films asset from the recorded SPARQL query        |
| `npm run tokens:build`    | Regenerate the committed token stylesheet from the files in `tokens/`      |

`npm run test:browser` and `npm run test:e2e` both drive a real Chromium. `npm ci` downloads neither that browser nor the system libraries it needs, so a clean clone fetches both once with `npx playwright install --with-deps --only-shell chromium`, whose `--with-deps` half needs `sudo` on Linux. CI runs that same command, so every path installs the same binary.

`npm run test:e2e` serves a production build rather than making one, so run `npm run build` first. Without a build it stops in well under a second and names the command to run.

Both are optional for ordinary development. `npm test` runs the same accessibility checks as `npm run test:browser` against a simulated DOM and needs nothing extra.

The three suites CI runs each write a JUnit report into `junit/`, which is gitignored. Nothing local reads them; they exist for the upload.

## Decisions

The reasoning behind the structure is in [`docs/adr/`](docs/adr/README.md), one file per decision: why there are two HTML shells and no router, why the address holds the view state, why the table knows nothing about cities, and why the rows are not virtualized.

[`docs/frontend-practices.md`](docs/frontend-practices.md) is the survey those sit under, including the practices this repo weighed and chose not to adopt, each with what would change the answer.

## Notes and next steps

There is no server. `getCities` and `getFilms` search an array held in memory, so everything below is what a real backend would change. Worth doing before it ships:

- The dataset arrives as a separate content-hashed JSON asset rather than being compiled into the bundle, but filtering and sorting still run over the whole result set on the main thread. That is fine at this size. Past it, the work belongs behind a paginated, sorted API rather than in the browser.
- Every row renders, so a page size of 100 is 100 rows in the DOM and there is no way to ask for every row. Virtualization would fix both.
- Sorting multiple columns at once is not implemented.

## License

The source in this repository is MIT licensed; see `LICENSE`. The npm package carries only the table and its stylesheet, no dataset, so neither dataset license below reaches it.

The city dataset is not covered by that license. It is redistributed from SimpleMaps under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and keeps those terms, which the Data attribution section below states.

The film dataset is not covered by it either. It is drawn from Wikidata and dedicated to the public domain under [CC0](https://creativecommons.org/publicdomain/zero/1.0/), which asks for nothing and gets the credit below as a courtesy.

## Data attribution

City data from [simplemaps.com World Cities](https://simplemaps.com/data/world-cities), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified: unused columns removed, rows ordered by population.

The upstream release is World Cities Database (basic) v1.91.3. The full terms ship with the data as `src/data/worldcities/license.txt` and `src/data/worldcities/license.pdf`.

The committed asset is `src/data/worldcities/cities.json`, 50,250 rows. It was serialized by `scripts/generate-cities.mjs` from the row data this repository already carried, not from a fresh run over the upstream CSV export. Later revisions are regenerated by that script from the upstream `worldcities.csv` export, which orders rows by descending population and breaks ties by ascending id, so a regenerated file is not expected to be byte-identical to the committed one. `src/data/worldcities/license.txt` records the same provenance.

Film data from [Wikidata](https://www.wikidata.org), dedicated to the public domain under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Modified: unused bindings dropped, multi-valued properties collapsed to arrays, rows limited to films carrying at least 20 sitelinks.

This credit is a courtesy, not an obligation. CC0 requires no attribution at all, and the Wikidata data access page asks for the mention rather than requiring it. The verdict, its sources, and the one inference behind it are recorded in [`src/data/films/license.md`](src/data/films/license.md).

The committed asset is `src/data/films/films.json`, 8,945 rows, regenerated by `scripts/generate-films.mjs` from the SPARQL query recorded in `scripts/films.rq`.
