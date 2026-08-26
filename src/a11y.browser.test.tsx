import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import App from "./App";
import { describeViolations, incompleteRuleIds } from "./test/axeSweep";

// The shipped stylesheet, which only the entry module pulls in. Every design
// token lives here, so a sweep that skipped it would run the contrast rule over
// the engine's default black on white and report on a page no reader ever sees.
import "./index.css";

// The rules the engine could not decide, asserted by set equality as the jsdom
// sweep asserts its own. Empty here, and that emptiness is the reason this file
// exists beside that one: a real engine has a layout engine and a canvas, so it
// can sample the rendered color pair behind an element and the contrast rule
// actually runs rather than filing itself as undecided. A rule turning up
// undecided in a real engine is news, and news belongs in a red run.
const EXPECTED_INCOMPLETE: readonly string[] = Object.freeze([]);

/**
 * Every state the app is swept in, in the order the sweeps run. Written out
 * rather than derived, so it can disagree with what actually ran.
 */
const SWEPT_STATES = Object.freeze(["light", "dark", "paged"]);

/**
 * What actually ran, recorded as it runs. A state quietly dropped from the walk
 * below leaves this short of the list above and the closing assertion goes red.
 */
const sweptStates: string[] = [];

/**
 * Runs the rule engine over whatever is currently on screen and holds both
 * assertions, so a state added to the walk cannot arrive with only half of
 * them. The state name rides along as the assertion message, which is what
 * makes a failure say which of the swept states broke.
 *
 * The context is the document rather than the body, for the reason the jsdom
 * sweep widens its own: nine rules match the html element and a body context
 * reports them neither as violations nor as undecided. Here the page really is
 * the page, so the page-level rules read what a reader would load.
 *
 * resultTypes is passed for the same reason the jsdom sweep passes it: without
 * it the engine builds a full node list for the thirty-odd rules that pass on
 * every sweep, and nothing reads it.
 */
async function sweep(state: string): Promise<void> {
  const results = await axe.run(document, {
    resultTypes: ["violations", "incomplete"],
  });

  sweptStates.push(state);

  expect(describeViolations(results), state).toEqual([]);
  expect(incompleteRuleIds(results), state).toEqual(EXPECTED_INCOMPLETE);
}

describe("accessibility in a real engine", () => {
  // Three states off one mount. Every transition goes through the control a
  // reader would press, so a control that has stopped working fails the sweep
  // instead of the sweep quietly visiting a state no reader can reach.
  it("reports no violation in either theme or on a page past the first", async () => {
    const user = userEvent.setup();

    render(<App />);

    // The one generous wait in the file, and deliberate rather than a smell.
    // The engine fetches the real multi-megabyte dataset asset across the dev
    // server, parses and indexes it, and only then waits out the seam latency.
    // The jsdom suite pays none of that, because it runs against a fixture.
    await screen.findByRole("table", {}, { timeout: 20_000 });

    // The first state is chosen rather than inherited. Left on the default the
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

    expect(sweptStates).toEqual(SWEPT_STATES);
  });
});
