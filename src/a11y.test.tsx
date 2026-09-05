import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import App from "./App";
import { CITY_FIXTURE_ENVELOPE } from "./test/cityFixture";
import { describeViolations, incompleteRuleIds } from "./test/axeSweep";
import { stubDatasetFetch } from "./test/fetchStub";

// The sweep below runs over the whole document, which puts the page-level rules
// in play. The runner hands each file a bare document, though, so those rules
// would report on the harness shell and not on the one the app ships. That
// harness shell has no language and no title, neither of which is true of
// index.html.
//
// The two facts are therefore lifted off the committed shell, which keeps the
// rules pointed at the application, and the closing case asserts the lift found
// something. The application's own locale effect restamps documentElement.lang
// as it renders, so a shell that dropped the attribute would still be swept
// against a language the application supplied, and the rule engine alone would
// never say so.
//
// Nothing else is copied. The shipped body holds a mount point and two scripts,
// and every case below mounts its own tree.
const shell = readFileSync(
  join(
    (import.meta as ImportMeta & { dirname: string }).dirname,
    "..",
    "index.html",
  ),
  "utf8",
);

const shellLang = /<html[^>]*\slang="([^"]*)"/.exec(shell)?.[1] ?? "";
const shellTitle = /<title>([^<]*)<\/title>/.exec(shell)?.[1] ?? "";

document.documentElement.lang = shellLang;
document.title = shellTitle;

// The rules the engine cannot decide in this environment, recorded by set
// equality so they stay visible. A rule that newly stops being evaluated and a
// rule that starts being evaluated again both turn this red, so the gate cannot
// be quietly weakened by taking a rule out of play.
//
// jsdom implements no layout, so a rule that has to ask what is painted where
// cannot reach a verdict and files itself undecided. That accounts for all three
// entries. Each is paired with something that does decide it, so no rule here
// goes undecided everywhere.
//
// color-contrast needs the rendered color pair behind an element, which needs a
// canvas jsdom does not provide. src/theme/tokens.test.ts covers that ground
// instead, resolving the token indirection in the shipped stylesheet and
// asserting the contrast ratio of every pair it finds, in both themes, against
// the text and non-text thresholds.
//
// landmark-one-main and page-has-heading-one are the two page-level rules that
// first check whether a modal is open, which the engine answers through
// document.elementFromPoint. jsdom does not implement it, so both rules abort
// with an internal error before reading the DOM they were about to read.
// src/a11y.browser.test.tsx decides both for real. Its sweep evaluates 45 rules
// against 36 under a body context, and these two are among the nine the widened
// context adds.
const EXPECTED_INCOMPLETE = Object.freeze([
  "color-contrast",
  "landmark-one-main",
  "page-has-heading-one",
]);

/**
 * Every state the app is swept in, in the order the sweeps run. Written out by
 * hand, so it can disagree with what actually ran; a derived list could not.
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
 * below leaves this short of the list above and the closing case goes red. The
 * toolchain suite's did-the-walker-find-anything guard has the same shape.
 */
const sweptStates: string[] = [];

/**
 * Runs the rule engine over whatever is currently on screen and holds both
 * assertions, so a state added to the walk cannot arrive with only half of
 * them. The state name rides along as the assertion message, so a failure says
 * which of the swept states broke.
 *
 * The context is the document, not the body. Nine rules match the html
 * element, so a body context leaves them outside the include tree and they are
 * reported neither as violations nor as undecided. Three of the nine read the
 * application's own rendered DOM: the skip mechanism to the main content, the
 * single main landmark, and the top-level heading.
 *
 * resultTypes is passed because without it the engine builds a full node list
 * for the thirty-odd rules that pass on every sweep, and nothing reads it.
 * Expect jsdom to complain on stderr about an unimplemented canvas context on
 * each run. The run stays green, and it is the same missing canvas that files
 * the contrast rule as undecided in the first place.
 */
async function sweep(state: string): Promise<void> {
  const results = await axe.run(document, {
    resultTypes: ["violations", "incomplete"],
  });

  // A sweep that reached a verdict on nothing is caught here, not by the
  // allowlist below. That allowlist happens to be non-empty today, so an engine
  // that stopped running would fail it, but only because of the current three
  // entries. The day jsdom can decide all three, the allowlist empties and both
  // assertions become empty against empty.
  expect(results.passes.length, state).toBeGreaterThan(0);

  expect(describeViolations(results), state).toEqual([]);
  expect(incompleteRuleIds(results), state).toEqual(EXPECTED_INCOMPLETE);

  // Recorded after the assertions, so a state that failed its sweep is not also
  // filed as swept. The throw ends the case today, which makes the order look
  // moot; it stops being moot the moment anyone makes this collect failures
  // instead of throwing.
  sweptStates.push(state);
}

describe("accessibility", () => {
  // Five of the six states come off one mount, walked in the order a reader
  // would reach them, and every transition is driven through the control the
  // reader uses, never by calling a handler.
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
  // fail; resetting the registry and re-importing makes it cold enough to
  // reject.
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
  });

  // Its own case. Held as the tail of the sweep that happened to run last, it
  // failed this file with a list one entry long whenever a single sweep was
  // selected through -t, .only or a shard split, and that reads as an
  // accessibility regression when it is only an ordering fact. It still only
  // means anything after the cases above have run, and now says so in its own
  // name.
  it("swept every state it says it sweeps", () => {
    expect(sweptStates).toEqual(SWEPT_STATES);
  });

  // The positive floor under the lift above. A shell that lost either fact
  // leaves the matching value empty and fails here, the only place a dropped
  // language attribute can fail, because the sweeps themselves read a document
  // the application has already restamped.
  it("takes both page-level facts from the shell that ships", () => {
    expect(shellLang).not.toBe("");
    expect(shellTitle).not.toBe("");
  });
});
