import { numberFormatFor, selectPlural } from "../format";
import type { Catalog, DatasetErrorText, SortedDirection } from "./en";

/**
 * The nouns the two woven sentences below pluralize, total over the three
 * categories the Spanish tag reports.
 *
 * The many form is spelled out rather than shared with the other form, even
 * though Spanish inflects them the same way. The category exists because
 * Spanish treats round millions differently in compact notation, and writing
 * the arm out is what makes the record total by construction rather than by a
 * reader remembering that two of the three happen to agree today.
 */
const CIUDAD = { one: "ciudad", many: "ciudades", other: "ciudades" };
const RESULTADO = { one: "resultado", many: "resultados", other: "resultados" };
const ENTRADA = { one: "entrada", many: "entradas", other: "entradas" };

/** The two sort directions, in the words the sentences below weave in. */
const DIRECCION: Readonly<Record<SortedDirection, string>> = {
  asc: "ascendente",
  desc: "descendente",
};

/** Lo que se le dice a quien lee cuando los datos no se pueden cargar. */
const TEXTO_DE_ERROR: DatasetErrorText = {
  notAnObject: () => "No se pudieron leer los datos de las ciudades.",
  missingRows: () =>
    "A los datos de las ciudades les falta su matriz de filas.",
  columnOrder: () =>
    "Los datos de las ciudades tienen un orden de columnas inesperado y no se cargaron.",
  rowShape: (tag, at) =>
    `La fila ${numberFormatFor(tag).format(at)} de los datos de las ciudades no tiene 7 campos y no se cargó.`,
  rowFieldType: (tag, at) =>
    `La fila ${numberFormatFor(tag).format(at)} de los datos de las ciudades tiene un campo de tipo incorrecto y no se cargó.`,
  transport: () =>
    "No se pudieron descargar los datos de las ciudades. Comprueba tu conexión e inténtalo de nuevo.",
  status: (tag, status) =>
    `No se pudieron descargar los datos de las ciudades (estado ${numberFormatFor(tag).format(status)}).`,
  notJson: () =>
    "Los datos de las ciudades se descargaron, pero no se pudieron leer como JSON.",
  unexpected: () => "Se produjo un error inesperado",
};

/**
 * The Spanish catalog.
 *
 * Declared with satisfies rather than annotated with it, so a missing key and a
 * misspelled key are both compile errors while the literal types of the entries
 * survive for anything that wants to read them.
 */
export const es = {
  columnName: "Ciudad",
  columnCountry: "País",
  columnCapital: "Capital",
  columnCountryCode: "Código de país",
  columnPopulation: "Población",
  loading: "Descargando los datos de las ciudades...",
  empty: "No se encontraron ciudades",
  emptyAnnouncement: "No se encontraron ciudades para esa búsqueda",
  results: (tag: string, shown: number, total: number) => {
    const number = numberFormatFor(tag);

    return `Mostrando ${number.format(shown)} ${selectPlural(tag, shown, CIUDAD)} de ${number.format(total)} ${selectPlural(tag, total, RESULTADO)} en total`;
  },
  caption: (tag: string, total: number, sortSummary: string) =>
    `Datos de ciudades con ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTRADA)}, actualmente ${sortSummary}`,
  error: (message: string) => `Error: ${message}`,
  datasetError: TEXTO_DE_ERROR,
  retry: "Reintentar",
  sortedAnnouncement: (columnLabel: string, direction: SortedDirection) =>
    `Tabla ordenada por ${columnLabel} en orden ${DIRECCION[direction]}`,
  sortClearedAnnouncement: "Orden de la tabla eliminado",
  unsorted: "sin ordenar",
  sortSummary: (columnLabel: string, direction: SortedDirection) =>
    `ordenada por ${columnLabel} en orden ${DIRECCION[direction]}`,
  pageSize: "Por página:",
  paginationNavigation: "Navegación de páginas de la tabla",
  firstPage: "Ir a la primera página",
  previousPage: "Ir a la página anterior",
  nextPage: "Ir a la página siguiente",
  lastPage: "Ir a la última página",
  searchName: "Buscar",
  searchPlaceholder: "Buscar una ciudad",
  pageStatus: (tag: string, page: number, totalPages: number) => {
    const number = numberFormatFor(tag);

    return `Página ${number.format(page)} de ${number.format(totalPages)}`;
  },
} satisfies Catalog;
