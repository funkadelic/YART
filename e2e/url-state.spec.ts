import { expect, test } from "@playwright/test";

/**
 * The view restored from the address, across a real page load.
 *
 * What this proves that the jsdom suite cannot: the address is read by a
 * document the browser actually navigated to, serving the built bundle over a
 * real server, rather than by a component the suite remounted with a stubbed
 * location. A remount keeps the module graph, the parsed dataset and the
 * runner's own history shim alive across the boundary it calls a reload, so it
 * can restore state that no returning reader would ever get. Here the engine
 * throws all of that away and starts from the query string and the emitted
 * assets, which is what a reader following a pasted link does.
 */

// The engine fetches the real multi-megabyte dataset asset over the preview
// server, parses and indexes it, and only then waits out the seam's deliberate
// latency. The jsdom suite pays none of that, because it runs against a
// fixture. Raised deliberately rather than as a flake allowance.
const DATASET_READY_TIMEOUT_MS = 20_000;

// Every value differs from its default, so the serializer keeps all four and
// the write guard finds the incoming query already canonical. The term is
// chosen for its size rather than its familiarity: "tokyo" matches two rows and
// renders no pagination at all, while this one matches enough to page through.
const RESTORED_ADDRESS = "/?q=san&sort=-population&page=2&size=25";

// The number of rows the term matches in the committed dataset,
// src/data/worldcities/cities.json. A change to that file moves it.
const MATCHING_ROWS = 1701;

const RESTORED_CAPTION = `City data with ${MATCHING_ROWS} entries, currently sorted by Population descending`;

test("a reload restores the whole view from the address", async ({ page }) => {
  await page.goto(RESTORED_ADDRESS);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // One assertion, and it catches a serializer that reorders the keys or drops
  // one: the settled address has to be the address that was navigated to.
  await expect(page).toHaveURL(RESTORED_ADDRESS);

  await page.reload();
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // Asserted one at a time rather than as a single settled view, so a
  // regression in any one of the four names itself in the failure.
  await expect(page.getByRole("textbox", { name: "Search" })).toHaveValue(
    "san",
  );
  await expect(page.getByLabel("Per page:")).toHaveValue("25");
  await expect(
    page.getByRole("columnheader", { name: "Population" }),
  ).toHaveAttribute("aria-sort", "descending");
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(page.getByRole("table")).toHaveAccessibleName(RESTORED_CAPTION);

  await expect(page).toHaveURL(RESTORED_ADDRESS);
});
