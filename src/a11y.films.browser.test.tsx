import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import FilmsApp from "./FilmsApp";
import { describeViolations, incompleteRuleIds } from "./test/axeSweep";

// The shipped stylesheet, which only an entry module pulls in. Every design
// token lives here, so a sweep that skipped it would run the contrast rule over
// the engine's default black on white and report on a page no reader ever sees.
import "./index.css";

// The rules the engine could not decide, asserted by set equality as the jsdom
// sweep asserts its own. Empty here, and that is why this file sits beside that
// one: a real engine has a layout engine and a canvas, so the contrast rule and
// the two page-level rules actually run. A rule turning up undecided in a real
// engine is news, and news belongs in a red run.
const EXPECTED_INCOMPLETE: readonly string[] = Object.freeze([]);

/**
 * Every state this page is swept in, in the order the sweeps run. Written out
 * by hand, so it can disagree with what actually ran; a derived list could
 * not.
 */
const SWEPT_STATES = Object.freeze(["light", "dark", "paged", "rtl"]);

/**
 * The one catalog that ships reading right to left. The films page carries
 * three multi-valued text columns the city page does not, so it is the page
 * where a direction defect is most likely to show.
 */
const RTL_CATALOG_ID = "ar-XB";

/** What actually ran, recorded as it runs, so a dropped state goes red. */
const sweptStates: string[] = [];

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
  // Four states off one mount. Every transition goes through the control a
  // reader would press, so a control that has stopped working fails the sweep
  // instead of the sweep quietly visiting a state no reader can reach.
  it("reports no violation in either theme, on a page past the first, or reading right to left", async () => {
    const user = userEvent.setup();

    render(<FilmsApp />);

    // The engine fetches the real dataset asset across the dev server, parses
    // and indexes it, and only then waits out the seam latency. The jsdom suite
    // pays none of that, because it runs against a fixture.
    await screen.findByRole("table", {}, { timeout: 20_000 });

    // The first state is chosen, never inherited. Left on the default, the
    // theme resolves against the engine's own preference, which would sweep the
    // dark palette twice on a machine that prefers dark and never sweep light.
    await user.click(screen.getByRole("radio", { name: "Light" }));
    await screen.findByRole("radio", { name: "Light", checked: true });
    await sweep("light");

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await screen.findByRole("radio", { name: "Dark", checked: true });
    await sweep("dark");

    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    await screen.findByText(/^Page 2 of /);
    await sweep("paged");

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
  });
});
