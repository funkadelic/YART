import { basename } from "node:path";

// Shared by the app, library and mutation configs, and importing nothing heavier
// than node:path so the library build never loads the app or test toolchain.

/**
 * The one place the browser floors live, read by the app and library builds.
 * The first floor with native light-dark(), so it ships unlowered and follows
 * the color-scheme of whatever page hosts the table.
 */
export const BUILD_TARGET = [
  "chrome123",
  "edge123",
  "firefox120",
  "safari17.5",
];

/**
 * Sends the package specifier to src/, so dev, test and build need no lib/.
 * Not `development`, which a consumer's dev server sets, sending it to a src/ it lacks.
 */
export const SOURCE_CONDITION = "@yart/source";

/**
 * Names a CSS Module class `yart-<Component>__<class>`, in the demo and the
 * shipped sheet alike, so a selector copied from the demo matches the package.
 */
// ponytail: keyed on the stylesheet basename, unique per component today; a
// duplicate basename would merge two components' classes.
export function scopedClassName(local: string, file: string): string {
  return `yart-${basename(file).split(".")[0]}__${local}`;
}
