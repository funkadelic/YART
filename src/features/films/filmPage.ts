import { getFilms, type Film } from "../../api/getFilms";
import type { DatasetConfig } from "../DatasetPage";
import {
  FILM_COLUMN_IDS,
  buildFilmColumns,
  filmRowId,
  type FilmColumnId,
} from "./filmColumns";

/**
 * The films page config. Only the films entry imports this, which keeps the
 * film dataset in that entry's chunk.
 */
export const FILM_PAGE: DatasetConfig<Film, FilmColumnId> = {
  domain: "films",
  search: getFilms,
  buildColumns: buildFilmColumns,
  getRowId: filmRowId,
  columnIds: FILM_COLUMN_IDS,
};
