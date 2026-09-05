import type { Film } from "../../api/getFilms";
import { columns } from "../../components/DataTable/column";
import type { Catalog } from "../../i18n/catalogs/en";
import { en } from "../../i18n/catalogs/en";
import { collatorFor, durationFormatFor } from "../../i18n/format";
import { resolveLocale } from "../../i18n/resolveLocale";

/**
 * The columns the film table shows, built for one resolved locale. Both the
 * label and the grouped runtime cell follow the reader, and the collator is
 * fused into the default comparator here. Every call returns a new identity, so
 * the caller has to memoize on the catalog and the tag, or the sort and page
 * memos downstream re-run on every render.
 *
 * The year is deliberately not grouped, because a year is an identifier a
 * reader reads as four digits and a thousands separator in it is wrong in every
 * locale.
 */
export function buildFilmColumns(catalog: Catalog, tag: string) {
  // Named so the list comparator below can close over it. That closure is why
  // the shared column options keep the three parameters they have always had.
  const collator = collatorFor(tag);
  const col = columns<Film>(collator);
  const duration = durationFormatFor(tag);
  const headings = catalog.films.columns;

  // The language decides how a list of values reads, so the catalog joins it and
  // no cell here writes a separator of its own.
  const list = (values: readonly string[]) => catalog.common.list(tag, values);

  // Every multi-valued column needs this. The default comparator files an array
  // as an other-typed value, orders it by the accidental string form, and does
  // not call an empty list blank. Ordering by the joined text keeps the column
  // agreeing with what the cell shows; ordering by length would put a one-genre
  // film above a two-genre one whatever they read.
  const compareList = (
    a: readonly string[],
    b: readonly string[],
    direction: "asc" | "desc",
  ) => {
    // Ahead of the direction, because an empty list sorts last in both and a
    // flip applied first would reverse it.
    if ((a.length === 0) !== (b.length === 0)) {
      return a.length === 0 ? 1 : -1;
    }

    const comparison = collator.compare(a.join(" "), b.join(" "));

    // Returned ahead of the flip, since negating zero gives a value an
    // equality check downstream reads as unequal.
    if (comparison === 0) return 0;
    return direction === "desc" ? -comparison : comparison;
  };

  return [
    col.key("title", { label: headings.title }),
    col.key("year", { label: headings.year, numeric: true }),
    col.key("runtime", {
      label: headings.runtime,
      numeric: true,
      // Carries its unit, because the heading says Runtime and a bare 112 reads
      // as minutes, seconds or hours depending on the reader. A film with no
      // recorded runtime paints an empty cell, matching what the default
      // renderer does and what this one has to keep doing.
      renderCell: (value) => (value === null ? "" : duration.format(value)),
    }),
    col.key("directors", {
      label: headings.directors,
      renderCell: list,
      compare: compareList,
    }),
    col.key("genres", {
      label: headings.genres,
      renderCell: list,
      compare: compareList,
    }),
    col.key("countries", {
      label: headings.countries,
      renderCell: list,
      compare: compareList,
    }),
  ];
}

/**
 * One build at module scope, used only for the id union and the closed set
 * below. Which columns exist is the same in every language; only what they are
 * called moves.
 */
const BASE_COLUMNS = buildFilmColumns(en, resolveLocale("en", []).tag);

/** The literal union of the ids above, formed with no assertion anywhere. */
export type FilmColumnId = (typeof BASE_COLUMNS)[number]["id"];

/** The closed set a restored sort id is checked against, derived above. */
export const FILM_COLUMN_IDS: readonly FilmColumnId[] = BASE_COLUMNS.map(
  (column) => column.id,
);

/**
 * The Wikidata identifier, unpadded. Unlike the city side it needs no padding,
 * because the identifier is already injective and the identity comparison is a
 * tiebreak the reader never sees, so any deterministic total order over it will
 * do.
 */
export const filmRowId = (film: Film) => film.id;
