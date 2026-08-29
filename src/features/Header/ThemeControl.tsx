import { Fragment, useId } from "react";

import { useLocale } from "../../hooks/useLocale";
import { useTheme } from "../../hooks/useTheme";
import { THEME_CHOICES } from "../../theme/resolveTheme";
import type { ThemeChoice } from "../../theme/resolveTheme";
import styles from "./ThemeControl.module.scss";

/**
 * The theme picker: three states, all visible at once, so choosing the operating
 * system is as explicit as choosing a theme rather than being the absence of a
 * choice.
 *
 * a11y: every keyboard behaviour the radiogroup pattern calls for comes from the
 * native inputs. Three radios sharing a name give arrow-key movement, wrap
 * around, and one tab stop for the group, entered at the checked option. Nothing
 * here handles a key, and nothing here should: the previous phase deliberately
 * removed exactly this class of hand-written key handling from the sort header.
 *
 * This diverges from the pattern's non-native form in one place, deliberately:
 * the checked state is left entirely to the inputs and no ARIA attribute
 * restates it. Native radios already expose it through the property, and an
 * attribute layered on top can only ever go stale against it. The prose here
 * avoids naming that attribute so a search for it finds live code rather than a
 * mention of it.
 */
export function ThemeControl() {
  const { choice, setChoice } = useTheme();
  const { catalog } = useLocale();

  // The three states are offered in the order the theme vocabulary declares
  // them, and each is named from the catalog. A record rather than a label
  // beside each value, so the option list stays the one definition of what the
  // states are and this is only how they are spelled.
  const names: Readonly<Record<ThemeChoice, string>> = {
    light: catalog.themeLight,
    dark: catalog.themeDark,
    system: catalog.themeSystem,
  };

  // The id and the radio name are both document-global, so writing either as a
  // constant makes a second mounted control produce duplicate ids and put all
  // six radios in one group, where every label binds to the first matching
  // input. Generated per instance, the two controls cannot reach each other.
  const groupName = useId();

  return (
    <div
      className={styles.control}
      role="radiogroup"
      aria-label={catalog.themeGroup}
    >
      {THEME_CHOICES.map((value) => (
        <Fragment key={value}>
          <input
            className={styles.input}
            type="radio"
            id={`${groupName}-${value}`}
            name={groupName}
            value={value}
            checked={choice === value}
            onChange={() => setChoice(value)}
          />
          <label className={styles.label} htmlFor={`${groupName}-${value}`}>
            {names[value]}
          </label>
        </Fragment>
      ))}
    </div>
  );
}
