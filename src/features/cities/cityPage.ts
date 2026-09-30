import { getCities, type City } from "../../api/getCities";
import type { DatasetConfig } from "../DatasetPage";
import {
  CITY_COLUMN_IDS,
  buildCityColumns,
  cityRowId,
  type CityColumnId,
} from "./cityColumns";

/**
 * The cities page config. Only the cities entry imports this, which keeps the
 * city dataset in that entry's chunk.
 */
export const CITY_PAGE: DatasetConfig<City, CityColumnId> = {
  domain: "cities",
  search: getCities,
  buildColumns: buildCityColumns,
  getRowId: cityRowId,
  columnIds: CITY_COLUMN_IDS,
};
