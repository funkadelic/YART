import { expect, test } from "@playwright/test";

/**
 * The theme and the locale stamped onto the document element before any module
 * can run.
 *
 * The obvious version of this test, choose a theme and a language, reload,
 * assert the document element carries them, passes with the blocking script
 * deleted, because the theme hook and the locale hook both write the same
 * properties after hydration. It would prove the theme and the direction are
 * right once the application has loaded. The claim here is that no wrong-theme,
 * no wrong-language and no wrong-direction frame is ever shown, and direction
 * is where a wrong first frame is most visible, since the whole page swaps
 * sides.
 *
 * The construction below can fail if that script is removed. The module bundle
 * is aborted before the reload, so neither hook ever mounts and the only code
 * that can have written any of the four properties is the blocking classic
 * script in the document head.
 *
 * Both stamps are proved in this one spec, because they are one mechanism: the
 * same script, aborted the same way, in one reload.
 *
 * The resolve rules are written twice, once in that script and once in a module
 * each, and the parity guard in the jsdom suite holds the copies together. This
 * spec would be the first thing to notice a drift the guard let through, which
 * is a consequence of the construction and deliberately not a second assertion
 * here.
 */

// The engine fetches the real multi-megabyte dataset asset over the preview
// server, parses and indexes it, and only then waits out the seam's deliberate
// latency. Set high on purpose to cover that work, not as a flake allowance.
const DATASET_READY_TIMEOUT_MS = 20_000;

// The storage key the blocking script spells out by hand and the theme module
// declares as a constant. Restated here, per the convention that a constant the
// subject also defines is restated in the test, so this file cannot pass for
// whatever value the subject happens to hold.
const THEME_STORAGE_KEY = "yart-theme";

// The locale's own storage key, restated for the same reason.
const LOCALE_STORAGE_KEY = "yart-locale";

// The one catalog that ships reading right to left. Its strings are English, so
// its language tag is English and only its direction is borrowed, which is why
// the tag asserted below is not the catalog id.
const RTL_CATALOG_ID = "ar-XB";
const RTL_CATALOG_TAG = "en-US";

// Matched on the built assets directory and the extension, because the module
// bundle's filename carries a content hash and changes on every build.
const BUILT_SCRIPTS = "**/assets/*.js";

test("the stored theme and locale are stamped on the document element with the module bundle aborted", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // Clicked on the bound label. Measured, the input is clipped to a one pixel
  // box by the visually hidden rule, so a direct check times out and a forced
  // check fails with a state-unchanged error. Do not simplify this back to a
  // check call.
  await page
    .getByRole("radiogroup", { name: "Theme" })
    .getByText("Dark", { exact: true })
    .click();

  // The picker is a native select, so the option is chosen by value the way a
  // reader would choose it. Found by role alone, because its accessible name is
  // about to stop being English.
  await page
    .getByRole("combobox", { name: "Language" })
    .selectOption(RTL_CATALOG_ID);

  // Cheap, and it splits a later failure into two distinguishable causes: the
  // choice was never stored, or the choice was stored and not stamped. Both
  // choices are polled, because a reload that stamps one and not the other is
  // the half-failure this spec is here to catch.
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

  // The aborted scripts are counted. Asserting the table is absent after the
  // reload holds either way, because the table does not render until the
  // dataset fetch and the seam's latency resolve. Measured, that version stays
  // green with the abort pattern matching nothing, leaving the two assertions
  // below satisfied by the theme hook's post-hydration effect, a vacuous pass.
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
  // all, so the claim is falsifiable and deterministic: no throttling, no
  // screenshot, no race.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const inlineColorScheme = await page.evaluate(
    () => document.documentElement.style.colorScheme,
  );
  expect(inlineColorScheme).toBe("dark");

  // Asserted on the tag, because the pseudo-locale's strings are English and a
  // well formed Arabic tag reaching a platform formatter is what the
  // three-field resolve rule prevents. The shell ships
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
