import { expect, test } from "@chromatic-com/playwright";

/**
 * Five deliberate view states, one per test, for visual regression.
 *
 * The fixture captures one snapshot at the end of each test, so each test
 * settles its view and ends without a capture call.
 */

// The engine fetches the real multi-megabyte dataset over the preview server,
// so the wait matches the one the other end-to-end specs declare.
const DATASET_READY_TIMEOUT_MS = 20_000;

// The two storage keys the blocking script in index.html reads, restated
// rather than imported so this file cannot pass for whatever value the
// subject happens to hold.
const THEME_STORAGE_KEY = "yart-theme";
const LOCALE_STORAGE_KEY = "yart-locale";

// The one catalog that ships reading right to left.
const RTL_CATALOG_ID = "ar-XB";

// The empty-results sentence from the English catalog.
const EMPTY_MESSAGE = "No cities found";

test("default view", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
});

test("searched, sorted and paged view", async ({ page }) => {
  await page.goto("/?q=san&sort=-population&page=2&size=25");
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  // The row count settles after the table appears, so the snapshot is of the
  // finished page rather than a mid-render one.
  await expect(page.locator("tbody tr")).toHaveCount(25);
});

test("dark theme", async ({ page }) => {
  // Seeded before the first navigation so the blocking script in index.html
  // stamps the theme on the first frame and there is no light flash to capture.
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: THEME_STORAGE_KEY, value: "dark" },
  );
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  // A snapshot that silently captured the light theme fails here rather than
  // passing as a new baseline.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("right-to-left locale", async ({ page }) => {
  // Seeded before the first navigation, for the same reason as the theme above.
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: LOCALE_STORAGE_KEY, value: RTL_CATALOG_ID },
  );
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("empty results", async ({ page }) => {
  await page.goto("/?q=zzzzzz");
  // The empty branch replaces the table outright, so waiting on a table role
  // here would time out. Matched exactly, because the live region beside it
  // opens with the same words.
  await expect(page.getByText(EMPTY_MESSAGE, { exact: true })).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
});
