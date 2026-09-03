import type { CatalogId } from "../resolveLocale";
import { en, type Catalog } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { pseudo } from "./pseudo";

/** Every catalog, by id, and total, so a new one cannot be forgotten here. */
export const CATALOGS: Readonly<Record<CatalogId, Catalog>> = {
  en,
  es,
  fr,
  "ar-XB": pseudo,
};

/** What each catalog calls itself, in its own language, never translated. */
export const AUTONYMS: Readonly<Record<CatalogId, string>> = {
  en: "English",
  es: "Español",
  fr: "Français",
  "ar-XB": "Pseudo (RTL)",
};
