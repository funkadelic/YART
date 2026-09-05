/**
 * Generates the committed city dataset asset, src/data/worldcities/cities.json,
 * from the upstream simplemaps World Cities CSV export.
 *
 * Run it with `npm run generate:cities`. Its only inputs and outputs are files
 * inside this repository: no network client is imported, so regenerating the
 * dataset can never introduce a build-time trust boundary.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
// Imported explicitly, so this file is clean under the browser-globals lint
// config the rest of the repo uses.
import process from "node:process";

// Resolved from this file's own location, because the working directory is
// wherever npm happened to be invoked and is not necessarily the project root.
const dataDir = join(import.meta.dirname, "..", "src", "data", "worldcities");
const DEFAULT_INPUT_PATH = join(dataDir, "worldcities.csv");
const OUTPUT_PATH = join(dataDir, "cities.json");

/**
 * The version stamped into the envelope: the upstream release recorded in
 * license.txt, followed by a repo-local revision counter.
 *
 * Bump the +rN suffix whenever this generator's output changes for a reason other
 * than an upstream release. The upstream version alone cannot distinguish two
 * different local transforms of the same release, so without the counter a
 * consumer reading `version` cannot tell which transform it is holding.
 */
const DATASET_VERSION = "1.91.3+r1";

/**
 * The single declaration of column order in this generator. It must equal the
 * COLUMNS constant in src/data/worldcities/cities.ts, which asserts the asset's
 * declared order and refuses the payload when the two disagree.
 */
const COLUMN_ORDER = Object.freeze([
  "id",
  "name",
  "nameAscii",
  "country",
  "countryIso3",
  "capital",
  "population",
]);

/**
 * The upstream fields each column is read from, in column order.
 */
const SOURCE_FIELDS = Object.freeze([
  "id",
  "city",
  "city_ascii",
  "country",
  "iso3",
  "capital",
  "population",
]);

/**
 * Wraps the rows in the envelope the loader expects. The declared column list
 * turns the tuple shape's one real defect, a silently shifted field, into a
 * loud startup failure.
 */
export function buildEnvelope(rows) {
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== COLUMN_ORDER.length) {
      throw new Error(
        `Row ${index} is not an array of ${COLUMN_ORDER.length} elements.`,
      );
    }
  });

  return { version: DATASET_VERSION, columns: COLUMN_ORDER, rows };
}

/**
 * Serializes the envelope with every row on its own line.
 *
 * The line-per-row layout makes a single corrected city a one-line diff, which
 * is the reason the tuple shape was chosen. A plain JSON.stringify puts the
 * whole payload on one line roughly 3.3 MB wide, and the reviewability argument
 * for this shape collapses with it. The cost is about 1.3% gzipped.
 */
export function formatEnvelope(envelope) {
  const lines = [
    "{",
    `  "version": ${JSON.stringify(envelope.version)},`,
    `  "columns": ${JSON.stringify(envelope.columns)},`,
    '  "rows": [',
  ];

  if (envelope.rows.length > 0) {
    lines.push(
      envelope.rows.map((row) => `    ${JSON.stringify(row)}`).join(",\n"),
    );
  }

  lines.push("  ]", "}", "");

  return lines.join("\n");
}

/**
 * Splits CSV text into records, honoring quoted fields with embedded commas,
 * doubled quotes, and newlines.
 */
function splitCsvRecords(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;

  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[at + 1] === '"') {
        field += '"';
        at += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}

/**
 * Maps the upstream CSV export onto the envelope's column order.
 *
 * Rows are ordered by descending population, ties broken by ascending id, so the
 * transform is deterministic for a given input.
 */
export function parseWorldCitiesCsv(text) {
  const records = splitCsvRecords(text);
  if (records.length === 0) {
    throw new Error("The CSV export is empty.");
  }

  const header = records[0].map((name) => name.trim());
  const columnAt = SOURCE_FIELDS.map((name) => {
    const at = header.indexOf(name);
    if (at === -1) {
      throw new Error(`The CSV export has no ${name} column.`);
    }
    return at;
  });

  // Two upstream rows carry no id. Numbering them from 1 cannot collide, because
  // every real id is at least 1004003059.
  let syntheticId = 0;

  // Number() turns anything unparseable into NaN, and typeof NaN is "number",
  // so NaN survives every gate downstream: the asset test's per-row typecheck
  // and the parse boundary in cities.ts both wave it through, and the table
  // renders the string "NaN". This is the only place it can be caught, so a
  // corrupt upstream export fails the generator instead of shipping.
  const numericOrThrow = (raw, field, at) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(
        `CSV row ${at} has a ${field} that is not a number: ${JSON.stringify(raw)}`,
      );
    }
    return value;
  };

  const rows = records
    .slice(1)
    .filter((record) => record.length > 1)
    .map((record, index) => {
      const values = columnAt.map((at) => record[at] ?? "");
      const [rawId, city, cityAscii, country, iso3, capital, rawPopulation] =
        values;

      return [
        rawId.trim() === ""
          ? (syntheticId += 1)
          : numericOrThrow(rawId.trim(), "id", index + 2),
        city,
        cityAscii === "" ? city : cityAscii,
        country,
        iso3,
        capital,
        rawPopulation.trim() === ""
          ? 0
          : numericOrThrow(rawPopulation.trim(), "population", index + 2),
      ];
    });

  rows.sort((left, right) => right[6] - left[6] || left[0] - right[0]);

  return rows;
}

function main(args) {
  const inputPath = args[0] ? resolve(args[0]) : DEFAULT_INPUT_PATH;

  if (!existsSync(inputPath)) {
    process.stderr.write(
      `No upstream CSV export at ${inputPath}.\n` +
        "Download the basic World Cities database from " +
        "https://simplemaps.com/data/world-cities and unzip worldcities.csv " +
        "to that path.\n",
    );
    process.exitCode = 1;
    return;
  }

  const rows = parseWorldCitiesCsv(readFileSync(inputPath, "utf8"));
  writeFileSync(OUTPUT_PATH, formatEnvelope(buildEnvelope(rows)), "utf8");
  process.stdout.write(`Wrote ${rows.length} rows to ${OUTPUT_PATH}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2));
}
