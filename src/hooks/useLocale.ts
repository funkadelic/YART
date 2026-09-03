import { useEffect, useSyncExternalStore } from "react";

import { CATALOGS } from "../i18n/catalogs";
import {
  getChoiceSnapshot,
  getLocaleSnapshot,
  setLocaleChoice,
  subscribeLocale,
} from "../i18n/localeStore";

/** Many instances by construction, because it holds no state of its own. */
export function useLocale() {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot);
  const choice = useSyncExternalStore(subscribeLocale, getChoiceSnapshot);

  useEffect(() => {
    // Both, because the inline script sets both before first paint and either
    // one left unmaintained goes stale the first time the reader chooses.
    document.documentElement.lang = locale.tag;
    document.documentElement.dir = locale.dir;
  }, [locale]);

  return {
    choice,
    // The store's own setter, already one identity for the life of the
    // document, so nothing here has to memoize it back into one.
    setChoice: setLocaleChoice,
    catalog: CATALOGS[locale.catalog],
    tag: locale.tag,
    dir: locale.dir,
  };
}
