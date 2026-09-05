import { expect, test } from "@playwright/test";

/**
 * The second page's address, in a real browser.
 *
 * Two documents own two independent addresses, and only a real browser can show
 * that. jsdom has one document, so the claim that a view restored on the films
 * page leaves the city page's address alone cannot be made there at all, and the
 * claim that a reload reproduces a view is made against a remount that keeps the
 * module graph and the parsed dataset alive across the boundary it calls a
 * reload.
 *
 * The theme and dataset transport specs are deliberately not mirrored here.
 * Both make claims about mechanisms the two pages share and both are already
 * proved once, and every spec on this runner pulls a dataset over the preview
 * server on a single worker.
 */

// The engine fetches the real dataset asset over the preview server, parses and
// indexes it, and only then waits out the seam's deliberate latency. The
// timeout is sized for that work, not as a flake allowance.
const DATASET_READY_TIMEOUT_MS = 20_000;

// The explicit shell file name, never the extensionless form. The preview
// server serves both, and whether the static host serves the extensionless one
// is untested; the explicit name works on both.
const FILMS_PATH = "/movies.html";

// Every value differs from its default, so the serializer keeps all four and the
// write guard finds the incoming query already canonical.
const RESTORED_ADDRESS = `${FILMS_PATH}?q=man&sort=-year&page=2&size=25`;

// The number of rows the term matches in the committed dataset,
// src/data/films/films.json. A change to that file moves it.
const MATCHING_ROWS = 377;

// The tag the application resolves for the locale this run is pinned to in
// playwright.config.ts. The caption groups its count on that tag, so the
// expectation is computed through the platform. A hand-typed separator would
// agree with itself, and a failure here could not show it wrong.
const RESOLVED_TAG = "en-US";
const GROUPED_MATCHES = new Intl.NumberFormat(RESOLVED_TAG).format(
  MATCHING_ROWS,
);

const RESTORED_CAPTION = `Film data with ${GROUPED_MATCHES} entries, currently sorted by Year descending`;

// The second addressable document the build already emits, copied verbatim out
// of public/. The sentinel needs only to be somewhere Back can land that the
// application did not put there, and this file is already there.
const SENTINEL_PATH = "/robots.txt";

// The empty-results sentence and the sentence the live region announces beside
// it. The first is matched exactly, because the second opens with the same
// words.
const EMPTY_MESSAGE = "No films found";
const EMPTY_ANNOUNCEMENT = "No films found for that search";
const LOADING_MESSAGE = "Downloading the film data...";

test("a reload restores the whole films view from the address", async ({
  page,
}) => {
  await page.goto(RESTORED_ADDRESS);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // The settled address has to be the address that was navigated to, so one
  // assertion catches a serializer that reorders the keys or drops one.
  await expect(page).toHaveURL(RESTORED_ADDRESS);

  await page.reload();
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // Asserted one at a time, so a regression in any one of the four names itself
  // in the failure.
  await expect(page.getByRole("textbox", { name: "Search" })).toHaveValue(
    "man",
  );
  await expect(page.getByLabel("Per page:")).toHaveValue("25");
  await expect(
    page.getByRole("columnheader", { name: "Year" }),
  ).toHaveAttribute("aria-sort", "descending");
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(page.getByRole("table")).toHaveAccessibleName(RESTORED_CAPTION);

  await expect(page).toHaveURL(RESTORED_ADDRESS);
});

