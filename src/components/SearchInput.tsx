import { FiSearch } from "react-icons/fi";

import styles from "./SearchInput.module.scss";

/** The two strings this control shows, as one object so they move together. */
export interface SearchInputLabels {
  /** The accessible name: what the control does, not what it searches. */
  readonly name: string;
  /** The placeholder: what the collection being searched is called. */
  readonly placeholder: string;
}

interface SearchInputProps {
  readonly value: string;
  readonly onChange: (term: string) => void;
  readonly labels: SearchInputLabels;
}

/**
 * The search box above the table. The term is held nowhere here and reported
 * upward, and the event-to-term conversion happens at the only place that knows
 * an input event exists, which keeps the callback signature free of the DOM.
 *
 * a11y: the accessible name describes what the control does, so it is one word
 * and not the name of a collection. It still never varies by caller, which is
 * why it used to be a literal here; it now arrives as a catalog entry because
 * it does vary by language. The placeholder sits beside it because that text
 * names the collection being searched, which only the caller knows.
 */
export function SearchInput({ value, onChange, labels }: SearchInputProps) {
  /** Reports every keystroke upward; debouncing belongs to the request owner. */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchInput}>
        <FiSearch className={styles.searchIcon} />
        <input
          aria-label={labels.name}
          type="text"
          placeholder={labels.placeholder}
          value={value}
          onChange={handleSearchChange}
        />
      </div>
    </div>
  );
}
