import { DEFAULT_TABLE_STATE, type TableState } from "./tableState";

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
