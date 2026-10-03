import { describe, expect, it } from "vitest";
import * as pkg from "yet-another-react-table";
import { DataTable } from "yet-another-react-table";

import { DataTable as SourceDataTable } from "./components/DataTable/DataTable";

describe("the package specifier", () => {
  it("resolves to the source module, not a built lib/", () => {
    expect(DataTable).toBe(SourceDataTable);
  });

  // Removing a name after the first publish is a semver major.
  it("exports exactly the published runtime names", () => {
    expect(Object.keys(pkg).sort()).toEqual([
      "DEFAULT_TABLE_STATE",
      "DataTable",
      "PAGE_SIZE_OPTIONS",
      "SearchInput",
      "applyTableAction",
      "columns",
      "parseTableState",
      "serializeTableState",
      "useDebouncedCallback",
    ]);
  });
});
