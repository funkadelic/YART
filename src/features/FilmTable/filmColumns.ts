import type { Film } from "../../api/getFilms";
import { columns } from "../../components/DataTable/column";
import type { Catalog } from "../../i18n/catalogs/en";
import { en } from "../../i18n/catalogs/en";
import { collatorFor, numberFormatFor } from "../../i18n/format";
import { resolveLocale } from "../../i18n/resolveLocale";

/**
 * The columns the film table shows, built for one resolved locale: both the
 * label and the grouped runtime cell follow the reader, and the collator is
 * fused into the default comparator here. A new identity every call, which is
 * the hazard: the caller memoizes on the catalog and the tag, or the sort and
 * page memos downstream re-run on every render.
 *
 * The year is deliberately not grouped: a year is an identifier a reader reads
 * as four digits, and a thousands separator in it is wrong in every locale.
 */
export function buildFilmColumns(catalog: Catalog, tag: string) {
  // Named rather than passed straight through, because the genres comparator
  // below closes over it. That closure is why the shared column options keep
  // the three parameters they have always had.
  const collator = collatorFor(tag);
  const col = columns<Film>(collator);
  const number = numberFormatFor(tag);
  const headings = catalog.films.columns;

  // The language decides how a list of values reads, so the catalog joins it and
  // no cell here writes a separator of its own.
  const list = (values: readonly string[]) => catalog.common.list(tag, values);

  return [
    col.key("title", { label: headings.title }),
    col.key("year", { label: headings.year, numeric: true }),
    col.key("runtime", {
      label: headings.runtime,
      numeric: true,
      // A film with no recorded runtime paints an empty cell, which is what the
      // default renderer would do and what this one has to keep doing.
      renderCell: (value) => (value === null ? "" : number.format(value)),
    }),
    col.key("directors", { label: headings.directors, renderCell: list }),
    // The default comparator is not an error here, which is the hazard: it files
    // an array as an other-typed value and orders it by the accidental string
    // form, and it does not call an empty list blank, so films with no recorded
    // genre would sort among the letters rather than last. Explicit, then.
    col.key("genres", {
      label: headings.genres,
      renderCell: list,
      compare: (a, b, direction) => {
        // Ahead of the direction, because an empty list sorts last in both and
        // a flip applied first would reverse it.
        if ((a.length === 0) !== (b.length === 0)) {
          return a.length === 0 ? 1 : -1;
        }

        const comparison =
          a.length === b.length
            ? collator.compare(a[0] ?? "", b[0] ?? "")
            : a.length - b.length;

        // Returned ahead of the flip, since negating zero gives a value an
        // equality check downstream reads as unequal.
        if (comparison === 0) return 0;
        return direction === "desc" ? -comparison : comparison;
      },
    }),
    col.key("countries", { label: headings.countries, renderCell: list }),
  ];
}

/**
 * One build at module scope, for the id union and the closed set below and for
 * nothing else. Which columns exist is the same in every language; only what
 * they are called moves.
 */
const BASE_COLUMNS = buildFilmColumns(en, resolveLocale("en", []).tag);

/** The literal union of the ids above, formed with no assertion anywhere. */
export type FilmColumnId = (typeof BASE_COLUMNS)[number]["id"];

/** The closed set a restored sort id is checked against, derived not listed. */
export const FILM_COLUMN_IDS: readonly FilmColumnId[] = BASE_COLUMNS.map(
  (column) => column.id,
);

/**
 * The Wikidata identifier, unpadded. Unlike the city side it needs no padding:
 * the identifier is already injective, and the identity comparison is a
 * tiebreak rather than a displayed order, so any deterministic total order over
 * it will do.
 */
export const filmRowId = (film: Film) => film.id;
