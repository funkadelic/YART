import type { Catalog } from "./en";

/**
 * The Spanish catalog.
 *
 * Declared with satisfies rather than annotated with it, so a missing key and a
 * misspelled key are both compile errors while the literal types of the entries
 * survive for anything that wants to read them.
 */
export const es = {
  loading: "Descargando los datos de las ciudades...",
  empty: "No se encontraron ciudades",
  emptyAnnouncement: "No se encontraron ciudades para esa búsqueda",
  results: (tag: string, shown: number, total: number) =>
    `Mostrando ${shown} ciudades de ${total} resultados en total`,
  caption: (tag: string, total: number, sortSummary: string) =>
    `Datos de ciudades con ${total} entradas, actualmente ${sortSummary}`,
} satisfies Catalog;
