import { listFormatFor, numberFormatFor, selectPlural } from "../format";
import type {
  Catalog,
  DatasetErrorText,
  DomainCatalog,
  SortedDirection,
} from "./en";

/**
 * Total over the three categories Spanish reports. The many form is spelled
 * out, which makes the record total by construction.
 */
const CIUDAD = { one: "ciudad", many: "ciudades", other: "ciudades" };
const PELICULA = { one: "película", many: "películas", other: "películas" };
const RESULTADO = { one: "resultado", many: "resultados", other: "resultados" };
const ENTRADA = { one: "entrada", many: "entradas", other: "entradas" };

/** The two sort directions, in the words the sentences below weave in. */
const DIRECCION: Readonly<Record<SortedDirection, string>> = {
  asc: "ascendente",
  desc: "descendente",
};

/** Lo que se le dice a quien lee cuando los datos no se pueden cargar. */
const ERROR_CIUDADES: DatasetErrorText = {
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
  unexpected: () => "Se produjo un error inesperado.",
};

/** Escritas enteras: el sustantivo decide el género y la concordancia. */
const ERROR_PELICULAS: DatasetErrorText = {
  notAnObject: () => "No se pudieron leer los datos de las películas.",
  missingRows: () =>
    "A los datos de las películas les falta su matriz de filas.",
  columnOrder: () =>
    "Los datos de las películas tienen un orden de columnas inesperado y no se cargaron.",
  rowShape: (tag, at) =>
    `La fila ${numberFormatFor(tag).format(at)} de los datos de las películas no tiene 7 campos y no se cargó.`,
  rowFieldType: (tag, at) =>
    `La fila ${numberFormatFor(tag).format(at)} de los datos de las películas tiene un campo de tipo incorrecto y no se cargó.`,
  transport: () =>
    "No se pudieron descargar los datos de las películas. Comprueba tu conexión e inténtalo de nuevo.",
  status: (tag, status) =>
    `No se pudieron descargar los datos de las películas (estado ${numberFormatFor(tag).format(status)}).`,
  notJson: () =>
    "Los datos de las películas se descargaron, pero no se pudieron leer como JSON.",
  unexpected: () => "Se produjo un error inesperado.",
};

/** Declared with satisfies, so a missing key is a compile error. */
export const es = {
  common: {
    themeGroup: "Tema",
    themeLight: "Claro",
    themeDark: "Oscuro",
    themeSystem: "Sistema",
    languageName: "Idioma",
    languageSystem: "Sistema",
    renderFailureRetry: "Mostrar de nuevo",
    error: (message: string) => `Error: ${message}`,
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
    pageStatus: (tag: string, page: number, totalPages: number) => {
      const number = numberFormatFor(tag);

      return `Página ${number.format(page)} de ${number.format(totalPages)}`;
    },
    list: (tag: string, values: readonly string[]) =>
      listFormatFor(tag).format(values),
  },
  cities: {
    appTitle: "Lista de ciudades",
    renderFailure:
      "Esta parte de la página no se pudo mostrar. Los datos de las ciudades siguen cargados, así que volver a mostrarla puede funcionar.",
    attribution: (source: string, license: string) =>
      `Datos de ciudades de ${source}, con licencia ${license}. Modificado: columnas no utilizadas eliminadas, filas ordenadas por población.`,
    loading: "Descargando los datos de las ciudades...",
    empty: "No se encontraron ciudades",
    emptyAnnouncement: "No se encontraron ciudades para esa búsqueda",
    results: (tag: string, shown: number, total: number) => {
      const number = numberFormatFor(tag);

      return `Mostrando ${number.format(shown)} ${selectPlural(tag, shown, CIUDAD)} de ${number.format(total)} ${selectPlural(tag, total, RESULTADO)} en total`;
    },
    caption: (tag: string, total: number, sortSummary: string) =>
      `Datos de ciudades con ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTRADA)}, actualmente ${sortSummary}`,
    searchPlaceholder: "Buscar una ciudad",
    datasetError: ERROR_CIUDADES,
    columns: {
      name: "Ciudad",
      country: "País",
      capital: "Capital",
      countryIso3: "Código de país",
      population: "Población",
    },
  } satisfies DomainCatalog,
  films: {
    appTitle: "Lista de películas",
    renderFailure:
      "Esta parte de la página no se pudo mostrar. Los datos de las películas siguen cargados, así que volver a mostrarla puede funcionar.",
    attribution: (source: string, license: string) =>
      `Datos de películas de ${source}, publicados bajo ${license}. El crédito es una cortesía, ya que no es obligatorio. Modificado: variables no utilizadas eliminadas, propiedades multivaluadas convertidas en matrices, filas limitadas por el número de enlaces a sitios.`,
    loading: "Descargando los datos de las películas...",
    empty: "No se encontraron películas",
    emptyAnnouncement: "No se encontraron películas para esa búsqueda",
    results: (tag: string, shown: number, total: number) => {
      const number = numberFormatFor(tag);

      return `Mostrando ${number.format(shown)} ${selectPlural(tag, shown, PELICULA)} de ${number.format(total)} ${selectPlural(tag, total, RESULTADO)} en total`;
    },
    caption: (tag: string, total: number, sortSummary: string) =>
      `Datos de películas con ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTRADA)}, actualmente ${sortSummary}`,
    searchPlaceholder: "Buscar una película",
    datasetError: ERROR_PELICULAS,
    columns: {
      title: "Título",
      year: "Año",
      runtime: "Duración",
      directors: "Directores",
      genres: "Géneros",
      countries: "Países",
    },
  } satisfies DomainCatalog,
} satisfies Catalog;
