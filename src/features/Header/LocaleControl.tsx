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
 * Its own two strings are English literals rather than catalog entries, which is
 * deliberate and temporary: they move into the catalogs with the rest of the
 * chrome, and inventing keys for them here would put two of the catalog's keys
 * in a different plan from the other twenty.
 */
export function LocaleControl() {
  const { choice, setChoice } = useLocale();

  // Document-global, so a constant here would give a second mounted control the
  // same id and bind both labels to the first select.
  const selectId = useId();

  return (
    <div className={styles.control}>
      {/* a11y: off screen rather than absent. The options name themselves, so a
          sighted reader needs no visible label, but the control still has to
          have a name in the accessibility tree. */}
      <label className={styles.label} htmlFor={selectId}>
        Language
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
        <option value="system">System</option>
        {CATALOG_IDS.map((id) => (
          <option key={id} value={id}>
            {AUTONYMS[id]}
          </option>
        ))}
      </select>
    </div>
  );
}
