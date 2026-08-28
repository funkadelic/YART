import type { CatalogId } from "../resolveLocale";
import { en, type Catalog } from "./en";

/**
 * Every catalog, by id.
 *
 * Total over the closed union rather than looked up with a fallback, so a value
 * that somehow reached here unchecked still cannot find a missing arm, and a
 * catalog added later cannot be forgotten here without failing the type check.
 *
 * The three catalogs beside the base one are not written yet, so every id reads
 * the base for the moment. A hole would be the one shape this record exists to
 * rule out.
 */
export const CATALOGS: Readonly<Record<CatalogId, Catalog>> = {
  en,
  es: en,
  fr: en,
  "ar-XB": en,
};

/**
 * What each catalog calls itself, written in its own language and never
 * translated. A reader who cannot read the interface they are looking at has to
 * be able to find their own language in the picker, which is the whole job of
 * this record and the reason there is exactly one literal per id.
 */
export const AUTONYMS: Readonly<Record<CatalogId, string>> = {
  en: "English",
  es: "Español",
  fr: "Français",
  "ar-XB": "Pseudo (RTL)",
};
