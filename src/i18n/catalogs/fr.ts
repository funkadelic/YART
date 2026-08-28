import { numberFormatFor, selectPlural } from "../format";
import type { Catalog, SortedDirection } from "./en";

/**
 * The nouns the two woven sentences below pluralize, total over the three
 * categories the French tag reports.
 *
 * French puts zero in the singular category where English and Spanish put it in
 * the plural, so "0 ville" is correct here and "0 ciudades" is correct beside
 * it. That is the rule a ternary on the count gets wrong without ever looking
 * wrong, and it is the reason the selection goes through the platform.
 */
const VILLE = { one: "ville", many: "villes", other: "villes" };
const RESULTAT = { one: "résultat", many: "résultats", other: "résultats" };
const ENTREE = { one: "entrée", many: "entrées", other: "entrées" };

/** The two sort directions, in the words the sentences below weave in. */
const ORDRE: Readonly<Record<SortedDirection, string>> = {
  asc: "croissant",
  desc: "décroissant",
};

/**
 * The narrow no-break space French typography sets before a colon, a semicolon,
 * an exclamation mark and a question mark.
 *
 * Written as an escape rather than as the character, because the character is
 * indistinguishable from an ordinary space in every editor and terminal this
 * file is read in, and a reviewer meeting it inline would correct it. It is a
 * translation requirement, not a typo. The same character is already in every
 * grouped number these entries carry, put there by the formatter rather than by
 * hand.
 */
const NARROW_NO_BREAK_SPACE = "\u202F";

/**
 * The French catalog.
 *
 * Declared with satisfies rather than annotated with it, so a missing key and a
 * misspelled key are both compile errors while the literal types of the entries
 * survive for anything that wants to read them.
 *
 * French typography puts a narrow no-break space, U+202F, before a colon, a
 * semicolon, an exclamation mark and a question mark. Two entries below carry
 * one: the label above the page-size control and the prefix on a failure. Both
 * reach it through the named constant above rather than by holding the
 * character inline, so a reviewer reads the requirement instead of a space that
 * looks like a typo.
 */
export const fr = {
  columnName: "Ville",
  columnCountry: "Pays",
  columnCapital: "Capitale",
  columnCountryCode: "Code pays",
  columnPopulation: "Population",
  loading: "Téléchargement des données des villes...",
  empty: "Aucune ville trouvée",
  emptyAnnouncement: "Aucune ville trouvée pour cette recherche",
  results: (tag: string, shown: number, total: number) => {
    const number = numberFormatFor(tag);

    return `Affichage de ${number.format(shown)} ${selectPlural(tag, shown, VILLE)} sur ${number.format(total)} ${selectPlural(tag, total, RESULTAT)} au total`;
  },
  caption: (tag: string, total: number, sortSummary: string) =>
    `Données des villes avec ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTREE)}, actuellement ${sortSummary}`,
  error: (message: string) => `Erreur${NARROW_NO_BREAK_SPACE}: ${message}`,
  retry: "Réessayer",
  sortedAnnouncement: (columnLabel: string, direction: SortedDirection) =>
    `Tableau trié par ${columnLabel} en ordre ${ORDRE[direction]}`,
  sortClearedAnnouncement: "Tri du tableau supprimé",
  unsorted: "non trié",
  sortSummary: (columnLabel: string, direction: SortedDirection) =>
    `trié par ${columnLabel} en ordre ${ORDRE[direction]}`,
  pageSize: `Par page${NARROW_NO_BREAK_SPACE}:`,
  paginationNavigation: "Navigation dans les pages du tableau",
  firstPage: "Aller à la première page",
  previousPage: "Aller à la page précédente",
  nextPage: "Aller à la page suivante",
  lastPage: "Aller à la dernière page",
  searchName: "Rechercher",
  searchPlaceholder: "Rechercher une ville",
  pageStatus: (tag: string, page: number, totalPages: number) => {
    const number = numberFormatFor(tag);

    return `Page ${number.format(page)} sur ${number.format(totalPages)}`;
  },
} satisfies Catalog;
