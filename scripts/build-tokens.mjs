/**
 * Builds src/styles/tokens.css from tokens/tokens.json with Style Dictionary.
 * Run it with `npm run tokens:build`; the output is committed.
 */

import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import StyleDictionary from "style-dictionary";
import prettier from "prettier";

// Resolved from this file, so a CLI run and a test import agree on the paths.
const root = join(import.meta.dirname, "..");
const SOURCE = join(root, "tokens", "tokens.json");
const DESTINATION = join(root, "src", "styles", "tokens.css");

const HEADER = `/* Generated from tokens/tokens.json by scripts/build-tokens.mjs. Do not edit:
   change the JSON and run \`npm run tokens:build\`. Each themed color is one
   light-dark pair whose side follows color-scheme, set per theme in index.css. */

`;

/** Whether a token value is a {light, dark} pair. */
function isThemePair(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    "light" in value &&
    "dark" in value
  );
}

/** A pair as light-dark(), any other value as written. */
function formatValue(value) {
  return isThemePair(value)
    ? `light-dark(${value.light}, ${value.dark})`
    : value;
}

StyleDictionary.registerFormat({
  name: "css/tokens",
  format: ({ dictionary }) => {
    // Primitives stay in the dictionary for alias resolution and are never written.
    const lines = dictionary.allTokens
      .filter((token) => token.path[0] !== "primitive")
      .map((token, index) => {
        // stylelint wants a blank line before a comment, except the first in a block.
        const comment = token.$description
          ? `${index ? "\n" : ""}  /* ${token.$description} */\n`
          : "";
        return `${comment}  --${token.name}: ${formatValue(token.$value)};`;
      });
    return `${HEADER}:root {\n${lines.join("\n")}\n}\n`;
  },
});

/** The generated stylesheet, formatted by Prettier, without writing it. */
export async function buildCss() {
  const sd = new StyleDictionary({
    source: [SOURCE],
    platforms: {
      css: {
        transforms: ["name/kebab"],
        files: [{ destination: DESTINATION, format: "css/tokens" }],
      },
    },
  });
  const [file] = await sd.formatPlatform("css");
  const config = await prettier.resolveConfig(DESTINATION);
  return prettier.format(file.output, { ...config, filepath: DESTINATION });
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await writeFile(DESTINATION, await buildCss());
}
