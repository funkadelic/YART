import { numberFormatFor, selectPlural } from "../format";
import type { Catalog, DatasetErrorText, SortedDirection } from "./en";

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

/** Ce qui est annoncé au lecteur quand les données ne peuvent pas être chargées. */
const TEXTE_ERREUR: DatasetErrorText = {
  notAnObject: () => "Les données des villes n'ont pas pu être lues.",
  missingRows: () => "Le tableau de lignes est absent des données des villes.",
  columnOrder: () =>
    "Les données des villes ont un ordre de colonnes inattendu et n'ont pas été chargées.",
  rowShape: (tag, at) =>
    `La ligne ${numberFormatFor(tag).format(at)} des données des villes n'a pas 7 champs et n'a pas été chargée.`,
  rowFieldType: (tag, at) =>
    `La ligne ${numberFormatFor(tag).format(at)} des données des villes a un champ de type incorrect et n'a pas été chargée.`,
  transport: () =>
    "Les données des villes n'ont pas pu être téléchargées. Vérifiez votre connexion et réessayez.",
  status: (tag, status) =>
    `Les données des villes n'ont pas pu être téléchargées (statut ${numberFormatFor(tag).format(status)}).`,
  notJson: () =>
    "Les données des villes ont été téléchargées, mais n'ont pas pu être lues au format JSON.",
  unexpected: () => "Une erreur inattendue s'est produite.",
};

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
  appTitle: "Liste des villes",
  themeGroup: "Thème",
  themeLight: "Clair",
  themeDark: "Sombre",
  themeSystem: "Système",
  languageName: "Langue",
  languageSystem: "Système",
  renderFailure:
    "Cette partie de la page n'a pas pu être affichée. Les données des villes sont toujours chargées, donc l'afficher à nouveau peut fonctionner.",
  renderFailureRetry: "Afficher à nouveau",
  attribution: (source: string, license: string) =>
    `Données des villes de ${source}, sous licence ${license}. Modifié${NARROW_NO_BREAK_SPACE}: colonnes inutilisées supprimées, lignes triées par population.`,
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
  datasetError: TEXTE_ERREUR,
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
