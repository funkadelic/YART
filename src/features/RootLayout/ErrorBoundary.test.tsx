import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";
import { RootLayout } from "./RootLayout";
import { CityTable } from "../CityTable";

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

describe("ErrorBoundary mounted in the layout", () => {
  it("keeps the banner and the attribution footer on screen while the fallback shows", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <RootLayout>
        <ThrowingChild />
      </RootLayout>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /could not be displayed/i,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("YART")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      /simplemaps.com World Cities/,
    );
    expect(consoleError).toHaveBeenCalled();
  });

  it("shows the fallback as the only alert region when a render throws", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <RootLayout>
        <ThrowingChild />
      </RootLayout>,
    );

    // The boundary returns either the fallback or its children and never both,
    // so the subtree holding the table's inline error region is unmounted here.
    // Asserted rather than assumed, because the two error surfaces are
    // maintained independently and nothing else pins them mutually exclusive.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("shows the inline asynchronous error region as the only alert region when a request rejects", () => {
    render(
      <RootLayout>
        <CityTable
          data={[]}
          searchTerm=""
          onSearchChange={() => {}}
          loading={false}
          datasetReady={false}
          error={new Error("The city data could not be read.")}
          onRetry={() => {}}
        />
      </RootLayout>,
    );

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("The city data could not be read.");
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/could not be displayed/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show it again" }),
    ).not.toBeInTheDocument();
  });
});
