// The suffix is the runner's own convention for a type-level test, so the file
// is named for what it is. It is checked by `npm run typecheck` and executed by
// nothing: the runner's default include does not match this suffix, no
// type-check block is configured that would start collecting it, and the
// repository's own test-file walker does not match it either. Adding such a
// block, or renaming the file to the ordinary test suffix, would collect it and
// fail it for declaring no suite.

import { collatorFor } from "../../i18n/format";
import { columns } from "./column";
import type { DataTableProps } from "./DataTable";

/**
 * True only when two types are identical; mutual assignability is not enough.
 * The two deferred conditionals make the comparison exact, because the compiler
 * can only decide they are the same signature by deciding X and Y are the same
 * type.
 */
export type Equal<X, Y> =
  (<A>() => A extends X ? 1 : 2) extends <A>() => A extends Y ? 1 : 2
    ? true
    : false;

/**
 * The assertion itself. Every claim below is written as one of these. A
 * suppression comment marking an expected compile error passes on the wrong
 * error just as readily as on the right one, and this project bans those
 * comments anyway. Each alias is exported because an unexported one is unused,
 * and the lint rule is right about that.
 */
export type Expect<T extends true> = T;

export type Not<T extends boolean> = T extends true ? false : true;

/**
 * Only `any` is both a subtype and a supertype of everything, so only `any`
 * makes the intersection below absorb the 1 and satisfy the check.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * A row type with nothing to do with this application. It is here so the
 * descriptor is proven generic by something other than the single row type the
 * application happens to have.
 */
interface Widget {
  sku: string;
  qty: number;
}

/**
 * A collator on the base tag. The factory holds none, so every caller states
 * which reader's ordering it is building for, and nothing in this file depends
 * on which tag that is, only on there being exactly one.
 */
const widget = columns<Widget>(collatorFor("en-US"));

export const widgetColumns = [
  widget.key("sku", { label: "SKU" }),
  // The value is computed by the accessor, and the renderer below calls a
  // method only a number has. If the value type ever stops reaching the
  // renderer, this line is where it is noticed.
  widget.accessor("total", (row) => row.qty * 2, {
    label: "Total",
    renderCell: (value) => value.toFixed(2),
  }),
];

export type WidgetColumnId = (typeof widgetColumns)[number]["id"];

export type AssertWidgetIds = Expect<Equal<WidgetColumnId, "sku" | "total">>;

export type AssertWidgetIdIsNotAny = Expect<Not<IsAny<WidgetColumnId>>>;

export type AssertWidgetIdIsNotString = Expect<
  Not<Equal<WidgetColumnId, string>>
>;

/**
 * Whether a key is required, decided by asking whether an object with no
 * properties at all satisfies the one-key slice. It does when the key is
 * optional and it does not when the key is required, and that is the only
 * difference the two shapes have left once everything else is picked away.
 */
export type IsRequired<T, K extends keyof T> =
  Record<never, never> extends Pick<T, K> ? false : true;

/**
 * The table's own prop type, instantiated against the row type above, so
 * nothing asserted below touches a domain type.
 */
type WidgetTableProps = DataTableProps<Widget, WidgetColumnId>;

/**
 * The identity function is required. Omitting it silently drops the sort
 * tiebreak and the row keys together, so the table must not compile without
 * one.
 */
export type AssertRowIdCannotBeOmitted = Expect<
  IsRequired<WidgetTableProps, "getRowId">
>;

/**
 * The whole prop bag, not just the ids in it. A prop type that collapsed would
 * accept every one of the assertions above and below without complaint.
 */
export type AssertTablePropsAreNotAny = Expect<Not<IsAny<WidgetTableProps>>>;

/**
 * The id union reaches the prop that carries the columns, so the array a caller
 * passes fixes the id everywhere else on the surface.
 */
export type AssertColumnPropCarriesIds = Expect<
  Equal<WidgetTableProps["columns"][number]["id"], WidgetColumnId>
>;

/**
 * The same union arrives at the state prop, which is where a misspelled id is
 * reported. Without the no-inference wrapper on that prop the compiler would
 * take a candidate from it too, and this would still hold while a wrong id
 * quietly joined the union at the call site.
 */
export type AssertStatePropCarriesIds = Expect<
  Equal<WidgetTableProps["state"]["sortColumnId"], WidgetColumnId | null>
>;
