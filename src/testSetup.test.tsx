import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, it, expect } from "vitest";

/**
 * Writes the address as it unmounts, which is the shape the teardown has to
 * survive.
 *
 * The real source of such a write is a render still pending from a timer when
 * a test ends, flushed along with its effects by the unmount. That version is a
 * race and cannot be asserted on. Writing from the unmount itself puts the same
 * write in the same place in the teardown with none of the timing, so the
 * ordering is what is under test rather than the scheduler.
 *
 * It renders a marker rather than nothing, so a case that runs after the
 * teardown can tell an unmount that happened from one that never did.
 */
function WritesAddressOnUnmount() {
  useEffect(
    () => () => {
      window.history.replaceState(null, "", "?q=leaked");
    },
    [],
  );

  return <p>still mounted</p>;
}

// These three cases are one assertion split across a teardown, so they are
// ordered rather than independent. A hook that runs between tests cannot be
// observed from inside one.
describe("test setup teardown", () => {
  // Asserted rather than assumed. Without this, the pair below passes whether
  // the fixture writes anything at all, and the guard would go dead in silence
  // the day the fixture stopped writing.
  it("writes the address as it unmounts", () => {
    const { unmount } = render(<WritesAddressOnUnmount />);

    unmount();

    expect(window.location.search).toBe("?q=leaked");
    window.history.replaceState(null, "", "/");
  });

  it("leaves an address write for the teardown to find", () => {
    render(<WritesAddressOnUnmount />);

    // Nothing has unmounted yet, so the write is still ahead of the teardown.
    expect(window.location.search).toBe("");
  });

  it("resets the address after the unmount rather than before it", () => {
    // Fails if the unmount and the resets are ever split back into two hooks:
    // the runner would then run the resets first and this case would open on
    // the previous one's leaked address.
    expect(window.location.search).toBe("");
    // And fails if the unmount stops happening at all, which would otherwise
    // leave this case green for the second reason a dead guard is green: no
    // write to leak because nothing tore down.
    expect(screen.queryByText("still mounted")).not.toBeInTheDocument();
  });
});
