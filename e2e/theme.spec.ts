import { expect, test } from "@playwright/test";

/**
 * The theme stamped onto the document element before any module can run.
 *
 * The trap: the obvious version of this test, choose a theme, reload, assert
 * the document element carries it, passes with the blocking script deleted,
 * because the theme hook's effect writes the same two properties after
 * hydration. It would prove the theme is right once the application has loaded,
 * which is not the claim. The claim is that no wrong-theme frame is ever shown.
 *
 * The construction below can fail if that script is removed. The module bundle
 * is aborted before the reload, so the hook never mounts and the only code that
 * can have written either property is the blocking classic script in the
 * document head.
 *
 * Worth one sentence and no more: the resolve rule is written twice, once in
 * that script and once in a module, with nothing asserting the two agree. This
 * spec is the first thing that would notice a drift. That is a consequence, not
 * the claim, and it is deliberately not a second assertion here.
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

// Matched on the built assets directory and the extension rather than on a
// name, because the module bundle's filename carries a content hash and changes
// on every build.
const BUILT_SCRIPTS = "**/assets/*.js";

test("the stored theme is stamped on the document element with the module bundle aborted", async ({
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

  // Cheap, and it splits a later failure into two distinguishable causes: the
  // choice was never stored, or the choice was stored and not stamped.
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY),
    )
    .toBe("dark");

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

  // Both halves, each against the exact expected value. Delete the blocking
  // script from the document and both read empty, which is the falsifiability
  // the claim demands, and it is deterministic: no throttling, no screenshot,
  // no race.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const inlineColorScheme = await page.evaluate(
    () => document.documentElement.style.colorScheme,
  );
  expect(inlineColorScheme).toBe("dark");

  // The stylesheet is deliberately not blocked. It sets a color scheme under
  // the dark selector, but a stylesheet cannot write an inline style property,
  // so the assertion above still isolates the script, and leaving the
  // stylesheet loaded keeps the page in a state a human debugging a red run can
  // look at.
});
