import { useEffect, useSyncExternalStore } from "react";

import { CATALOGS } from "../i18n/catalogs";
import {
  getChoiceSnapshot,
  getLocaleSnapshot,
  setLocaleChoice,
  subscribeLocale,
} from "../i18n/localeStore";

/**
 * Owns the reader's locale for one component: the choice, the catalog its
 * strings come from, the tag the platform formatters take, and the two
 * attributes the document element carries.
 *
 * Many instances by construction, which is the opposite of the theme hook
 * beside it and worth stating rather than inheriting. That hook holds its choice
 * per caller, so two callers hold two choices and their two effects race on one
 * document element. This one holds no state at all: the choice lives in a single
 * module-scope store, so every subscriber resolves the identical value and the
 * duplicate writes below agree by construction rather than by there being only
 * one of them.
 *
 * The language attribute takes the resolved tag rather than the catalog id. The
 * tag is the field that is a well formed language tag for every catalog, the
 * pseudo-locale's strings really are English, and it keeps the attribute naming
 * the same locale the platform formatters are given.
 */
export function useLocale() {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot);
  const choice = useSyncExternalStore(subscribeLocale, getChoiceSnapshot);

  useEffect(() => {
    // Both, because the inline script sets both before first paint and the one
    // left unmaintained goes stale the first time the reader chooses.
    document.documentElement.lang = locale.tag;
    document.documentElement.dir = locale.dir;
  }, [locale]);

  return {
    choice,
    // The store's own setter, which already holds one identity for the life of
    // the document, so nothing here has to memoize it back into one.
    setChoice: setLocaleChoice,
    catalog: CATALOGS[locale.catalog],
    tag: locale.tag,
    dir: locale.dir,
  };
}
