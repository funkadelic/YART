import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <svg
        className={styles.logo}
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="32" height="32" rx="6" fill="#f45d48" />
        <path
          d="M8 11h16M8 16h16M8 21h10"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className={styles.title}>YART</span>
    </header>
  );
}
