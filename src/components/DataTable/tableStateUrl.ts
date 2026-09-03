import {
  DEFAULT_TABLE_STATE,
  PAGE_SIZE_OPTIONS,
  type TableState,
} from "./tableState";

/** One key rather than two, so the invalid pair is unrepresentable. */
const SORT_DESCENDING_PREFIX = "-";

/** Parsing returns a partial; serializing returns null for a default. */
interface UrlParamEntry {
  readonly key: string;
  readonly parse: <Id extends string>(
    raw: string,
    validColumnIds: readonly Id[],
  ) => Partial<TableState<Id>> | undefined;
  readonly serialize: <Id extends string>(
    state: TableState<Id>,
  ) => string | null;
}

/** The parameters this application owns, in the canonical write order. */
const PARAM_SCHEMA: readonly UrlParamEntry[] = [
  {
    key: "q",
    // A term reaches a controlled value and a substring match, never a lookup.
    parse: (raw) => ({ query: raw }),
    // Trimmed on the way out because the search trims, so one view cannot have
    // two addresses. Not trimmed in the state, so the box shows what was typed.
    serialize: (state) => {
      const term = state.query.trim();
      return term === DEFAULT_TABLE_STATE.query ? null : term;
    },
  },
  {
    key: "sort",
    // Located with find, so the result arrives already typed as a caller's id.
    // The whole token is tried before the prefix is stripped, because an id may
    // begin with it: stripping first leaves such an id unreachable ascending.
    parse: (raw, validColumnIds) => {
      const ascending = validColumnIds.find((candidate) => candidate === raw);
      if (ascending !== undefined) {
        return { sortColumnId: ascending, sortDirection: "asc" };
      }

      if (!raw.startsWith(SORT_DESCENDING_PREFIX)) return undefined;

      const id = raw.slice(SORT_DESCENDING_PREFIX.length);
      const sortColumnId = validColumnIds.find((candidate) => candidate === id);
      if (sortColumnId === undefined) return undefined;

      return { sortColumnId, sortDirection: "desc" };
    },
    serialize: (state) => {
      if (state.sortColumnId === null) return null;

      const prefix =
        state.sortDirection === "desc" ? SORT_DESCENDING_PREFIX : "";
      return prefix + state.sortColumnId;
    },
  },
  {
    key: "page",
    // Coerced whole rather than with the radix parser, which reads exponent
    // notation as a single digit. Any positive integer, with no upper bound:
    // the read-side clamp is what bounds it.
    parse: (raw) => {
      const page = Number(raw);
      return Number.isInteger(page) && page > 0 ? { page } : undefined;
    },
    serialize: (state) =>
      state.page === DEFAULT_TABLE_STATE.page ? null : String(state.page),
  },
  {
    key: "size",
    // Only a size the table offers, because the select cannot represent one
    // that is not among its options. Membership already implies a whole number.
    parse: (raw) => {
      const pageSize = Number(raw);
      return PAGE_SIZE_OPTIONS.includes(pageSize) ? { pageSize } : undefined;
    },
    serialize: (state) =>
      state.pageSize === DEFAULT_TABLE_STATE.pageSize
        ? null
        : String(state.pageSize),
  },
];

/**
 * Reads whatever of the view state a query string carries. Total by
 * construction: a value failing validation is left out, so no parameter needs a
 * fallback arm. The column ids arrive as an argument.
 */
export function parseTableState<Id extends string>(
  search: string,
  validColumnIds: readonly Id[],
): Partial<TableState<Id>> {
  const params = new URLSearchParams(search);
  const restored: Partial<TableState<Id>> = {};

  for (const entry of PARAM_SCHEMA) {
    // The first occurrence of a repeated key; the extras are dropped by the
    // write that follows rather than by a rule of their own.
    const raw = params.get(entry.key);
    if (raw === null) continue;

    const parsed = entry.parse(raw, validColumnIds);
    if (parsed !== undefined) {
      Object.assign(restored, parsed);
    }
  }

  return restored;
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
  const incoming = new URLSearchParams(search);
  const next = new URLSearchParams();

  for (const entry of PARAM_SCHEMA) {
    const value = entry.serialize(state);
    if (value !== null) {
      next.set(entry.key, value);
    }
  }

  for (const [key, value] of incoming) {
    // Ownership is decided by comparing key strings, never by looking the
    // incoming key up in an object.
    if (!PARAM_SCHEMA.some((entry) => entry.key === key)) {
      next.append(key, value);
    }
  }

  const query = next.toString();
  return query === "" ? "" : `?${query}`;
}

/** Reads only the term, for the container that owns none of the columns. */
export function parseSearchTerm(search: string): string {
  return parseTableState(search, []).query ?? DEFAULT_TABLE_STATE.query;
}
