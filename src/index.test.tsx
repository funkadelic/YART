import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The bootstrap module reads its container and mounts on evaluation, so there
// is no exported function to call and every case here has to import the module
// afresh. The registry reset below is what makes the second import evaluate at
// all rather than hand back the first one's cached result.

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * The container the mount case appends, held so teardown can remove it. The
 * shared teardown only unmounts roots Testing Library owns, and this file
 * creates its root through the module under test instead, so nothing else
 * clears it and the next case would start against a stale document.
 */
let container: HTMLDivElement | null = null;

describe("bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();

    // This file bypasses Testing Library entirely and drives the framework's
    // own root creation through the module under test, so nothing else sets
    // this flag on its behalf. Without it the mount never flushes and the
    // framework reports that the environment is not configured for it.
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    container?.remove();
    container = null;
  });

  it("mounts the application into the root container", async () => {
    container = document.createElement("div");
    container.id = "root";
    document.body.appendChild(container);

    await act(async () => {
      await import("./index");
    });

    // The awaited query is not a stylistic choice. The application paints its
    // loading branch first and resolves the dataset only after the seam's
    // simulated latency, so a synchronous lookup finds nothing.
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("throws when the root container is absent", async () => {
    expect(document.getElementById("root")).toBeNull();

    await expect(import("./index")).rejects.toThrow(
      "Root container is missing from index.html",
    );
  });
});
