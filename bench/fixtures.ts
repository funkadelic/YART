// Seeded rows shaped like the shipped datasets, which import as URL assets a
// benchmark process has no bundler to resolve.

import type { City } from "../src/api/getCities";
import type { Film } from "../src/api/getFilms";

/** mulberry32, so every run gets the same rows. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

// Syllables with accents, so generated names collate like real ones.
const SYLLABLES = [
  "ba",
  "cé",
  "dor",
  "en",
  "fa",
  "gri",
  "ha",
  "il",
  "jo",
  "kra",
  "lun",
  "mär",
  "nov",
  "os",
  "pra",
  "qui",
  "rø",
  "san",
  "tre",
  "ul",
  "vik",
  "wen",
  "xi",
  "yar",
  "zu",
];

/** The capital column's upstream values. */
const CAPITAL_CLASSES = ["primary", "admin", "minor"];

/** The genre pool for the film list columns. */
const GENRES = [
  "drama",
  "comedy",
  "thriller",
  "documentary",
  "animation",
  "romance",
  "western",
];

/** A word built from the syllable pool. */
function word(next: () => number, syllables: number): string {
  let built = "";
  for (let at = 0; at < syllables; at += 1) {
    built += SYLLABLES[Math.floor(next() * SYLLABLES.length)] ?? "";
  }
  return built;
}

/** A word with its first character in upper case. */
function name(next: () => number, syllables: number): string {
  const built = word(next, syllables);
  return built.charAt(0).toUpperCase() + built.slice(1);
}

/** One item drawn from a pool. */
function pick<T>(next: () => number, pool: readonly T[], at?: number): T {
  const index = at ?? Math.floor(next() * pool.length);
  // Unreachable: the pools are non-empty. Indexed reads are typed as possibly absent.
  return pool[index] ?? (pool[0] as T);
}

/** A list column's value: one to three items, occasionally empty. */
function list(next: () => number, pool: readonly string[]): readonly string[] {
  const length = Math.floor(next() * 4);
  return Array.from({ length }, () => pick(next, pool));
}

/** Cities, about 1% with a zero population and empty ascii name so the blank-last branch runs. */
export function cityRows(count: number): City[] {
  const next = seeded(0x59_41_52_54);
  const countries = Array.from({ length: 180 }, () => name(next, 2));

  return Array.from({ length: count }, (_, at) => {
    const cityName = name(next, 2 + Math.floor(next() * 2));
    const country = pick(next, countries);
    const blank = next() < 0.01;

    return {
      id: 1004003059 + at,
      name: cityName,
      // The accent-stripped name, as upstream.
      nameAscii: blank
        ? ""
        : cityName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      country,
      countryIso3: country.slice(0, 3).toUpperCase(),
      capital: pick(next, CAPITAL_CLASSES, at % CAPITAL_CLASSES.length),
      population: blank ? 0 : Math.floor(next() * 37_400_068),
    };
  });
}

/** Films, with null years and runtimes and empty lists as the dataset's blanks. */
export function filmRows(count: number): Film[] {
  const next = seeded(0x46_49_4c_4d);
  const people = Array.from({ length: 400 }, () => name(next, 2));
  const countries = Array.from({ length: 120 }, () => name(next, 2));

  return Array.from({ length: count }, (_, at) => {
    const missing = next() < 0.05;

    return {
      id: `Q${String(100000 + at)}`,
      title: name(next, 2 + Math.floor(next() * 3)),
      year: missing ? null : 1895 + Math.floor(next() * 130),
      runtime: missing ? null : 40 + Math.floor(next() * 140),
      directors: list(next, people),
      genres: list(next, GENRES),
      countries: list(next, countries),
    };
  });
}
