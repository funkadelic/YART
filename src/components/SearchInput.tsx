import { FiSearch } from "react-icons/fi";

import styles from "./SearchInput.module.scss";

interface SearchInputProps {
  readonly value: string;
  readonly onChange: (term: string) => void;
  readonly placeholder: string;
}

/**
 * The search box above the table.
 *
 * The term is reported upward rather than held here, so the control stays a
 * pure function of the value its owner already has. The event-to-term
 * conversion happens here, at the only place that knows an input event exists,
 * which keeps the callback signature free of the DOM.
 *
 * a11y: the accessible name is the single word "Search", which describes what
 * the control does rather than what it searches, so it is fixed here. The
 * placeholder is a prop because that text names the collection being searched
 * and only the caller knows it.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: SearchInputProps) {
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
          aria-label="Search"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleSearchChange}
        />
      </div>
    </div>
  );
}
