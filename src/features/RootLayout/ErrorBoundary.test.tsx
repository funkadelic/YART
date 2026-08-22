import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

const THROWN_MESSAGE = "a render threw this";

// The flag is module-local rather than a prop so the same component instance
// can throw on one render and succeed on the next, which is what the recovery
// cases need. A prop would be read from a subtree the boundary has unmounted.
let shouldThrow = true;

function ThrowingChild() {
  if (shouldThrow) {
    throw new Error(THROWN_MESSAGE);
  }
  return <p>the child rendered</p>;
}

beforeEach(() => {
  shouldThrow = true;
});

describe("ErrorBoundary", () => {
  it("replaces a child that throws with the fallback and its recovery control", () => {
    // React 19 reports a caught render error through this channel, so the test
    // is noisy by design. Asserting the call keeps the spy honest instead of
    // buying silence with no assertion.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    const fallback = screen.getByRole("alert");
    expect(fallback).toHaveTextContent(/could not be displayed/i);
    expect(
      screen.getByRole("button", { name: "Show it again" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("the child rendered")).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("never puts the thrown error's own message on screen", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.queryByText(THROWN_MESSAGE)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(THROWN_MESSAGE);
    expect(consoleError).toHaveBeenCalled();
  });

  it("renders children unchanged and adds no element of its own when nothing throws", () => {
    shouldThrow = false;

    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("the child rendered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.firstElementChild?.tagName).toBe("P");
    expect(container.childElementCount).toBe(1);
  });

  it("restores the children when the recovery control is used and the child now succeeds", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();

    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Show it again" }));

    expect(screen.getByText("the child rendered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("brings the fallback straight back, still operable, when the child throws every time", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "Show it again" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show it again" })).toBeEnabled();
    expect(screen.queryByText("the child rendered")).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});
