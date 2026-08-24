import type { City } from "../../api/getCities";
import { columns } from "../../components/DataTable/column";
import type { DataTableLabels } from "../../components/DataTable/DataTable";

// Built once at module scope, so the array keeps the same identity across every
// render. Rebuilding it inside a component body would hand the table a new
// array on every keystroke and defeat the memos downstream of it.
const col = columns<City>();

/**
 * The columns the city table shows, in the order it shows them. The population
 * formatting lives here because it is a fact about this column of this dataset,
 * and the table body that renders it knows nothing about either.
 */
export const cityColumns = [
  col.key("name", { label: "City" }),
  col.key("country", { label: "Country" }),
  col.key("capital", { label: "Capital" }),
  col.key("countryIso3", { label: "Country Code" }),
  col.key("population", {
    label: "Population",
    renderCell: (value) => value.toLocaleString(),
  }),
];

/** The literal union of the ids above, formed with no assertion anywhere. */
export type CityColumnId = (typeof cityColumns)[number]["id"];

/**
 * Every string the shared table renders that names what its rows are. The table
 * itself carries none of them, which is what lets it show something other than
 * cities without a single edit.
 *
 * Module scope, because two of these are functions and the table holds the
 * whole object across renders.
 */
export const cityTableLabels: DataTableLabels = {
  loading: "Downloading the city data...",
  empty: "No cities found",
  emptyAnnouncement: "No cities found for that search",
  results: (shown, total) =>
    `Showing ${shown} cities out of ${total} total results`,
  caption: (total, sortSummary) =>
    `City data with ${total} entries, currently ${sortSummary}`,
};
