import type { City } from "../../api/getCities";
import { columns } from "../../components/DataTable/column";
import type { Catalog } from "../../i18n/catalogs/en";
import { en } from "../../i18n/catalogs/en";
import { collatorFor, numberFormatFor } from "../../i18n/format";
import { resolveLocale } from "../../i18n/resolveLocale";

/**
 * The columns the city table shows, in the order it shows them, built for one
 * resolved locale.
 *
 * A builder rather than the module-scope array this used to be, because both
 * halves of a column now follow the reader: the label comes out of the catalog,
 * and the population cell is grouped by the tag's own rule rather than by
 * whatever the machine running the code prefers. The collator goes in here too,
 * fused into the default comparator at construction the way the accessor
 * already is, which is what leaves the sort module and the table's own props
 * untouched by any of this.
 *
 * The population formatting lives here because it is a fact about this column
 * of this dataset, and the table body that renders it knows nothing about
 * either. It goes through the cached formatter rather than the value's own
 * per-call helper, which builds a formatter on every call and so builds one per
 * rendered cell per render.
 *
 * The array this returns is a new identity every call, which is the whole point
 * and also the hazard: the caller has to build it in a memo keyed on the
 * catalog and the tag, or the sort and page memos downstream re-run on every
 * render.
 */
export function buildCityColumns(catalog: Catalog, tag: string) {
  const col = columns<City>(collatorFor(tag));
  const number = numberFormatFor(tag);

  return [
    col.key("name", { label: catalog.columnName }),
    col.key("country", { label: catalog.columnCountry }),
    col.key("capital", { label: catalog.columnCapital }),
    col.key("countryIso3", { label: catalog.columnCountryCode }),
    col.key("population", {
      label: catalog.columnPopulation,
      numeric: true,
      renderCell: (value) => number.format(value),
    }),
  ];
}

/**
 * One build at module scope, for the id union and the closed set below and for
 * nothing else. Neither of those is a fact about a locale: which columns exist
 * is the same in every language, and only what they are called moves. Deriving
 * them from a build rather than declaring them beside it is what keeps a column
 * that is added, renamed or removed from leaving a stale entry here.
 */
const BASE_COLUMNS = buildCityColumns(en, resolveLocale("en", []).tag);

/** The literal union of the ids above, formed with no assertion anywhere. */
export type CityColumnId = (typeof BASE_COLUMNS)[number]["id"];

/**
 * The closed set a sort id restored from an address is checked for membership
 * in. Derived from the columns rather than written out beside them, so a column
 * that is added, renamed, or removed cannot leave a stale entry behind here.
 */
export const CITY_COLUMN_IDS: readonly CityColumnId[] = BASE_COLUMNS.map(
  (column) => column.id,
);

/**
 * The width every city id is padded to before it is handed over as a row
 * identity. Ten because the dataset's ids are geoname ids, which the generator
 * emits at ten digits, and the two rows the parse boundary numbers itself. A
 * dataset whose ids outgrow this pads to no effect and the identities start
 * ordering as text again, which is a visible reordering rather than a crash, so
 * the constant is stated here rather than inlined.
 */
const ID_WIDTH = 10;

/**
 * A row's identity, as text, because that is what the table's tiebreak
 * compares. Padded so identities that order as text order as the numbers they
 * are: unpadded, "2" follows "1934976309" and the two lowest ids land at the
 * end of every group of rows whose sorted column values are equal. City ids are
 * unique by construction at the parse boundary, and padding preserves that.
 */
export const cityRowId = (city: City) =>
  String(city.id).padStart(ID_WIDTH, "0");
