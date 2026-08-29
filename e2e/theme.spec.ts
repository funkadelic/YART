import { expect, test } from "@playwright/test";

/**
 * The theme and the locale stamped onto the document element before any module
 * can run.
 *
 * The trap: the obvious version of this test, choose a theme and a language,
 * reload, assert the document element carries them, passes with the blocking
 * script deleted, because the theme hook and the locale hook both write the same
 * properties after hydration. It would prove the theme and the direction are
 * right once the application has loaded, which is not the claim. The claim is
 * that no wrong-theme, no wrong-language and no wrong-direction frame is ever
 * shown, and the direction is the one where a wrong first frame is most visible:
 * the whole page swaps sides.
 *
 * The construction below can fail if that script is removed. The module bundle
 * is aborted before the reload, so neither hook ever mounts and the only code
 * that can have written any of the four properties is the blocking classic
 * script in the document head.
 *
 * Both stamps are proved here rather than in two specs, because they are one
 * mechanism: the same script, aborted the same way, in one reload.
 *
 * Worth one sentence and no more: the resolve rules are written twice, once in
 * that script and once in a module each, and the parity guard in the jsdom suite
 * is what holds the copies together. This spec is the first thing that would
 * notice a drift the guard somehow let through. That is a consequence, not the
 * claim, and it is deliberately not a second assertion here.
 */

// The engine fetches the real multi-megabyte dataset asset over the preview
// server, parses and indexes it, and only then waits out the seam's deliberate
// latency. Raised deliberately rather than as a flake allowance.
const DATASET_READY_TIMEOUT_MS = 20_000;

// The storage key the blocking script spells out by hand and the theme module
// declares as a constant. Restated here rather than imported, per the
// convention that a constant the subject also defines is restated in the test,
// so this file cannot pass for whatever value the subject happens to hold.
const THEME_STORAGE_KEY = "yart-theme";

// The locale's own storage key, restated for the same reason.
const LOCALE_STORAGE_KEY = "yart-locale";

// The one catalog that ships reading right to left. Its strings are English, so
// its language tag is English and only its direction is borrowed, which is why
// the tag asserted below is not the catalog id.
const RTL_CATALOG_ID = "ar-XB";
const RTL_CATALOG_TAG = "en-US";

// Matched on the built assets directory and the extension rather than on a
// name, because the module bundle's filename carries a content hash and changes
// on every build.
const BUILT_SCRIPTS = "**/assets/*.js";

test("the stored theme and locale are stamped on the document element with the module bundle aborted", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // Clicked on the bound label rather than checking the radio: measured, the
  // input is clipped to a one pixel box by the visually hidden rule, so a
  // direct check times out and a forced check fails with a state-unchanged
  // error. Do not simplify this back to a check call.
  await page
    .getByRole("radiogroup", { name: "Theme" })
    .getByText("Dark", { exact: true })
    .click();

  // The picker is a native select, so the option is chosen by value the way a
  // reader would choose it. Found by role alone: its accessible name is about to
  // stop being English.
  await page
    .getByRole("combobox", { name: "Language" })
    .selectOption(RTL_CATALOG_ID);

  // Cheap, and it splits a later failure into two distinguishable causes: the
  // choice was never stored, or the choice was stored and not stamped. Both
  // choices, because a reload that stamps one and not the other is exactly the
  // half-failure this spec exists to catch.
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY),
    )
    .toBe("dark");
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), LOCALE_STORAGE_KEY),
    )
    .toBe(RTL_CATALOG_ID);

  // Counted rather than inferred. Asserting the table is absent after the
  // reload proves nothing: the table is absent at that instant either way,
  // because it does not render until the dataset fetch and the seam's latency
  // resolve. Measured, that version stays green with the abort pattern matching
  // nothing, which would leave the two assertions below satisfied by the theme
  // hook's post-hydration effect, the exact vacuous pass this file exists to
  // avoid.
  let abortedScripts = 0;
  await page.route(BUILT_SCRIPTS, (route) => {
    abortedScripts += 1;
    return route.abort();
  });
  await page.reload();

  expect(abortedScripts).toBeGreaterThan(0);

  // All four, each against the exact expected value. Delete the blocking script
  // from the document and the two theme properties read empty while the two
  // locale attributes fall back to the shell's own lang and to no direction at
  // all, which is the falsifiability the claim demands, and it is deterministic:
  // no throttling, no screenshot, no race.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const inlineColorScheme = await page.evaluate(
    () => document.documentElement.style.colorScheme,
  );
  expect(inlineColorScheme).toBe("dark");

  // The tag rather than the catalog id, because the pseudo-locale's strings are
  // English and a well formed Arabic tag reaching a platform formatter is the
  // thing the three-field resolve rule exists to prevent. The shell ships
  // lang="en" and no dir at all, so neither assertion can be satisfied by the
  // static document.
  await expect(page.locator("html")).toHaveAttribute("lang", RTL_CATALOG_TAG);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  // The stylesheet is deliberately not blocked. It sets a color scheme under
  // the dark selector, but a stylesheet cannot write an inline style property,
  // so the assertion above still isolates the script, and leaving the
  // stylesheet loaded keeps the page in a state a human debugging a red run can
  // look at.
});
