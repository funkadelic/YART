import {
  DEFAULT_TABLE_STATE,
  PAGE_SIZE_OPTIONS,
  type TableState,
} from "./tableState.js";

/** One key carries column and direction, so the invalid pair cannot occur. */
const SORT_DESCENDING_PREFIX = "-";

/**
 * The only keys the address owns. Every other key is carried through a write.
 */
const URL_KEYS = {
  query: "q",
  sort: "sort",
  page: "page",
  size: "size",
} as const;

const OWNED_KEYS: readonly string[] = Object.values(URL_KEYS);

/** Trimmed as the commit trims, so a padded link seeds the settled term. */
function parseQuery<Id extends string>(
  raw: string | null,
): Partial<TableState<Id>> {
  return raw === null ? {} : { query: raw.trim() };
}

/**
 * Tries the whole token before the prefix, because an id may begin with it and
 * stripping first would leave such an id unreachable ascending.
 */
function parseSort<Id extends string>(
  raw: string | null,
  validColumnIds: readonly Id[],
): Partial<TableState<Id>> {
  if (raw === null) return {};

  const ascending = validColumnIds.find((candidate) => candidate === raw);
  if (ascending !== undefined) {
    return { sortColumnId: ascending, sortDirection: "asc" };
  }

  if (!raw.startsWith(SORT_DESCENDING_PREFIX)) return {};

  const id = raw.slice(SORT_DESCENDING_PREFIX.length);
  const descending = validColumnIds.find((candidate) => candidate === id);
  return descending === undefined
    ? {}
    : { sortColumnId: descending, sortDirection: "desc" };
}

/**
 * Coerced whole, because the radix parser reads exponent notation as one
 * digit. Any positive integer; the read-side clamp bounds it.
 */
function parsePage<Id extends string>(
  raw: string | null,
): Partial<TableState<Id>> {
  if (raw === null) return {};

  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? { page } : {};
}

/** Only a size the table offers, since the select cannot show any other. */
function parsePageSize<Id extends string>(
  raw: string | null,
): Partial<TableState<Id>> {
  if (raw === null) return {};

  const pageSize = Number(raw);
  return PAGE_SIZE_OPTIONS.includes(pageSize) ? { pageSize } : {};
}

/**
 * Reads whatever of the view state a query string carries. Total by
 * construction, since a value failing validation is left out, so no parameter
 * needs a fallback arm. The column ids arrive as an argument.
 */
export function parseTableState<Id extends string>(
  search: string,
  validColumnIds: readonly Id[],
): Partial<TableState<Id>> {
  // A repeated key reads as its first occurrence.
  const params = new URLSearchParams(search);

  return {
    ...parseQuery<Id>(params.get(URL_KEYS.query)),
    ...parseSort(params.get(URL_KEYS.sort), validColumnIds),
    ...parsePage<Id>(params.get(URL_KEYS.page)),
    ...parsePageSize<Id>(params.get(URL_KEYS.size)),
  };
}

/**
 * Writes the view state back out, preserving every parameter it does not own
 * and shaped like the address bar's own query, so the write guard is a bare
 * comparison.
 */
export function serializeTableState<Id extends string>(
  state: TableState<Id>,
  search: string,
): string {
  const next = new URLSearchParams();

  // Trimmed on the way out too, so one view cannot have two addresses.
  const term = state.query.trim();
  if (term !== DEFAULT_TABLE_STATE.query) next.set(URL_KEYS.query, term);

  if (state.sortColumnId !== null) {
    const prefix = state.sortDirection === "desc" ? SORT_DESCENDING_PREFIX : "";
    next.set(URL_KEYS.sort, prefix + state.sortColumnId);
  }

  if (state.page !== DEFAULT_TABLE_STATE.page) {
    next.set(URL_KEYS.page, String(state.page));
  }

  if (state.pageSize !== DEFAULT_TABLE_STATE.pageSize) {
    next.set(URL_KEYS.size, String(state.pageSize));
  }

  for (const [key, value] of new URLSearchParams(search)) {
    // Ownership is decided by comparing key strings, never by looking the
    // incoming key up in an object.
    if (!OWNED_KEYS.includes(key)) next.append(key, value);
  }

  const query = next.toString();
  return query === "" ? "" : `?${query}`;
}
