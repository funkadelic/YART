import { FiSearch } from "react-icons/fi";

import styles from "./SearchInput.module.scss";

/**
 * The two strings this control shows.
 *
 * One object rather than two loose props, so the pair moves together when the
 * language does and a caller cannot supply half of it.
 */
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
 * The search box above the table.
 *
 * The term is reported upward rather than held here, so the control stays a
 * pure function of the value its owner already has. The event-to-term
 * conversion happens here, at the only place that knows an input event exists,
 * which keeps the callback signature free of the DOM.
 *
 * a11y: the accessible name describes what the control does rather than what it
 * searches, which is why it is one word and not the name of a collection. That
 * is still true and is now a catalog entry rather than a literal: the reason it
 * was fixed here was that it never varies by caller, and the reason it is no
 * longer fixed here is that it does vary by language. The placeholder sits
 * beside it because that text names the collection being searched, which only
 * the caller knows.
 */
export function SearchInput({ value, onChange, labels }: SearchInputProps) {
  /**
   * Reports every keystroke upward. Debouncing belongs to whoever owns the
   * request, not to the control.
   */
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
