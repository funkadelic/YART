import { expect, test } from "@playwright/test";

/**
 * The application under a forced colors palette, which the accessibility engine
 * cannot reach: it reads the colors an author declared, and this is the mode
 * where the user agent throws those away. Delete the remap in src/index.css and
 * the theme segment assertion goes red, both segments falling back to Canvas.
 *
 * The HighlightText rule in ThemeControl.module.scss is not covered here, and
 * cannot be: this engine's emulated palette resolves HighlightText and Canvas
 * to the same white, so the selected label reads the same with the rule and
 * without it. The rule is for a real palette where those two differ.
 */

// The engine fetches the real multi-megabyte dataset over the preview server,
// so the wait matches the one the other end-to-end specs declare.
const DATASET_READY_TIMEOUT_MS = 20_000;

// What getComputedStyle reports for a color that paints nothing.
const TRANSPARENT = "rgba(0, 0, 0, 0)";

test.use({ forcedColors: "active" });

test("borders, the accent and the chosen theme segment survive forced colors", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("table")).toBeVisible({
    timeout: DATASET_READY_TIMEOUT_MS,
  });

  // Driven in the dark theme, the side a remap written against the light block
  // alone would miss.
  const themeControl = page.getByRole("radiogroup", { name: "Theme" });
  await themeControl.getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const rule = await page
    .locator("tbody td")
    .first()
    .evaluate((cell) => getComputedStyle(cell).borderBottomColor);
  const text = await page
    .locator("body")
    .evaluate((body) => getComputedStyle(body).color);

  // A separator painted with a background color instead of a border vanishes
  // here, and comes back as a color that paints nothing.
  expect(rule).not.toBe(TRANSPARENT);
  expect(rule).toBe(text);

  const search = page.getByRole("textbox", { name: "Search" });
  await search.focus();

  // Highlight, against the CanvasText the rules are drawn in. Equal would mean
  // the accent never reached the palette, leaving a focused box like any other.
  const focused = await search.evaluate(
    (box) => getComputedStyle(box).borderTopColor,
  );
  expect(focused).not.toBe(rule);

  const segment = (name: string) =>
    themeControl
      .getByText(name, { exact: true })
      .evaluate((label) => getComputedStyle(label).backgroundColor);

  expect(await segment("Dark")).not.toBe(await segment("Light"));
});
