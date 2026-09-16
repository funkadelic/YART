// Rows for the benchmarks to work over. Generated rather than read off the
// shipped datasets, because those arrive through the bundler as URL assets and
// a benchmark process has no bundler: importing either one here would pull the
// whole several-megabyte file into the measurement instead of the code under
// it.
//
// Generated rows have to be deterministic, or a measurement moves with the
// input and a comparison between two commits says nothing. Every value below
// comes from one seeded generator, so the same commit produces the same rows on
// every machine and every run.

import type { City } from "../src/api/getCities";
import type { Film } from "../src/api/getFilms";

/**
 * A seeded generator, because Math.random would reshuffle the input between
 * two runs and report the difference as a change in the code.
 *
 * mulberry32, which is small enough to read and has a period far beyond
 * anything these fixtures ask of it.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

// Syllables rather than a name list, so the generated text collates like the
// real thing: shared prefixes, mixed lengths, and the accented characters that
// decide whether a comparison stays in the collator's fast path.
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

/** The three values the upstream city dataset records in its capital column. */
const CAPITAL_CLASSES = ["primary", "admin", "minor"];

/** The film columns that carry lists, drawn from pools of the same shape. */
const GENRES = [
  "drama",
  "comedy",
  "thriller",
  "documentary",
  "animation",
  "romance",
  "western",
];

/** A word built from the syllable pool, so no two draws agree by accident. */
function word(next: () => number, syllables: number): string {
  let built = "";
  for (let at = 0; at < syllables; at += 1) {
    built += SYLLABLES[Math.floor(next() * SYLLABLES.length)] ?? "";
  }
  return built;
}

/** A word with its first character in upper case, the way a name reads. */
function name(next: () => number, syllables: number): string {
  const built = word(next, syllables);
  return built.charAt(0).toUpperCase() + built.slice(1);
}

/** One item drawn from a pool. */
function pick<T>(next: () => number, pool: readonly T[], at?: number): T {
  const index = at ?? Math.floor(next() * pool.length);
  // The pools above are non-empty and the index is inside them, so the
  // fallback is unreachable. It exists because an index read is typed as
  // possibly absent in this tree.
  return pool[index] ?? (pool[0] as T);
}

/** A list column's value: one to three items, occasionally empty. */
function list(next: () => number, pool: readonly string[]): readonly string[] {
  const length = Math.floor(next() * 4);
  return Array.from({ length }, () => pick(next, pool));
}

/**
 * Cities shaped like the shipped dataset: a name and an ascii name that differ
 * for the accented rows, a country and its code, a capital class and a
 * population.
 *
 * A share of the rows carries a zero population and an empty ascii name,
 * because the real asset does and both are what the comparison calls blank.
 * Without them the sort benchmarks would never reach the branch that orders a
 * blank last.
 */
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
      // Stripped of the accents the syllable pool carries, which is the
      // relationship the two columns have upstream.
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

/**
 * Films shaped like the shipped dataset: a title, a year and a runtime that are
 * both null on part of the set, and three list columns.
 *
 * The nulls and the empty lists are the blanks of this dataset, and the list
 * columns are the ones the film table orders with a comparator of its own.
 */
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
