import { useId } from "react";

import { useLocale } from "../../hooks/useLocale";
import { AUTONYMS } from "../../i18n/catalogs";
import { CATALOG_IDS } from "../../i18n/resolveLocale";
import styles from "./LocaleControl.module.scss";

/**
 * The language picker: follow the machine, then one option per shipped catalog,
 * each named in its own language. A native select rather than the segmented
 * control beside it, because five options do not fit a row of buttons and the
 * native control brings its keyboard and mobile behavior with it.
 */
export function LocaleControl() {
  const { catalog, choice, setChoice } = useLocale();

  // Document-global, so a constant would bind two labels to one select.
  const selectId = useId();

  return (
    <div className={styles.control}>
      {/* a11y: off screen rather than absent. The options name themselves, so a
          sighted reader needs no visible label, but the control still has to
          have a name in the accessibility tree. */}
      <label className={styles.label} htmlFor={selectId}>
        {catalog.common.languageName}
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
        <option value="system">{catalog.common.languageSystem}</option>
        {CATALOG_IDS.map((id) => (
          <option key={id} value={id}>
            {AUTONYMS[id]}
          </option>
        ))}
      </select>
    </div>
  );
}
