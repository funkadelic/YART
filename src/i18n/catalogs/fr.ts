import { listFormatFor, numberFormatFor, selectPlural } from "../format";
import type {
  Catalog,
  DatasetErrorText,
  DomainCatalog,
  SortedDirection,
} from "./en";

/** Total over three categories. French puts zero in the singular. */
const VILLE = { one: "ville", many: "villes", other: "villes" };
const FILM = { one: "film", many: "films", other: "films" };
const RESULTAT = { one: "résultat", many: "résultats", other: "résultats" };
const ENTREE = { one: "entrée", many: "entrées", other: "entrées" };

/** The two sort directions, in the words the sentences below weave in. */
const ORDRE: Readonly<Record<SortedDirection, string>> = {
  asc: "croissant",
  desc: "décroissant",
};

/** U+202F, as an escape: inline it is indistinguishable from a space. */
const NARROW_NO_BREAK_SPACE = "\u202F";

/** Ce qui est annoncé au lecteur quand les données ne peuvent pas être chargées. */
const ERREUR_VILLES: DatasetErrorText = {
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

/** Écrites en entier : le nom décide du genre et de l'accord. */
const ERREUR_FILMS: DatasetErrorText = {
  notAnObject: () => "Les données des films n'ont pas pu être lues.",
  missingRows: () => "Le tableau de lignes est absent des données des films.",
  columnOrder: () =>
    "Les données des films ont un ordre de colonnes inattendu et n'ont pas été chargées.",
  rowShape: (tag, at) =>
    `La ligne ${numberFormatFor(tag).format(at)} des données des films n'a pas 7 champs et n'a pas été chargée.`,
  rowFieldType: (tag, at) =>
    `La ligne ${numberFormatFor(tag).format(at)} des données des films a un champ de type incorrect et n'a pas été chargée.`,
  transport: () =>
    "Les données des films n'ont pas pu être téléchargées. Vérifiez votre connexion et réessayez.",
  status: (tag, status) =>
    `Les données des films n'ont pas pu être téléchargées (statut ${numberFormatFor(tag).format(status)}).`,
  notJson: () =>
    "Les données des films ont été téléchargées, mais n'ont pas pu être lues au format JSON.",
  unexpected: () => "Une erreur inattendue s'est produite.",
};

/** Declared with satisfies, so a missing key is a compile error. */
export const fr = {
  common: {
    themeGroup: "Thème",
    themeLight: "Clair",
    themeDark: "Sombre",
    themeSystem: "Système",
    languageName: "Langue",
    languageSystem: "Système",
    renderFailureRetry: "Afficher à nouveau",
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
    pageStatus: (tag: string, page: number, totalPages: number) => {
      const number = numberFormatFor(tag);

      return `Page ${number.format(page)} sur ${number.format(totalPages)}`;
    },
    list: (tag: string, values: readonly string[]) =>
      listFormatFor(tag).format(values),
  },
  cities: {
    appTitle: "Liste des villes",
    renderFailure:
      "Cette partie de la page n'a pas pu être affichée. Les données des villes sont toujours chargées, donc l'afficher à nouveau peut fonctionner.",
    attribution: (source: string, license: string) =>
      `Données des villes de ${source}, sous licence ${license}. Modifié${NARROW_NO_BREAK_SPACE}: colonnes inutilisées supprimées, lignes triées par population.`,
    loading: "Téléchargement des données des villes...",
    empty: "Aucune ville trouvée",
    emptyAnnouncement: "Aucune ville trouvée pour cette recherche",
    results: (tag: string, shown: number, total: number) => {
      const number = numberFormatFor(tag);

      return `Affichage de ${number.format(shown)} ${selectPlural(tag, shown, VILLE)} sur ${number.format(total)} ${selectPlural(tag, total, RESULTAT)} au total`;
    },
    caption: (tag: string, total: number, sortSummary: string) =>
      `Données des villes avec ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTREE)}, actuellement ${sortSummary}`,
    searchPlaceholder: "Rechercher une ville",
    datasetError: ERREUR_VILLES,
    columns: {
      name: "Ville",
      country: "Pays",
      capital: "Capitale",
      countryIso3: "Code pays",
      population: "Population",
    },
  } satisfies DomainCatalog,
  films: {
    appTitle: "Liste des films",
    renderFailure:
      "Cette partie de la page n'a pas pu être affichée. Les données des films sont toujours chargées, donc l'afficher à nouveau peut fonctionner.",
    attribution: (source: string, license: string) =>
      `Données des films de ${source}, publiées sous ${license}. Le crédit est une courtoisie, car aucun n'est exigé. Modifié${NARROW_NO_BREAK_SPACE}: variables inutilisées supprimées, propriétés à valeurs multiples converties en tableaux, lignes limitées par le nombre de liens de site.`,
    loading: "Téléchargement des données des films...",
    empty: "Aucun film trouvé",
    emptyAnnouncement: "Aucun film trouvé pour cette recherche",
    results: (tag: string, shown: number, total: number) => {
      const number = numberFormatFor(tag);

      return `Affichage de ${number.format(shown)} ${selectPlural(tag, shown, FILM)} sur ${number.format(total)} ${selectPlural(tag, total, RESULTAT)} au total`;
    },
    caption: (tag: string, total: number, sortSummary: string) =>
      `Données des films avec ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTREE)}, actuellement ${sortSummary}`,
    searchPlaceholder: "Rechercher un film",
    datasetError: ERREUR_FILMS,
    columns: {
      title: "Titre",
      year: "Année",
      runtime: "Durée",
      directors: "Réalisateurs",
      genres: "Genres",
      countries: "Pays",
    },
  } satisfies DomainCatalog,
} satisfies Catalog;
