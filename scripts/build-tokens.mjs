/**
 * Builds src/styles/tokens.css from the DTCG files in tokens/ with Style
 * Dictionary. Run it with `npm run tokens:build`; the output is committed.
 */

import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import StyleDictionary from "style-dictionary";
import prettier from "prettier";

// Resolved from this file, so a CLI run and a test import agree on the paths.
const root = join(import.meta.dirname, "..");
const TOKENS = join(root, "tokens");
const BASE = join(TOKENS, "base.tokens.json");
const DESTINATION = join(root, "src", "styles", "tokens.css");

const HEADER = `/* Generated from the files in tokens/ by scripts/build-tokens.mjs. Do not edit:
   change the JSON and run \`npm run tokens:build\`. Each themed color is one
   light-dark pair whose side follows color-scheme, set per theme in index.css. */

`;

/** A hex in its three-digit form where it has one, which stylelint requires. */
function shortHex(value) {
  return value.replace(/^#([\da-f])\1([\da-f])\2([\da-f])\3$/i, "#$1$2$3");
}

/** One theme's tokens as CSS values, primitives dropped, themed ones marked. */
async function themeTokens(theme) {
  const themeFile = join(TOKENS, `${theme}.tokens.json`);
  const sd = new StyleDictionary({
    // Theme first, so the themed colors lead the stylesheet.
    source: [themeFile, BASE],
    platforms: {
      css: { transforms: ["name/kebab", "color/hex", "size/rem"] },
    },
  });
  const { allTokens } = await sd.getPlatformTokens("css");
  return allTokens
    .filter((token) => token.path[0] !== "primitive")
    .map((token) => ({ ...token, themed: token.filePath === themeFile }));
}

/** Names of the tokens a theme file declares, in a comparable form. */
function themedNames(tokens) {
  return tokens
    .filter((token) => token.themed)
    .map((token) => token.name)
    .sort()
    .join();
}

/** The generated stylesheet, formatted by Prettier, without writing it. */
export async function buildCss() {
  const light = await themeTokens("light");
  const dark = await themeTokens("dark");
  if (themedNames(light) !== themedNames(dark)) {
    throw new Error(
      "light.tokens.json and dark.tokens.json declare different colors",
    );
  }
  const darkValues = new Map(dark.map((token) => [token.name, token.$value]));

  const lines = light.map((token, index) => {
    const value = token.themed
      ? `light-dark(${shortHex(token.$value)}, ${shortHex(darkValues.get(token.name))})`
      : shortHex(String(token.$value));
    // stylelint wants a blank line before a comment, except the first in a block.
    const comment = token.$description
      ? `${index ? "\n" : ""}  /* ${token.$description} */\n`
      : "";
    return `${comment}  --${token.name}: ${value};`;
  });
  const css = `${HEADER}:root {\n${lines.join("\n")}\n}\n`;

  const config = await prettier.resolveConfig(DESTINATION);
  return prettier.format(css, { ...config, filepath: DESTINATION });
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await writeFile(DESTINATION, await buildCss());
}
