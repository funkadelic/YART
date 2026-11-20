import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { resize } from "../test/resizeObserverStub";
import { useInlineOverflow } from "./useInlineOverflow";

/** A scroller around one child, reporting the hook's answer as an attribute. */
function Probe() {
  const [ref, scrolls] = useInlineOverflow();
  return (
    <div ref={ref} data-testid="scroller" data-scrolls={String(scrolls)}>
      <span data-testid="child" />
    </div>
  );
}

/** Sets the sizes and overflow the hook reads, then fires `target`'s observers. */
function layout(
  scroller: HTMLElement,
  target: Element,
  { overflowX = "auto", scroll = 900, client = 400 } = {},
) {
  scroller.style.overflowX = overflowX;
  Object.defineProperty(scroller, "scrollWidth", {
    value: scroll,
    configurable: true,
  });
  Object.defineProperty(scroller, "clientWidth", {
    value: client,
    configurable: true,
  });
  resize(target);
}

describe("useInlineOverflow", () => {
  it("follows the content as it grows wider and narrower again", () => {
    render(<Probe />);
    const scroller = screen.getByTestId("scroller");
    expect(scroller).toHaveAttribute("data-scrolls", "false");

    layout(scroller, scroller);
    expect(scroller).toHaveAttribute("data-scrolls", "true");

    layout(scroller, scroller, { scroll: 400 });
    expect(scroller).toHaveAttribute("data-scrolls", "false");
  });

  it("re-measures when only a child resizes", () => {
    render(<Probe />);
    const scroller = screen.getByTestId("scroller");

    layout(scroller, screen.getByTestId("child"));
    expect(scroller).toHaveAttribute("data-scrolls", "true");
  });

  it("does not count content clipped by a box that cannot scroll", () => {
    render(<Probe />);
    const scroller = screen.getByTestId("scroller");

    layout(scroller, scroller, { overflowX: "hidden" });
    expect(scroller).toHaveAttribute("data-scrolls", "false");

    layout(scroller, scroller, { overflowX: "scroll" });
    expect(scroller).toHaveAttribute("data-scrolls", "true");
  });

  it("keeps the answer while the scroller holds focus", () => {
    render(<Probe />);
    const scroller = screen.getByTestId("scroller");
    scroller.tabIndex = 0;
    layout(scroller, scroller);
    scroller.focus();

    layout(scroller, scroller, { scroll: 400 });
    expect(scroller).toHaveAttribute("data-scrolls", "true");
  });

  it("starts a remounted scroller false", () => {
    const { rerender } = render(<Probe key="first" />);
    layout(screen.getByTestId("scroller"), screen.getByTestId("scroller"));

    rerender(<Probe key="second" />);
    expect(screen.getByTestId("scroller")).toHaveAttribute(
      "data-scrolls",
      "false",
    );
  });

  it("stays false where ResizeObserver does not exist", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<Probe />);
    expect(screen.getByTestId("scroller")).toHaveAttribute(
      "data-scrolls",
      "false",
    );
  });
});
