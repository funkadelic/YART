import { act, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubFilmDatasetFetch } from "./test/fetchStub";

// The bootstrap module reads its container and mounts on evaluation, so there
// is no exported function to call and every case here has to import the module
// afresh. The registry reset below is what makes the second import evaluate at
// all; without it the first import's cached result comes back.

const actEnvironment = globalThis as typeof globalThis & {
  // Explicitly undefined, and not just optional, because the teardown writes
  // back whatever was read and absent is what it reads first.
  IS_REACT_ACT_ENVIRONMENT?: boolean | undefined;
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
 * the global back as it found it.
 */
let previousActEnvironment: boolean | undefined;

describe("films bootstrap", () => {
  beforeEach(() => {
    // Installed over the city stub the setup file puts in place. Without it the
    // films loader parses city rows and fails on the column order.
    stubFilmDatasetFetch();
    vi.resetModules();

    // This file bypasses Testing Library entirely and drives the framework's
    // own root creation through the module under test, so nothing else sets
    // this flag on its behalf. Without it the mount never flushes and the
    // framework reports that the environment is not configured for it.
    previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    // Let the dataset settle inside act, so a late state write into the
    // detached tree cannot warn on the next case.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    container?.remove();
    container = null;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("mounts the films application into the root container", async () => {
    container = document.createElement("div");
    container.id = "root";
    document.body.appendChild(container);

    await act(async () => {
      await import("./movies");
    });

    // Scoped to the container, because the claim is that the bootstrap mounted
    // the application inside #root, and a document-wide query is satisfied by a
    // table rendered anywhere at all.
    expect(await within(container).findByRole("table")).toBeInTheDocument();
  });

  it("throws when the root container is absent, naming its own shell", async () => {
    expect(document.getElementById("root")).toBeNull();

    await expect(import("./movies")).rejects.toThrow(
      "Root container is missing from movies.html",
    );
  });
});
