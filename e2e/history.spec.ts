import { expect, test } from "@playwright/test";

/**
 * The history ledger a single in-place address writer produces.
 *
 * The application replaces the address and never pushes, so paging adds no
 * history entry. A test expecting Back to return to a previous table state
 * asserts the opposite of the design, and would only go green once the
 * application grew the second kind of history write the design exists to
 * refuse.
 *
 * A sentinel entry makes the claim falsifiable. The suite navigates to a second
 * document first, so Back has somewhere to land that is not the table. Without
 * it the application's entry is the only one, Back returns null and leaves the
 * address untouched, and that outcome is byte-identical to a Back that returned
 * to the same table state.
 *
 * The criterion is worded as leaving the origin, and this sentinel is
 * same-origin. A preview server started and torn down per run serves exactly
 * one origin, and no cross-origin document is reachable without putting the
 * suite on the network, so the sentinel is a document the application did not
 * create. Paging added no history entry either way, and that is the substance
 * asserted.
 */

// The engine fetches the real multi-megabyte dataset asset over the preview
// server, parses and indexes it, and only then waits out the seam's deliberate
// latency. Set high on purpose to cover that work, not as a flake allowance.
const DATASET_READY_TIMEOUT_MS = 20_000;

// The second addressable document the build already emits, copied verbatim out
// of public/. The sentinel needs only to be somewhere Back can land that the
// application did not put there, and this file is already there.
const SENTINEL_PATH = "/robots.txt";

// Measured to match 1701 rows, which at the default page size of ten is 171
// pages, so the pagination navigation is actually rendered. The navigation
// element renders only when there is more than one page, so a term matching a
// handful of rows renders no navigation at all and the click below would time
// out.
const PAGING_ADDRESS = "/?q=san";

test("back leaves the application and forward restores the replaced address", async ({
  page,
}) => {
  // The sentinel goes down first, so the application's entry is not the only
  // one in the ledger.
  await page.goto(SENTINEL_PATH);

  await page.goto(PAGING_ADDRESS);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  await page.getByRole("button", { name: "Go to next page" }).click();

  // Waited on the address, because the write is an effect and the click returns
  // before it commits.
  await expect(page).toHaveURL("/?q=san&page=2");

  const pagedAddress = page.url();
  expect(pagedAddress).toContain("page=2");

  // The sentinel is what makes this falsifiable. If the application ever pushed
  // an entry, Back lands on an intermediate table address and this goes red.
  // Asserting on a null return from goBack would pass for the wrong reason and
  // would keep passing after such a push was added.
  await page.goBack();
  await expect(page).toHaveURL(SENTINEL_PATH);

  // Forward navigation restores the entry's current address, and that is the
  // address the in-place write left behind. Landing on the paged address here,
  // not on the one originally navigated to, shows the write mutated the entry
  // instead of adding to it. Compared against the captured value so the
  // assertion cannot drift out of step with what the serializer produced.
  await page.goForward();
  await expect(page).toHaveURL(pagedAddress);

  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // The view, not just the address, so a forward traversal that restored the
  // address while rendering the wrong slice still fails.
  await expect(page.getByRole("textbox", { name: "Search" })).toHaveValue(
    "san",
  );
  await expect(page.getByLabel("Table pagination navigation")).toContainText(
    "Page 2 of 171",
  );

  // The traversal listener is deliberately left unasserted. Whether the engine
  // restores the document from its back-forward cache or performs a fresh load
  // is an engine decision the application does not control, and every assertion
  // above holds under both, because the mount-time initializer reads the
  // address too. A check on the listener would only add flakiness.
});
