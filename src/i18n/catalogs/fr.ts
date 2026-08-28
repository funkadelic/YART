import { numberFormatFor, selectPlural } from "../format";
import type { Catalog } from "./en";

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
 * like a typo to a reviewer and to the formatter, and it is neither. The same
 * character is already in every grouped number these sentences carry, put there
 * by the formatter rather than by hand, which is why no test here types one.
 */
export const fr = {
  loading: "Téléchargement des données des villes...",
  empty: "Aucune ville trouvée",
  emptyAnnouncement: "Aucune ville trouvée pour cette recherche",
  results: (tag: string, shown: number, total: number) => {
    const number = numberFormatFor(tag);

    return `Affichage de ${number.format(shown)} ${selectPlural(tag, shown, VILLE)} sur ${number.format(total)} ${selectPlural(tag, total, RESULTAT)} au total`;
  },
  caption: (tag: string, total: number, sortSummary: string) =>
    `Données des villes avec ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTREE)}, actuellement ${sortSummary}`,
} satisfies Catalog;
