# Yet Another React Table (YART)

A React and TypeScript prototype for browsing a large dataset in the browser:
search, sort, and paginate a list of world cities without a table library.

## Features

### Search

- Search cities by city name or country name
- Empty state when a search matches nothing
- Error state when a search fails (searching for `error` triggers one, so the
  failure path can be exercised)
- Search is debounced by 150ms after the last keystroke, using a hand-rolled
  `useDebounce` hook rather than a utility library

### Sorting

- Click any column header to sort
- Each column cycles through ascending, descending, and unsorted
- Sorting resets to the first page so results are never skipped
- Sort state is announced to screen readers through a live region

### Pagination

- Page size defaults to 10 and can be changed at runtime
- Previous and next navigation, plus jumps to the first and last page
- Page size changes reset to the first page

### Accessibility

- Column headers carry a descriptive label for the action the next click will
  take, for example "Sort by Country descending"
- Icons are hidden from assistive technology, since the header text already
  carries the meaning
- Live regions announce sort changes and result counts
- The table scrolls horizontally on narrow viewports instead of overflowing

## Stack

- [TypeScript](https://www.typescriptlang.org)
- [React](https://reactjs.org)
- [Vite](https://vitejs.dev/)
- [Jest](https://jestjs.io) and [Testing Library](https://testing-library.com/)
- [React Icons](https://react-icons.github.io/react-icons/)
- [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/)

### Build target

The browser target follows the Baseline Widely available rule, taken on
2026-08-20:

- Chrome 111 and above
- Edge 111 and above
- Firefox 111 and above
- Safari 16.4 and above

The `browserslist` field in `package.json` names these versions explicitly
instead of using a percentage or "not dead" query, so browser support data
changes cannot move build output. Raising the baseline is a deliberate edit
to that list and to the date above.

## Getting started

```sh
npm install
npm run dev
```

Then open [http://localhost:5173/](http://localhost:5173/).

## Usage

`<SortableTable>` owns sorting and pagination. It does not own the data. The
parent fetches, filters, and hands down a plain array, which keeps the
component indifferent to where rows come from, whether that is a local array
today or a paginated endpoint later.

```tsx
import { useCallback, useEffect, useState } from "react";

import { getCities, type City } from "./api/getCities";
import { useDebounce } from "./hooks/useDebounce";
import { SortableTable } from "./components/SortableTable";

function CityBrowser() {
  const [searchTerm, setSearchTerm] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Wait 150ms after the last keystroke before hitting the API.
  const debouncedSearchTerm = useDebounce(searchTerm, 150);

  const runSearch = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      setCities(await getCities({ searchTerm: term }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unexpected error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(debouncedSearchTerm);
  }, [runSearch, debouncedSearchTerm]);

  return (
    <SortableTable
      data={cities}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      loading={loading}
      error={error}
    />
  );
}
```

### Props

| Prop             | Type                     | Description                                                                                                      |
| ---------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `data`           | `City[]`                 | Rows to display. Already filtered by the caller.                                                                 |
| `searchTerm`     | `string`                 | Current value of the search box. The input is controlled, so this must be state the caller owns.                 |
| `onSearchChange` | `(term: string) => void` | Called on every keystroke. Debouncing belongs to the caller, not the table.                                      |
| `loading`        | `boolean`                | Renders a loading message in place of the table.                                                                 |
| `error`          | `Error \| null`          | Renders the error message in place of the table. The search box stays visible so the user can correct the query. |

`loading` and `error` are mutually exclusive in practice: `error` wins if both
are set.

### Why the caller debounces

The table calls `onSearchChange` on every keystroke and renders whatever `data`
it is given. That split means the debounce interval, the request, and the
retry policy are all decisions the caller makes. Swapping the 150ms delay for
300ms, or replacing the fake API with a real endpoint, touches no table code.

The `useDebounce` hook is standalone and works with any value:

```tsx
const debouncedFilters = useDebounce(filters, 300);
```

## Configuring

### Columns

Columns are defined in an array near the top of `SortableTable`:

```tsx
const columns: Column[] = [
  { key: "name", label: "City", sortable: true },
  { key: "country", label: "Country", sortable: true },
  { key: "capital", label: "Capital", sortable: true },
  { key: "countryIso3", label: "Country Code", sortable: true },
  { key: "population", label: "Population", sortable: true },
];
```

`key` must be a key of `City`, `label` is the header text, and `sortable:
false` renders a plain header with no click target, no keyboard handler, and no
`aria-sort`.

Adding or reordering a column means editing two places: this array and the
`<tbody>` cells, which are written out by hand so each one can format its own
value, for example `city.population.toLocaleString()`. Keeping them in sync is
manual, and that is the main thing to fix before reusing this elsewhere. See
[Notes and next steps](#notes-and-next-steps).

### Sort comparison

Sorting branches on the runtime type of the cell: strings go through
`localeCompare`, numbers subtract. Anything else keeps its original order.
Dates or custom orderings need a case added in the `sortedData` memo.

### Page size options

The page size select is populated from a hardcoded list, with 10 as the
default:

```tsx
<option value={10}>10</option>
<option value={25}>25</option>
<option value={50}>50</option>
<option value={100}>100</option>
```

Changing the page size or the sort resets to page 1, so no rows are silently
skipped. The pagination controls hide entirely when there is only one page.

### Theming

Colors are CSS custom properties declared in
`src/components/SortableTable.module.scss`, so a theme is an override rather
than a stylesheet fork:

```css
:root {
  --accent-color: #6b46c1;
  --error-color: #b91c1c;
  --border-color: #333;
  --border-light: #ddd;
  --text-color: #000;
  --text-muted: #666;
  --background-light: #eee;
  --background-light-hover: #ccc;
}
```

Everything else is scoped through CSS modules, so class names cannot collide
with the rest of an app.

## Testing

The suite drives the component the way a user does, through roles and labels
rather than internals:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("sorts by population descending on the second click", async () => {
  const user = userEvent.setup();
  render(
    <SortableTable
      data={cities}
      searchTerm=""
      onSearchChange={jest.fn()}
      loading={false}
      error={null}
    />,
  );

  const header = screen.getByText("Population").closest("th")!;
  await user.click(header); // ascending
  await user.click(header); // descending

  expect(header).toHaveAttribute("aria-sort", "descending");
});
```

Because sorting is announced through `aria-sort`, the accessible markup and the
assertions are the same surface. A test that passes is also evidence a screen
reader gets the right answer.

## Scripts

| Script           | What it does                         |
| ---------------- | ------------------------------------ |
| `npm run dev`    | Start the dev server with hot reload |
| `npm test`       | Run the Jest suite                   |
| `npm run lint`   | Run ESLint (`lint:fix` to autofix)   |
| `npm run format` | Run Prettier                         |

## Notes and next steps

This is a prototype, not production code. Things worth doing before it ships:

- Sorting and filtering run over the full result set in the browser. That is
  fine at this size, but a real dataset belongs behind a paginated, sorted API.
- The component is typed to `City` and renders its cells by hand, so it is
  not yet reusable with another row shape. The fix is a generic
  `SortableTable<T>` taking a `columns` prop of
  `{ key, label, sortable, render? }`, which would collapse the header array
  and the `<tbody>` cells into one declaration.
- Sorting multiple columns at once is not implemented.
- Sort and page state live in component state, so they are lost on reload and
  cannot be linked to. Moving them into the URL would fix both.
