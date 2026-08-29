import { useLocale } from "../../hooks/useLocale";
import styles from "./Footer.module.scss";

// CC BY 4.0 asks for four things: credit the creator, link the source, link the
// licence, and say whether the work was changed. The catalog sentence is the
// whole of that obligation in every language, which is why it is unconditional
// and why Footer.test.tsx asserts it in more than one. Both modifications named
// there are corroborated by src/data/worldcities/license.txt and by what
// scripts/generate-cities.mjs does.
//
// The two names and the two addresses stay untranslated and stay here. They are
// identifiers rather than copy: the source calls itself this, and the licence
// identifier is what both a machine and a lawyer read.
const SOURCE_NAME = "simplemaps.com World Cities";
const LICENSE_NAME = "CC BY 4.0";

const LINK_URLS: Readonly<Record<string, string>> = {
  [SOURCE_NAME]: "https://simplemaps.com/data/world-cities",
  [LICENSE_NAME]: "https://creativecommons.org/licenses/by/4.0/",
};

// Splits the sentence around the two identifiers, keeping each as a part of its
// own so it can be rendered as a link wherever the sentence put it. One catalog
// entry rather than the three fragments this would otherwise need: three would
// hold every language to English word order, and the pseudo-locale exists partly
// to make a sentence assembled out of several entries visible as several
// bracketed units.
//
// The only regular expression metacharacter in either name is a dot, which
// matches the dot it stands for.
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

            // The part itself is the key. The split alternates run of text
            // with identifier, so no two siblings carry the same string, and
            // the position a part sits at is exactly what a translation is
            // free to move.
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
