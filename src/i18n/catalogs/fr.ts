import type { Catalog } from "./en";

/**
 * The French catalog.
 *
 * Declared with satisfies rather than annotated with it, so a missing key and a
 * misspelled key are both compile errors while the literal types of the entries
 * survive for anything that wants to read them.
 *
 * French typography puts a narrow no-break space, U+202F, before a colon, a
 * semicolon, an exclamation mark and a question mark. None of the five entries
 * below ends in one yet, so none carries the character today. When one does, the
 * space is a translation requirement rather than a stray character: it will look
 * like a typo to a reviewer and to the formatter, and it is neither.
 */
export const fr = {
  loading: "Téléchargement des données des villes...",
  empty: "Aucune ville trouvée",
  emptyAnnouncement: "Aucune ville trouvée pour cette recherche",
  results: (tag: string, shown: number, total: number) =>
    `Affichage de ${shown} villes sur ${total} résultats au total`,
  caption: (tag: string, total: number, sortSummary: string) =>
    `Données des villes avec ${total} entrées, actuellement ${sortSummary}`,
} satisfies Catalog;
