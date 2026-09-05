import { Fragment, useId } from "react";

import { useLocale } from "../../hooks/useLocale";
import { useTheme } from "../../hooks/useTheme";
import { THEME_CHOICES } from "../../theme/resolveTheme";
import type { ThemeChoice } from "../../theme/resolveTheme";
import styles from "./ThemeControl.module.scss";

/**
 * The theme picker: three states, all visible at once, so choosing the system
 * is as explicit as choosing a theme.
 *
 * a11y: every keyboard behavior the radiogroup pattern calls for comes from the
 * native inputs. Nothing here handles a key, and nothing here should. The
 * checked state is left to the inputs, because an ARIA attribute layered on top
 * of the property can only ever go stale against it.
 */
export function ThemeControl() {
  const { choice, setChoice } = useTheme();
  const { catalog } = useLocale();

  // A record rather than a label beside each value, so the option list stays
  // the one definition of what the states are.
  const names: Readonly<Record<ThemeChoice, string>> = {
    light: catalog.common.themeLight,
    dark: catalog.common.themeDark,
    system: catalog.common.themeSystem,
  };

  // Document-global, so a constant would put a second mounted control's radios
  // in this group and bind its labels to these inputs.
  const groupName = useId();

  return (
    <div
      className={styles.control}
      role="radiogroup"
      aria-label={catalog.common.themeGroup}
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
