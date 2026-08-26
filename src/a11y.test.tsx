import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import App from "./App";
import { describeViolations, incompleteRuleIds } from "./test/axeSweep";

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
 * Runs the rule engine over whatever is currently on screen and holds both
 * assertions, so a state added to the sweep cannot arrive with only half of
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

  expect(describeViolations(results), state).toEqual([]);
  expect(incompleteRuleIds(results), state).toEqual(EXPECTED_INCOMPLETE);
}

describe("accessibility", () => {
  it("reports no violation once the table has rows", async () => {
    render(<App />);
    await screen.findByRole("table");

    await sweep("data");
  });
});
