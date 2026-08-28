import { useId } from "react";

import { useLocale } from "../../hooks/useLocale";
import { AUTONYMS } from "../../i18n/catalogs";
import { CATALOG_IDS } from "../../i18n/resolveLocale";
import styles from "./LocaleControl.module.scss";

/**
 * The language picker: following the machine, then one option per catalog that
 * ships, each named in its own language.
 *
 * A native select rather than the segmented control its neighbour uses. Five
 * options do not fit a row of buttons across a header bar, the page-size control
 * in the table below is already a native select, and the native control brings
 * keyboard handling, mobile behaviour and accessibility with nothing written by
 * hand.
 *
 * The option list is built from the shipped ids rather than written out, so a
 * catalog added later appears here without this file being edited.
 *
 * Its own two strings come from the catalog like every other word on the page.
 * The autonyms below do not, and must not: a reader who cannot read the
 * interface in front of them still has to find their own language in the list.
 */
export function LocaleControl() {
  const { catalog, choice, setChoice } = useLocale();

  // Document-global, so a constant here would give a second mounted control the
  // same id and bind both labels to the first select.
  const selectId = useId();

  return (
    <div className={styles.control}>
      {/* a11y: off screen rather than absent. The options name themselves, so a
          sighted reader needs no visible label, but the control still has to
          have a name in the accessibility tree. */}
      <label className={styles.label} htmlFor={selectId}>
        {catalog.languageName}
      </label>
      {/* A closed list, and the store rejects anything that is not on it, so
          nothing outside the shipped ids can become the chosen locale. */}
      <select
        id={selectId}
        className={styles.select}
        value={choice}
        onChange={(event) => {
          setChoice(event.target.value);
        }}
      >
        <option value="system">{catalog.languageSystem}</option>
        {CATALOG_IDS.map((id) => (
          <option key={id} value={id}>
            {AUTONYMS[id]}
          </option>
        ))}
      </select>
    </div>
  );
}
