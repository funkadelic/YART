import {
  DEFAULT_TABLE_STATE,
  PAGE_SIZE_OPTIONS,
  type TableState,
} from "./tableState";

/**
 * What a descending sort is written with, ahead of the column id.
 *
 * One key rather than a column and a direction, and not to shorten the link:
 * the two fields are coupled in the state, where the direction is null exactly
 * when the column is, so a single token makes the invalid pair unrepresentable
 * rather than merely rejected and the parser needs no cross-field rule at all.
 *
 * A hyphen rather than a colon-separated form, which has the same validation
 * property but is percent-encoded in some of the paths a link travels, so the
 * pasted address reads worse for no gain.
 */
const SORT_DESCENDING_PREFIX = "-";

/**
 * One parameter this schema owns: the key it answers to, how a raw value is
 * read back into view state, and how the state's value for it is written out.
 *
 * The reading half returns a partial rather than a single value, so a key that
 * carries two coupled state fields needs no second shape and no cross-field
 * rule after the fact. The writing half returns null for a value equal to its
 * default, so the rule that keeps defaults out of the address is applied once
 * over the table below rather than restated inside every entry.
 *
 * Both halves are generic over the column ids per call rather than over the
 * interface, which is what lets the schema be one module-scope array shared by
 * every table instead of one array per row type.
 */
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

/**
 * The parameters this application owns, in the order it writes them.
 *
 * The array's order is the canonical order, so there is no second list of key
 * names to keep in step with it, and adding a parameter is one entry rather
 * than an edit to a parser, a serializer, and an order.
 */
const PARAM_SCHEMA: readonly UrlParamEntry[] = [
  {
    key: "q",
    // Taken exactly as it arrives, with nothing to validate. A term is a free
    // string by nature: it reaches a controlled input's value and a substring
    // match over the collection, never a lookup and never markup, so there is
    // no shape it could fail to have. Every rule a term does have, the spelling
    // of a space and the encoding of the punctuation the query string uses for
    // itself, belongs to the query serializer below rather than here.
    parse: (raw) => ({ query: raw }),
    // Trimmed on the way out, because the search itself trims: a term carrying
    // edge whitespace selects the same rows as one without, so writing it
    // verbatim would give one view two addresses that never converge, and a
    // term that is nothing but whitespace would write a key for a view
    // identical to the default. Trimmed here rather than in the state, so what
    // the reader is typing stays painted in the box exactly as they typed it
    // while the address stays canonical.
    serialize: (state) => {
      const term = state.query.trim();
      return term === DEFAULT_TABLE_STATE.query ? null : term;
    },
  },
  {
    key: "sort",
    // The token is checked by locating it among the ids the caller supplied,
    // comparing values rather than indexing anything. Located with find rather
    // than tested and then asserted, so the result arrives already typed as one
    // of those ids and nothing here has to claim a type for a string that came
    // out of the address.
    //
    // The whole token is tried before the prefix is stripped, because an id may
    // itself begin with the prefix and nothing constrains it not to. Stripping
    // first makes such an id unreachable ascending: it writes a token that
    // reads back as a different id descending, so the sort is silently dropped
    // rather than restored. Trying the exact match first leaves exactly one
    // ambiguity, between an id and the id the prefix would produce from it, and
    // resolves it toward the one that exists as written.
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
    // Coerced whole rather than with the radix parser, which truncates in two
    // opposite directions: it reads exponent notation as a single digit and a
    // number carrying trailing text as its numeric prefix. The page-size select
    // can use it safely because its input is a fixed option list; the address
    // is not a fixed list.
    //
    // Any positive integer is taken, with no upper bound. The clamp that turns
    // a position into rows is what bounds it, and an out-of-range value has to
    // survive in the address rather than be corrected back into it. That also
    // means hexadecimal notation is accepted as the number it denotes, which is
    // a choice rather than an oversight: it is a positive integer, the clamp
    // bounds it, and a format rule here would be a rule with no failure it
    // prevents.
    parse: (raw) => {
      const page = Number(raw);
      return Number.isInteger(page) && page > 0 ? { page } : undefined;
    },
    serialize: (state) =>
      state.page === DEFAULT_TABLE_STATE.page ? null : String(state.page),
  },
  {
    key: "size",
    // Accepted only when it is a size the table offers, because the table's own
    // select cannot represent one that is not among its options: accepting an
    // arbitrary size would render a control whose value is not in its own list.
    // Membership in that list already implies a whole number, so there is no
    // second predicate to write. Coerced whole for the same reason the position
    // above is.
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
 * Reads whatever of the view state a query string carries.
 *
 * Total by construction: a value that fails validation is left out rather than
 * replaced, and the caller spreads the result over the default state, so an
 * omitted field is the default and no parameter needs a fallback of its own.
 *
 * The valid column ids arrive as an argument rather than being imported, which
 * is what keeps this module ignorant of what its rows are, exactly as the table
 * receives its columns. Nothing read out of the query is ever used as an object
 * key and nothing is deep merged, so a parameter named after a prototype member
 * is structurally harmless rather than a case in a validator.
 */
export function parseTableState<Id extends string>(
  search: string,
  validColumnIds: readonly Id[],
): Partial<TableState<Id>> {
  const params = new URLSearchParams(search);
  const restored: Partial<TableState<Id>> = {};

  for (const entry of PARAM_SCHEMA) {
    // The first occurrence of a repeated key, which is the whole rule for one:
    // the extras are dropped by the write that follows rather than by a rule of
    // their own.
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
 * Writes the view state back out, preserving every parameter it does not own.
 *
 * Owned keys are written first in the schema's order and anything else follows
 * in the order it arrived, so two equivalent views produce the same string
 * while a tracking tag someone else put in the link survives the write.
 *
 * The result is shaped the way the address bar's own query is shaped: empty
 * when there is nothing to say, and otherwise a question mark followed by the
 * parameters. That is what lets the caller's write guard be a bare comparison.
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
    // Ownership is decided by comparing against the schema's own key strings,
    // never by looking the incoming key up in an object.
    if (!PARAM_SCHEMA.some((entry) => entry.key === key)) {
      next.append(key, value);
    }
  }

  const query = next.toString();
  return query === "" ? "" : `?${query}`;
}

/**
 * Reads only the search term a query string carries.
 *
 * The container behind the table needs the term on its very first render and
 * owns none of the columns, so it reads through this rather than passing an
 * empty column-id list to say it does not care about the sort. One schema and
 * two entry points: the rules still live in exactly one place, and a reader of
 * the call site can see what is being asked for.
 */
export function parseSearchTerm(search: string): string {
  return parseTableState(search, []).query ?? DEFAULT_TABLE_STATE.query;
}
