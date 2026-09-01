import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { page } from "vitest/browser";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import App from "./App";
import { describeViolations, incompleteRuleIds } from "./test/axeSweep";
import { required } from "./test/required";

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
const SWEPT_STATES = Object.freeze(["light", "dark", "paged", "rtl"]);

/**
 * The one catalog that ships reading right to left. It is not a language, and
 * that is why it ships: the other three all read left to right, which would
 * leave the direction half of this file with nothing to prove itself against.
 */
const RTL_CATALOG_ID = "ar-XB";

/**
 * The inset the search icon sits at, and the inset the input reserves for it.
 * One token, var(--space-4), restated here as a resolved length rather than
 * imported, per the convention that a value the subject also defines is written
 * out in the test so the assertion cannot pass for whatever the subject holds.
 */
const SEARCH_ICON_INSET = "16px";

/**
 * The wide inset the input reserves for that icon, var(--space-11), and the
 * narrow one on its other side, var(--space-2-5). Written out for the same
 * reason the inset above is.
 */
const SEARCH_RESERVED_INSET = "44px";
const SEARCH_PLAIN_INSET = "10px";

/** A mirrored glyph, as the engine resolves scaleX(-1). */
const MIRRORED = "matrix(-1, 0, 0, 1, 0, 0)";

/**
 * Narrow enough for the table's horizontal scroll container, which only exists
 * below 768px, and the desktop size the browser project is configured with and
 * which the closing sweep state assumes. Restated rather than read back off the
 * runner, because restoring to whatever the runner happens to report would make
 * the restoration unfalsifiable.
 */
const NARROW_VIEWPORT = Object.freeze({ width: 480, height: 900 });
const DESKTOP_VIEWPORT = Object.freeze({ width: 1280, height: 900 });

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
 * every sweep, and nothing reads it. It still reports which rules passed, which
 * is what the first assertion below reads.
 */
async function sweep(state: string): Promise<void> {
  const results = await axe.run(document, {
    resultTypes: ["violations", "incomplete"],
  });

  // Both assertions below compare against an empty set in this file, so a sweep
  // that reached a verdict on nothing reads exactly like a sweep of a clean
  // page. The rules that passed are what tell the two apart. Asserted as a
  // floor rather than as the count evaluated today, so a rule retired upstream
  // is not a failure and an engine that ran nothing still is.
  expect(results.passes.length, state).toBeGreaterThan(0);

  expect(describeViolations(results), state).toEqual([]);
  expect(incompleteRuleIds(results), state).toEqual(EXPECTED_INCOMPLETE);

  // Recorded after the assertions rather than before them, for the reason the
  // jsdom sweep records it there: a state that failed its sweep is not a state
  // that was swept clean.
  sweptStates.push(state);
}

