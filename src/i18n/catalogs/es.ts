import { numberFormatFor, selectPlural } from "../format";
import type { Catalog } from "./en";

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
} satisfies Catalog;
