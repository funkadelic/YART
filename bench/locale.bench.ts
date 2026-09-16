// The locale layer: the negotiation that turns a stored choice and the
// machine's preference list into one resolved locale, the label objects both
// tables take as props, and the sentences those labels weave.
//
// The negotiation runs before the first paint, the labels are rebuilt whenever
// the catalog or the tag moves, and the sentences are re-woven on every render
// that changes a count, which is every search and every page press.

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

import { DatasetError } from "../src/data/loadEnvelope";
import {
  buildSearchLabels,
  buildTableLabels,
} from "../src/features/tableLabels";
import { CATALOGS } from "../src/i18n/catalogs";
import { en } from "../src/i18n/catalogs/en";
import { datasetErrorText } from "../src/i18n/datasetErrorText";
import { CATALOG_IDS, resolveLocale } from "../src/i18n/resolveLocale";
import { ROUNDS, report, rounds } from "./harness";

/** Preference lists a browser sends, including one that matches no catalog. */
const PREFERENCES = [
  ["en-GB", "en"],
  ["fr-CA", "fr", "en"],
  ["es-419", "es"],
  ["ja-JP", "ja"],
];

const { tag } = resolveLocale("en", []);
const labels = buildTableLabels(en, "cities", tag);

/** A failure carrying a row number, which is the message that formats one. */
const failure = new DatasetError("rowShape", 41_237, "City row 41237");

const bench = withCodSpeed(new Bench());

bench
  // The read that happens before the first paint, over every preference list
  // shape including the one that falls through to the default.
  .add(`resolve a locale for four preference lists, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const preferences of PREFERENCES) {
        resolveLocale("system", preferences);
      }
    });
  })
  // What one language change costs the two tables: both label objects for the
  // catalog that was chosen.
  .add(`build one locale's table and search labels, ${ROUNDS} rounds`, () => {
    rounds(() => {
      buildTableLabels(en, "cities", tag);
      buildSearchLabels(en, "cities");
    });
  })
  // The same for every catalog and both domains, which is the whole picker.
  .add(`build both domains' labels for every catalog, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const id of CATALOG_IDS) {
        const resolved = resolveLocale(id, []);
        buildTableLabels(CATALOGS[id], "cities", resolved.tag);
        buildTableLabels(CATALOGS[id], "films", resolved.tag);
        buildSearchLabels(CATALOGS[id], "cities");
        buildSearchLabels(CATALOGS[id], "films");
      }
    });
  })
  // The sentences a render weaves: two live regions, a caption and the page
  // status, each of them grouping a number and selecting a plural form.
  .add(`weave the sentences one render shows, ${ROUNDS} rounds`, () => {
    rounds(() => {
      labels.results(100, 50_250);
      labels.caption(50_250, labels.sortSummary("Population", "desc"));
      labels.sortedAnnouncement("Population", "desc");
      labels.pagination.pageStatus(4, 503);
    });
  })
  // The failure path, which formats a row number into a sentence per catalog.
  .add(`render a dataset failure in every catalog, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const id of CATALOG_IDS) {
        const resolved = resolveLocale(id, []);
        datasetErrorText(failure, CATALOGS[id].cities, resolved.tag);
      }
    });
  });

await bench.run();
report(bench);
