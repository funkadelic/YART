import styles from "./Header.module.css";
import { ThemeControl } from "./ThemeControl";

export function Header() {
  return (
    <header className={styles.header}>
      <svg
        className={styles.logo}
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <rect className={styles.logoMark} width="32" height="32" rx="6" />
        <path
          className={styles.logoRule}
          d="M8 11h16M8 16h16M8 21h10"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className={styles.title}>YART</span>
      <ThemeControl />
    </header>
  );
}
