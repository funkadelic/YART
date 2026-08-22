import styles from "./Footer.module.scss";

// CC BY 4.0 asks for four things: credit the creator, link the source, link the
// licence, and say whether the work was changed. The line below is the whole of
// that obligation, which is why it is unconditional and why Footer.test.tsx
// asserts it. Both modifications named here are corroborated by
// src/data/worldcities/license.txt and by what scripts/generate-cities.mjs does.
const SOURCE_URL = "https://simplemaps.com/data/world-cities";
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
const MODIFICATIONS =
  "Modified: unused columns removed, rows ordered by population.";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>
        City data from <a href={SOURCE_URL}>simplemaps.com World Cities</a>,
        licensed <a href={LICENSE_URL}>CC BY 4.0</a>. {MODIFICATIONS}
      </span>
    </footer>
  );
}
