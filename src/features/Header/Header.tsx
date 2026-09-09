import { useLocale } from "../../hooks/useLocale";
import type { DomainId } from "../../i18n/catalogs/en";
import styles from "./Header.module.css";
import { LocaleControl } from "./LocaleControl";
import { ThemeControl } from "./ThemeControl";

/**
 * Where each dataset lives. Relative, because the build serves from two bases.
 * Total over the domain union, so a third page cannot be left out of the nav.
 */
const PAGES: Readonly<Record<DomainId, string>> = {
  cities: "./",
  films: "./movies.html",
};

const DOMAIN_IDS = Object.keys(PAGES) as readonly DomainId[];

interface HeaderProps {
  /** The page being shown, whose link carries aria-current. */
  readonly domain: DomainId;
}

export function Header({ domain }: HeaderProps) {
  const { catalog } = useLocale();

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
      {/* The wordmark stays untranslated for the same reason the two names in
          the footer do. It is what the app calls itself, not copy about it. */}
      <span className={styles.title}>YART</span>
      {/* Plain links, because the datasets are two documents. A select that
          navigated on change would be the on-input trap, and it would lose
          middle-click and open-in-new-tab. */}
      {/* a11y: named, because the pagination landmark is a nav as well. */}
      <nav className={styles.nav} aria-label={catalog.common.datasetNav}>
        {DOMAIN_IDS.map((id) => (
          <a
            key={id}
            className={styles.link}
            href={PAGES[id]}
            aria-current={id === domain ? "page" : undefined}
          >
            {catalog[id].nav}
          </a>
        ))}
      </nav>
      {/* The theme control pins itself to the trailing edge with an automatic
          margin, so the picker follows it and the two read as one group at the
          end of the bar instead of one control stranded beside the title. */}
      <ThemeControl />
      <LocaleControl />
    </header>
  );
}
