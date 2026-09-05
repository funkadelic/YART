import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FilmsApp from "./FilmsApp";
import { describeViolations, incompleteRuleIds } from "./test/axeSweep";
import { stubFilmDatasetFetch } from "./test/fetchStub";

// The sweep below runs over the whole document rather than over the body, which
// is what puts the page-level rules in play. The runner hands each file a bare
// document, though, so those rules would report on the harness shell rather than
// on the one this page ships: no language and no title, neither of which is true
// of movies.html.
//
// The two facts are therefore lifted off the committed second shell rather than
// written out here, exactly as the city sweep lifts them off the first, and the
// closing case asserts the lift found something. That case is not ceremony: the
// application's own locale effect restamps documentElement.lang as it renders,
// so a shell that dropped the attribute would still be swept against a language
// the application supplied, and the rule engine alone would never say so.
const shell = readFileSync(
  join(
    (import.meta as ImportMeta & { dirname: string }).dirname,
    "..",
    "movies.html",
  ),
  "utf8",
);

const shellLang = /<html[^>]*\slang="([^"]*)"/.exec(shell)?.[1] ?? "";
const shellTitle = /<title>([^<]*)<\/title>/.exec(shell)?.[1] ?? "";

document.documentElement.lang = shellLang;
document.title = shellTitle;

// The same expectation the city jsdom sweep asserts, and asserted the same way:
// by set equality rather than by ignoring. Deliberately not widened. A rule this
// page cannot satisfy is a violation to fix, not an entry to add here, because
// an entry is a rule the gate stops deciding.
//
// Three entries, all of one cause: jsdom implements no layout, so a rule that
// has to ask what is painted where cannot reach a verdict. color-contrast is
// decided over the token values in src/theme/tokens.test.ts, and the two
// page-level rules are decided for real by src/a11y.films.browser.test.tsx.
const EXPECTED_INCOMPLETE = Object.freeze([
  "color-contrast",
  "landmark-one-main",
  "page-has-heading-one",
]);

/**
 * Every state this page is swept in, in the order the sweeps run. Written out
 * rather than derived, so it can disagree with what actually ran.
 */
const SWEPT_STATES = Object.freeze(["data", "empty", "error"]);

/** What actually ran, recorded as it runs, so a dropped state goes red. */
const sweptStates: string[] = [];

/**
 * Runs the rule engine over whatever is currently on screen and holds both
 * assertions, so a state added to the walk cannot arrive with only half of
 * them. The state name rides along as the assertion message.
 *
 * The context is the document rather than the body, for the reason the city
 * sweep widens its own: nine rules match the html element, and a body context
 * reports them neither as violations nor as undecided.
 */
async function sweep(state: string): Promise<void> {
  const results = await axe.run(document, {
    resultTypes: ["violations", "incomplete"],
  });

  // A sweep that reached a verdict on nothing is caught here rather than by the
  // allowlist below, which is non-empty today and would catch it by accident.
  expect(results.passes.length, state).toBeGreaterThan(0);

  expect(describeViolations(results), state).toEqual([]);
  expect(incompleteRuleIds(results), state).toEqual(EXPECTED_INCOMPLETE);

  // Recorded after the assertions, so a state that failed its sweep is not also
  // filed as swept.
  sweptStates.push(state);
}

describe("films accessibility", () => {
  beforeEach(() => {
    // Installed over the city stub the setup file puts in place. Without it the
    // parse boundary refuses the payload and every case below fails on a column
    // order failure rather than on an accessibility finding.
    stubFilmDatasetFetch();
  });

  it("reports no violation once the film table is loaded or emptied", async () => {
    const user = userEvent.setup();

    render(<FilmsApp />);

    // Each state is proven to be on screen before it is swept, by a query that
    // throws when it is not, or a transition that quietly failed would sweep
    // the previous state twice and still report both.
    await screen.findByRole("table");
    await sweep("data");

    await user.type(
      screen.getByRole("textbox", { name: "Search" }),
      "no film is called this",
    );
    await screen.findByText("No films found");
    await sweep("empty");
  });

  // The failure state needs its own mount. The loader caches its dataset request
  // at module scope, so the case above leaves a warm cache no stub can fail;
  // resetting the registry and re-importing is what makes it cold enough.
  it("reports no violation when the film dataset fails to load", async () => {
    stubFilmDatasetFetch().mockResolvedValueOnce(
      new Response("not found", { status: 404 }),
    );

    vi.resetModules();
    const FreshFilmsApp = (await import("./FilmsApp")).default;

    render(<FreshFilmsApp />);

    await screen.findByText(
      "Error: The film data could not be downloaded (status 404).",
    );
    await sweep("error");
  });

  // Its own case rather than the tail of whichever sweep runs last, for the
  // reason the city sweep gives: selected alone it would fail with a short list,
  // which reads as an accessibility regression rather than as an ordering fact.
  it("swept every state it says it sweeps", () => {
    expect(sweptStates).toEqual(SWEPT_STATES);
  });

  // The positive floor under the lift above. A shell that lost either fact
  // leaves the matching value empty and fails here, which is the only place a
  // dropped language attribute can fail: the sweeps themselves read a document
  // the application has already restamped.
  it("takes both page-level facts from the shell that ships", () => {
    expect(shellLang).not.toBe("");
    expect(shellTitle).not.toBe("");
  });
});
