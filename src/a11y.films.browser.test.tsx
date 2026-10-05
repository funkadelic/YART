import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import { DatasetPage } from "./features/DatasetPage";
import { FILM_PAGE } from "./features/films/filmPage";
import { describeViolations, incompleteRuleIds } from "./test/axeSweep";

// The shipped stylesheets, which only an entry module pulls in. Every design
// token lives in them, so a sweep that skipped it would run the contrast rule over
// the engine's default black on white and report on a page no reader ever sees.
import "yet-another-react-table/styles.css";
import "./index.css";

// The rules the engine could not decide, asserted by set equality. Empty,
// because a real engine has a layout engine and a canvas, so the contrast rule
// and the two page-level rules run. An undecided rule fails the run.
const EXPECTED_INCOMPLETE: readonly string[] = Object.freeze([]);

/**
 * Every state this page is swept in, in the order the sweeps run. Written out
 * by hand, so it can disagree with what actually ran; a derived list could
 * not.
 */
const SWEPT_STATES = Object.freeze([
  "error",
  "light",
  "dark",
  "paged",
  "empty",
  "rtl",
]);

/**
 * The one catalog that ships reading right to left. The films page carries
 * three multi-valued text columns the city page does not, so it is the page
 * where a direction defect is most likely to show.
 */
const RTL_CATALOG_ID = "ar-XB";

/** What actually ran, recorded as it runs, so a dropped state goes red. */
const sweptStates: string[] = [];

/** Above the 20 s table wait, so that wait fails with its own message. */
const WALK_TIMEOUT = 60_000;

/**
 * Runs the rule engine over whatever is currently on screen and holds both
 * assertions, so a state added to the walk cannot arrive with only half of
 * them. The state name rides along as the assertion message.
 *
 * The context is the document, not the body, and the viewport is the
 * desktop one the browser project declares. Both matter to the contrast rule:
 * a body context leaves the html-matching rules unreported, and a narrower
 * window clips the last column, which leaves a partially obscured element with
 * no determinable background and files the rule undecided instead of decided.
 */
async function sweep(state: string): Promise<void> {
  const results = await axe.run(document, {
    resultTypes: ["violations", "incomplete"],
  });

  // Both assertions below compare against an empty set, so a sweep that reached
  // a verdict on nothing reads exactly like a sweep of a clean page. The count
  // of rules that passed is what tells the two apart.
  expect(results.passes.length, state).toBeGreaterThan(0);

  expect(describeViolations(results), state).toEqual([]);
  expect(incompleteRuleIds(results), state).toEqual(EXPECTED_INCOMPLETE);

  sweptStates.push(state);
}

describe("films accessibility in a real engine", () => {
  // Six states off one mount. Every transition goes through the control a
  // reader would press, so a control that has stopped working fails the sweep
  // instead of the sweep quietly visiting a state no reader can reach.
  it(
    "reports no violation after a failed load, in either theme, on a page past the first, emptied, or reading right to left",
    { timeout: WALK_TIMEOUT },
    async () => {
      const user = userEvent.setup();

      // The first request fails so the error view can be swept. The
      // once-implementation is spent by that call, so the retry below reaches the
      // real asset.
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("not found", { status: 404 }),
      );

      render(<DatasetPage config={FILM_PAGE} />);

      // The first state is chosen, never inherited. Left on the default, the
      // theme resolves against the engine's own preference, which would sweep the
      // dark palette twice on a machine that prefers dark and never sweep light.
      await user.click(screen.getByRole("radio", { name: "Light" }));
      await screen.findByRole("radio", { name: "Light", checked: true });

      await screen.findByText(
        "Error: The film data could not be downloaded (status 404).",
      );
      await sweep("error");

      await user.click(screen.getByRole("button", { name: "Try again" }));

      // The retry fetches the real dataset asset across the dev server, parses
      // and indexes it.
      await screen.findByRole("table", {}, { timeout: 20_000 });
      await sweep("light");

      await user.click(screen.getByRole("radio", { name: "Dark" }));
      await screen.findByRole("radio", { name: "Dark", checked: true });
      await sweep("dark");

      await user.click(screen.getByRole("button", { name: "Go to next page" }));
      await screen.findByText(/^Page 2 of /);
      await sweep("paged");

      const searchBox = screen.getByRole("textbox", { name: "Search" });

      await user.type(searchBox, "no film is called this");
      await screen.findByText("No films found");
      await sweep("empty");

      // Cleared so the rtl sweep sees a populated table, as the other states do.
      await user.clear(searchBox);
      await screen.findByRole("table");

      // The picker is operated instead of the attribute being set, so the state
      // swept is one a reader can actually reach. Found by role alone, because
      // its own accessible name follows the language it is about to change.
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Language" }),
        RTL_CATALOG_ID,
      );
      await waitFor(() => {
        expect(document.documentElement.dir).toBe("rtl");
      });
      await sweep("rtl");

      expect(sweptStates).toEqual(SWEPT_STATES);
    },
  );
});
