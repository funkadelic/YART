import { useLocale } from "../../hooks/useLocale";
import type { DomainId } from "../../i18n/catalogs/en";
import styles from "./Footer.module.scss";

// CC BY 4.0 asks for credit, a source link, a license link and a record of what
// changed. The catalog sentence carries all four in every language, which is why
// it is unconditional. The two names stay untranslated: they are identifiers.
const CITIES_SOURCE = "simplemaps.com World Cities";
const CITIES_LICENSE = "CC BY 4.0";

// CC0 asks for nothing at all. This credit is a courtesy the upstream data
// access page requests rather than an obligation, so nothing here should be
// built around a requirement that does not exist.
const FILMS_SOURCE = "Wikidata";
const FILMS_LICENSE = "CC0 1.0";

// Both sources on both pages: the site ships both datasets, so crediting both
// everywhere is honest and needs no per-page prop.
const CREDITS: readonly {
  readonly domain: DomainId;
  readonly source: string;
  readonly license: string;
}[] = [
  { domain: "cities", source: CITIES_SOURCE, license: CITIES_LICENSE },
  { domain: "films", source: FILMS_SOURCE, license: FILMS_LICENSE },
];

// A Map rather than an object literal: the key is a slice of catalog copy, and
// an object answers for every Object.prototype member as well as its own.
const LINK_URLS = new Map<string, string>([
  [CITIES_SOURCE, "https://simplemaps.com/data/world-cities"],
  [CITIES_LICENSE, "https://creativecommons.org/licenses/by/4.0/"],
  [FILMS_SOURCE, "https://www.wikidata.org/"],
  [FILMS_LICENSE, "https://creativecommons.org/publicdomain/zero/1.0/"],
]);

// Escaped on the way in: the keys are prose, and the dots in "CC BY 4.0" and
// "simplemaps.com" are wildcards unless quoted. Harmless over today's four,
// and a future source name carrying a parenthesis or a plus would throw here
// rather than anywhere a reader could connect to the name that caused it.
const escapeForPattern = (name: string) =>
  name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Splits a sentence around the four identifiers, so each can be a link wherever
// the sentence put it. One catalog entry rather than three fragments, which
// would hold every language to English word order.
const EMBEDDED_NAMES = new RegExp(
  `(${[...LINK_URLS.keys()].map(escapeForPattern).join("|")})`,
);

export function Footer() {
  const { catalog } = useLocale();

  return (
    <footer className={styles.footer}>
      {CREDITS.map(({ domain, source, license }) => (
        <p className={styles.credit} key={domain}>
          {catalog[domain]
            .attribution(source, license)
            .split(EMBEDDED_NAMES)
            .map((part) => {
              const href = LINK_URLS.get(part);

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
        </p>
      ))}
    </footer>
  );
}
