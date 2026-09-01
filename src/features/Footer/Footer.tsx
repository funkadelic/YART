import { useLocale } from "../../hooks/useLocale";
import styles from "./Footer.module.scss";

// CC BY 4.0 asks for credit, a source link, a license link and a record of what
// changed. The catalog sentence carries all four in every language, which is why
// it is unconditional. The two names stay untranslated: they are identifiers.
const SOURCE_NAME = "simplemaps.com World Cities";
const LICENSE_NAME = "CC BY 4.0";

const LINK_URLS: Readonly<Record<string, string>> = {
  [SOURCE_NAME]: "https://simplemaps.com/data/world-cities",
  [LICENSE_NAME]: "https://creativecommons.org/licenses/by/4.0/",
};

// Splits the sentence around the two identifiers, so each can be a link
// wherever the sentence put it. One catalog entry rather than three fragments,
// which would hold every language to English word order.
const EMBEDDED_NAMES = new RegExp(`(${SOURCE_NAME}|${LICENSE_NAME})`);

export function Footer() {
  const { catalog } = useLocale();

  return (
    <footer className={styles.footer}>
      <span>
        {catalog
          .attribution(SOURCE_NAME, LICENSE_NAME)
          .split(EMBEDDED_NAMES)
          .map((part) => {
            const href = LINK_URLS[part];

            // The part itself is the key: the split alternates text with
            // identifier, and position is what a translation may move.
            return href === undefined ? (
              part
            ) : (
              <a key={part} href={href}>
                {part}
              </a>
            );
          })}
      </span>
    </footer>
  );
}
