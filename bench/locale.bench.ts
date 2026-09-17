// Locale negotiation, the label objects both tables take, and the sentences they weave.

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

/** Browser preference lists, one of which matches no catalog. */
const PREFERENCES = [
  ["en-GB", "en"],
  ["fr-CA", "fr", "en"],
  ["es-419", "es"],
  ["ja-JP", "ja"],
];

const { tag } = resolveLocale("en", []);
const labels = buildTableLabels(en, "cities", tag);

const failure = new DatasetError("rowShape", 41_237, "City row 41237");

const bench = withCodSpeed(new Bench());

bench
  .add(`resolve a locale for four preference lists, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const preferences of PREFERENCES) {
        resolveLocale("system", preferences);
      }
    });
  })
  .add(`build one locale's table and search labels, ${ROUNDS} rounds`, () => {
    rounds(() => {
      buildTableLabels(en, "cities", tag);
      buildSearchLabels(en, "cities");
    });
  })
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
  // Two live regions, the caption and the page status.
  .add(`weave the sentences one render shows, ${ROUNDS} rounds`, () => {
    rounds(() => {
      labels.results(100, 50_250);
      labels.caption(50_250, labels.sortSummary("Population", "desc"));
      labels.sortedAnnouncement("Population", "desc");
      labels.pagination.pageStatus(4, 503);
    });
  })
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
