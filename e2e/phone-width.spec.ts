import { expect, test } from "@playwright/test";

// The page must not scroll sideways at common phone widths, in any catalog.

// The engine fetches the real multi-megabyte dataset over the preview server,
// so the wait matches the one the other end-to-end specs declare.
const DATASET_READY_TIMEOUT_MS = 20_000;

// Restated from the subject so this file cannot pass for whatever it holds.
const LOCALE_STORAGE_KEY = "yart-locale";
const CATALOG_IDS = ["en", "es", "fr", "ar-XB"];

const PAGES = ["/", "/movies.html"];
const PHONE_WIDTHS = [412, 360];
const PHONE_HEIGHT = 823;

test.use({ viewport: { width: 412, height: PHONE_HEIGHT } });

for (const path of PAGES) {
  for (const id of CATALOG_IDS) {
    test(`${path} in ${id} fits a phone-width screen`, async ({ page }) => {
      await page.addInitScript(
        ({ key, value }: { key: string; value: string }) => {
          window.localStorage.setItem(key, value);
        },
        { key: LOCALE_STORAGE_KEY, value: id },
      );
      await page.goto(path);
      await expect(page.getByRole("table")).toBeVisible({
        timeout: DATASET_READY_TIMEOUT_MS,
      });
      // Located structurally: the picker's name is translated, and the page
      // size select is a combobox too.
      await expect(page.locator("header select")).toHaveValue(id);

      for (const width of PHONE_WIDTHS) {
        await page.setViewportSize({ width, height: PHONE_HEIGHT });
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        // Against clientWidth, so a non-overlay scrollbar cannot fail it.
        expect(scrollWidth, `scroll width at ${width} px`).toBe(clientWidth);
      }
    });
  }
}
