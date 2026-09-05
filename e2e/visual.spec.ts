import { expect, test } from "@chromatic-com/playwright";

/**
 * Eight deliberate view states, one per test, for visual regression. Six on the
 * city page and two on the films one.
 *
 * The fixture captures one snapshot at the end of each test, so each test
 * settles its view and ends without a capture call.
 */

// The engine fetches the real multi-megabyte dataset over the preview server,
// so the wait matches the one the other end-to-end specs declare.
const DATASET_READY_TIMEOUT_MS = 20_000;

// The two storage keys the blocking script in index.html reads, restated here
// so this file cannot pass for whatever value the subject happens to hold.
const THEME_STORAGE_KEY = "yart-theme";
const LOCALE_STORAGE_KEY = "yart-locale";

// The one catalog that ships reading right to left.
const RTL_CATALOG_ID = "ar-XB";

// The empty-results sentence from the English catalog.
const EMPTY_MESSAGE = "No cities found";

// The second page, by its explicit shell file name. Whether the static host
// serves the extensionless form is untested; this works on both.
const FILMS_PATH = "/movies.html";

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
  // The row count settles after the table appears, so waiting on it holds the
  // snapshot to the finished page and not a mid-render frame.
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
  // This fails a snapshot that silently captured the light theme, which would
  // otherwise be accepted as a new baseline.
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

test("hovered row", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  const row = page.locator("tbody tr").first();
  const background = () =>
    row.evaluate((el) => getComputedStyle(el).backgroundColor);
  const resting = await background();

  await row.hover();
  const hovered = await background();
  expect(hovered).not.toBe(resting);

  // The archive Chromatic replays carries the DOM but not the pointer, so a
  // :hover rule never paints in it. Writing the color the rule just produced
  // onto the row puts it somewhere the archive reaches. The color is read from
  // the rendered page, so a token change moves the snapshot and a deleted rule
  // fails the assertion above before this line runs. Set through the CSSOM
  // because the shell's style-src forbids a style attribute.
  await row.evaluate((el, color) => {
    el.style.backgroundColor = color;
  }, hovered);
  await page.mouse.move(0, 0);
  await expect.poll(background).toBe(hovered);
});

// ponytail: two films states and no more. Each one is billed on every future
// build, so treat this as a ceiling and add a third knowingly. The
// right-to-left variant is the one worth having, because the films page carries
// three multi-valued text columns the city page does not.
test("films default view", async ({ page }) => {
  await page.goto(FILMS_PATH);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
});

test("films right-to-left locale", async ({ page }) => {
  // Seeded before the first navigation, for the same reason as the city states
  // above: the blocking script stamps the direction on the first frame.
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: LOCALE_STORAGE_KEY, value: RTL_CATALOG_ID },
  );
  await page.goto(FILMS_PATH);
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