test("each of the four view changes reaches the films address", async ({
  page,
}) => {
  await page.goto(FILMS_PATH);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // The default view writes nothing, so the changes below are measured from the
  // shell's own address.
  await expect(page).toHaveURL(FILMS_PATH);

  // Waited on the address, because the write is an effect and each interaction
  // returns before it commits. The search commit waits out the debounce on top
  // of that.
  await page.getByRole("textbox", { name: "Search" }).fill("man");
  await expect(page).toHaveURL(`${FILMS_PATH}?q=man`);

  await page.getByRole("button", { name: "Title" }).click();
  await expect(page).toHaveURL(`${FILMS_PATH}?q=man&sort=title`);

  await page.getByLabel("Per page:").selectOption("25");
  await expect(page).toHaveURL(`${FILMS_PATH}?q=man&sort=title&size=25`);

  // Paged last, because a sort and a size change each return the reader to the
  // first page and would take the key back out of the address.
  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page).toHaveURL(`${FILMS_PATH}?q=man&sort=title&page=2&size=25`);
});

test("a redundant parameter is dropped and an unowned one survives", async ({
  page,
}) => {
  await page.goto(`${FILMS_PATH}?q=man&page=1&size=10&ref=newsletter`);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // The serializer omits a value equal to its default and preserves every key it
  // does not own, so a redundant or hostile link is canonicalized on arrival
  // before it reaches the table. One view has exactly one address, asserted here
  // from the arrival side.
  await expect(page).toHaveURL(`${FILMS_PATH}?q=man&ref=newsletter`);
});

test("paging the films page adds no history entry", async ({ page }) => {
  // The sentinel goes down first, so the application's entry is not the only one
  // in the ledger and Back has somewhere to land that is not the table. Without
  // it Back returns null and leaves the address untouched, which is
  // byte-identical to a Back that returned to the same view.
  await page.goto(SENTINEL_PATH);

  await page.goto(`${FILMS_PATH}?q=man`);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page).toHaveURL(`${FILMS_PATH}?q=man&page=2`);

  const pagedAddress = page.url();

  // The sentinel makes this falsifiable. If this page ever pushed an entry, Back
  // would land on an intermediate films address and this goes red.
  await page.goBack();
  await expect(page).toHaveURL(SENTINEL_PATH);

  // Forward restores the entry's current address, and that address is the one
  // the in-place write left behind, so the write mutated the entry instead of
  // adding to it.
  await page.goForward();
  await expect(page).toHaveURL(pagedAddress);
});

test("the two pages own independent addresses", async ({ page }) => {
  const citiesAddress = "/?q=san&size=25";

  await page.goto(citiesAddress);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  await expect(page).toHaveURL(citiesAddress);

  // A different query on the second page. It carries a sort key the first page
  // has no column for, so a shared reader would drop it.
  await page.goto(RESTORED_ADDRESS);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  await expect(page).toHaveURL(RESTORED_ADDRESS);
  await expect(page.getByRole("table")).toHaveAccessibleName(RESTORED_CAPTION);

  // Back to the first page, a different document. Its own view is still intact,
  // and one document could not demonstrate that half.
  await page.goBack();
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  await expect(page).toHaveURL(citiesAddress);
  await expect(page.getByRole("textbox", { name: "Search" })).toHaveValue(
    "san",
  );
  await expect(page.getByLabel("Per page:")).toHaveValue("25");
});

test("a films search matching nothing empties the results and no more", async ({
  page,
}) => {
  await page.goto(FILMS_PATH);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  await page.getByRole("textbox", { name: "Search" }).fill("zzzzzz");

  // The empty branch replaces the table itself, which is the shared table's
  // documented branch order. The whole view must not fall back to the download
  // sentence. That branch is gated on the dataset having arrived once, so a
  // refetch marks the view busy and leaves the table standing.
  await expect(page.getByText(EMPTY_MESSAGE, { exact: true })).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  await expect(page.getByText(EMPTY_ANNOUNCEMENT)).toBeAttached();
  await expect(page.getByText(LOADING_MESSAGE)).toHaveCount(0);

  // The search box still holds the term, and the page chrome is still around it.
  await expect(page.getByRole("textbox", { name: "Search" })).toHaveValue(
    "zzzzzz",
  );
  await expect(page.getByRole("heading", { name: "Film List" })).toBeVisible();
});
