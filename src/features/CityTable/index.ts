export { CityTable } from "./CityTable";

// The container above this feature needs the restored search term on its very
// first render, and this feature is what puts the term in the address. Passing
// the reader back out here keeps that dependency pointed at the feature rather
// than reaching past it into the shared table.
export { parseSearchTerm } from "../../components/DataTable/tableStateUrl";
