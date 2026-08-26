import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import App from "./App";
import { CITY_FIXTURE_ENVELOPE } from "./test/cityFixture";
import { describeViolations, incompleteRuleIds } from "./test/axeSweep";
import { stubDatasetFetch } from "./test/fetchStub";

// The rules the engine cannot decide in this environment, asserted by set
// equality rather than ignored. A rule that newly stops being evaluated and a
// rule that starts being evaluated again both turn this red, so the gate cannot
// be quietly weakened by taking a rule out of play.
//
// The one entry: jsdom has no layout engine and no canvas, so the rendered color
// pair behind an element cannot be computed and the contrast rule is undecided
// on every sweep. That ground is covered another way. src/theme/tokens.test.ts
// resolves the token indirection in the shipped stylesheet and asserts the
// contrast ratio of every pair it finds, in both themes, against the text and
// non-text thresholds. This entry records that pairing; it is not a suppression.
const EXPECTED_INCOMPLETE = Object.freeze(["color-contrast"]);

/**
 * Every state the app is swept in, in the order the sweeps run. Written out
 * rather than derived, so it can disagree with what actually ran.
 */
const SWEPT_STATES = Object.freeze([
  "loading",
  "data",
  "sorted",
  "paged",
  "empty",
  "error",
]);

/**
 * What actually ran, recorded as it runs. A state quietly dropped from the walk
 * below leaves this short of the list above and the closing assertion goes red,
 * which is the same shape as the did-the-walker-find-anything guard the
 * toolchain suite uses.
 */
const sweptStates: string[] = [];

/**
 * Runs the rule engine over whatever is currently on screen and holds both
 * assertions, so a state added to the walk cannot arrive with only half of
 * them. The state name rides along as the assertion message, which is what
 * makes a failure say which of the swept states broke.
 *
 * resultTypes is passed deliberately: without it the engine builds a full node
 * list for the thirty-odd rules that pass on every sweep, and nothing reads it.
 * Expect jsdom to complain on stderr about an unimplemented canvas context on
 * each run. It fails nothing, and it is the same missing canvas that files the
 * contrast rule as undecided in the first place.
 */
async function sweep(state: string): Promise<void> {
  const results = await axe.run(document.body, {
    resultTypes: ["violations", "incomplete"],
  });

  sweptStates.push(state);

  expect(describeViolations(results), state).toEqual([]);
  expect(incompleteRuleIds(results), state).toEqual(EXPECTED_INCOMPLETE);
}

describe("accessibility", () => {
  // Five of the six states come off one mount, walked in the order a reader
  // would reach them, and every transition is driven through the control the
  // reader uses rather than by calling a handler.
  it("reports no violation as the table is loaded, sorted, paged and emptied", async () => {
    const user = userEvent.setup();

    render(<App />);

    // Each state is proven to be on screen before it is swept, by a query that
    // throws when it is not. Without that a transition which quietly failed
    // would sweep the previous state twice and still report six.
    screen.getByText("Downloading the city data...");
    await sweep("loading");

    await screen.findByRole("table");
    await sweep("data");

    await user.click(screen.getByRole("button", { name: "City" }));
    await sweep("sorted");

    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    screen.getByText("Page 2 of 3");
    await sweep("paged");

    await user.type(
      screen.getByRole("textbox", { name: "Search" }),
      "no city is called this",
    );
    await screen.findByText("No cities found");
    await sweep("empty");
  });

  // The failure state needs its own mount. The loader caches its dataset request
  // at module scope, so the walk above leaves a warm cache that no stub can
  // fail; resetting the registry and re-importing is what makes it cold enough
  // to reject.
  it("reports no violation when the dataset fails to load", async () => {
    stubDatasetFetch(CITY_FIXTURE_ENVELOPE).mockResolvedValueOnce(
      new Response("not found", { status: 404 }),
    );

    vi.resetModules();
    const FreshApp = (await import("./App")).default;

    render(<FreshApp />);

    await screen.findByText(
      "Error: The city data could not be downloaded (status 404).",
    );
    await sweep("error");

    expect(sweptStates).toEqual(SWEPT_STATES);
  });
});
