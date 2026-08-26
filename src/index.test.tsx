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

/**
 * Whatever the flag below held before this file touched it, so the file hands
 * the global back as it found it. Nothing else in the suite sets it today, which
 * is exactly why leaving it set would be found late and somewhere else.
 */
let previousActEnvironment: boolean | undefined;

/**
 * The seam's simulated latency, written out here as src/App.test.tsx writes it
 * out, because the constant is private to src/api/getCities.ts and exporting it
 * would widen that module for a teardown. Teardown waits twice it, so the figure
 * only has to be an upper bound rather than the exact one.
 */
const SEAM_LATENCY_MS = 200;

describe("bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();

    // This file bypasses Testing Library entirely and drives the framework's
    // own root creation through the module under test, so nothing else sets
    // this flag on its behalf. Without it the mount never flushes and the
    // framework reports that the environment is not configured for it.
    previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    // The root is created inside the module under test, so there is no handle to
    // unmount and the tree outlives the case that mounted it. Letting the seam's
    // latency settle inside act is what keeps a resolved dataset from writing
    // state into a detached tree after the case has ended, which is where the
    // stray "not wrapped in act" warning comes from and why it lands on whatever
    // case runs next rather than on this one.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, SEAM_LATENCY_MS * 2));
    });

    container?.remove();
    container = null;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
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
