import { Fragment } from "react";

import { useTheme } from "../../hooks/useTheme";
import type { ThemeChoice } from "../../theme/resolveTheme";
import styles from "./ThemeControl.module.scss";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

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

  return (
    <div className={styles.control} role="radiogroup" aria-label="Theme">
      {OPTIONS.map((option) => (
        <Fragment key={option.value}>
          <input
            className={styles.input}
            type="radio"
            id={`theme-${option.value}`}
            name="theme"
            value={option.value}
            checked={choice === option.value}
            onChange={() => setChoice(option.value)}
          />
          <label className={styles.label} htmlFor={`theme-${option.value}`}>
            {option.label}
          </label>
        </Fragment>
      ))}
    </div>
  );
}