describe("accessibility in a real engine", () => {
  // Four states off one mount. Every transition goes through the control a
  // reader would press, so a control that has stopped working fails the sweep
  // instead of the sweep quietly visiting a state no reader can reach.
  it("reports no violation in either theme, on a page past the first, or reading right to left", async () => {
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

    // The picker is operated rather than the attribute being set, so the state
    // swept is one a reader can actually reach. Found by role alone: its own
    // accessible name follows the language it is about to change.
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      RTL_CATALOG_ID,
    );
    await waitFor(() => {
      expect(document.documentElement.dir).toBe("rtl");
    });
    await sweep("rtl");

    // Two of the six rewritten declarations, read back as the engine resolved
    // them. These are the assertions jsdom cannot make: it has no layout engine,
    // so it resolves a logical property to nothing at all and a direction to
    // nothing either. Reverting either declaration turns this red.
    const searchIcon = required(
      screen.getByRole("textbox").previousElementSibling ?? undefined,
      "the search icon beside the search box",
    );

    // Under this direction the reading start is the right-hand side, so the
    // inline-start inset resolves onto the right edge, and so does the wide half
    // of the padding that reserves room for the icon. The two were rewritten as
    // a pair and are asserted as one, because either alone leaves the icon
    // sitting over the text.
    expect(getComputedStyle(searchIcon).right).toBe(SEARCH_ICON_INSET);

    const searchPadding = getComputedStyle(screen.getByRole("textbox"));

    expect(searchPadding.paddingRight).toBe(SEARCH_RESERVED_INSET);
    expect(searchPadding.paddingLeft).toBe(SEARCH_PLAIN_INSET);

    // The number column, which is the last of the five. Its cells carry the
    // alignment and its neighbours do not, so a class wired onto the wrong cell
    // is caught here rather than merely rendering off-centre.
    const bodyCells = within(
      required(screen.getAllByRole("row")[1], "the first data row"),
    ).getAllByRole("cell");

    expect(
      getComputedStyle(required(bodyCells[4], "the population cell")).textAlign,
    ).toBe("end");
    expect(
      getComputedStyle(required(bodyCells[0], "the first column's cell"))
        .textAlign,
    ).toBe("start");

    // Its header control is a form widget and shrinks to its content, so the
    // automatic inline-start margin is the only thing carrying it to that same
    // edge. Under this direction that margin resolves onto the right, which is
    // the half a layout engine is needed to see.
    const sortControl = getComputedStyle(
      within(
        required(
          screen.getAllByRole("columnheader")[4],
          "the population header cell",
        ),
      ).getByRole("button"),
    );

    expect(sortControl.marginLeft).toBe("0px");
    expect(Number.parseFloat(sortControl.marginRight)).toBeGreaterThan(0);

    // The remaining two of the six, on the header's segmented control. Its
    // automatic margin resolves onto the reading-end side, so the control still
    // pins to the trailing edge; its separator hairlines fall between the labels
    // rather than doubling against the outer edge, which is what the reset on the
    // reading-start-most label is for.
    const themeControl = screen.getByRole("radiogroup");
    const themeMargins = getComputedStyle(themeControl);

    expect(themeMargins.marginLeft).toBe("0px");
    expect(Number.parseFloat(themeMargins.marginRight)).toBeGreaterThan(0);

    const themeLabels = within(themeControl)
      .getAllByRole("radio")
      .map((input, index) =>
        required(
          input.nextElementSibling ?? undefined,
          `the label beside theme option ${String(index)}`,
        ),
      );

    expect(themeLabels).toHaveLength(3);

    themeLabels.forEach((label, index) => {
      const hairlines = getComputedStyle(label);

      expect(hairlines.borderLeftWidth, String(index)).toBe("0px");
      expect(hairlines.borderRightWidth, String(index)).toBe(
        index === 0 ? "0px" : "1px",
      );
    });

    // The four page controls read first, previous, next, last from the reading
    // start, which under this direction runs right to left across the row. Their
    // document order is that order, so their resolved left edges must descend.
    const controls = within(screen.getByRole("navigation")).getAllByRole(
      "button",
    );

    expect(controls).toHaveLength(4);

    const edges = controls.map(
      (control) => control.getBoundingClientRect().left,
    );

    expect(edges).toEqual([...edges].toSorted((a, b) => b - a));

    // Position is what flex reverses. The glyphs are mirrored by the stylesheet,
    // and this is the half that would silently stay wrong without it.
    for (const control of controls) {
      const glyph = required(
        control.querySelector("svg") ?? undefined,
        "the page control's glyph",
      );

      expect(getComputedStyle(glyph).transform).toBe(MIRRORED);
    }

    // The scroll container only exists below 768px, and the project runs at a
    // desktop size on purpose, so the viewport is narrowed for this one check
    // and put back before the assertion that closes the file.
    await page.viewport(NARROW_VIEWPORT.width, NARROW_VIEWPORT.height);

    const scroller = required(
      screen.getByRole("table").parentElement ?? undefined,
      "the table's scroll container",
    );

    await waitFor(() => {
      expect(getComputedStyle(scroller).overflowX).toBe("auto");
    });

    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);

    // Reachability rather than a scroll offset. Under this direction the offset
    // runs negative in a standards-compliant engine, nothing in this tree reads
    // one, and a test that started would be the first. The first column reads at
    // the start edge and is on screen; the last is the one the container exists
    // to reach, so it lies off the visible box while still being laid out.
    const narrowCells = within(
      required(screen.getAllByRole("row")[1], "the first data row"),
    ).getAllByRole("cell");
    const scrollerBox = scroller.getBoundingClientRect();
    const firstBox = required(
      narrowCells[0],
      "the first column's cell",
    ).getBoundingClientRect();
    const lastBox = required(
      narrowCells.at(-1),
      "the last column's cell",
    ).getBoundingClientRect();

    for (const box of [firstBox, lastBox]) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }

    expect(firstBox.right).toBeLessThanOrEqual(Math.ceil(scrollerBox.right));
    expect(lastBox.left).toBeLessThan(scrollerBox.left);

    await page.viewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);

    expect(sweptStates).toEqual(SWEPT_STATES);
  });
});
