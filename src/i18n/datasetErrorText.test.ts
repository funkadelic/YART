import { describe, expect, it } from "vitest";

import { DATASET_ERROR_CODES, DatasetError } from "../api/getCities";
import { en } from "./catalogs/en";
import { es } from "./catalogs/es";
import { datasetErrorText } from "./datasetErrorText";

/**
 * The one place a failure code becomes a sentence. Two branches, and both of
 * them matter: a dataset error is what the loader produces, and everything else
 * is what a stubbed seam, a browser extension or a future caller can produce.
 * The second branch is the one that decides whether an application that has
 * already failed also tells the reader nothing.
 */
describe("datasetErrorText", () => {
  it("says what happened for every code the loader can carry", () => {
    for (const code of DATASET_ERROR_CODES) {
      const sentence = datasetErrorText(
        new DatasetError(code, 0, "the developer-facing text"),
        en,
        "en-US",
      );

      expect(sentence, code).not.toBe("");
      expect(sentence, code).not.toContain("the developer-facing text");
    }
  });

  it("weaves the detail in for a failure whose sentence names one", () => {
    expect(
      datasetErrorText(
        new DatasetError("status", 503, "the developer-facing text"),
        en,
        "en-US",
      ),
    ).toBe("The city data could not be downloaded (status 503).");
  });

  it("reads the sentence out of the catalog it is given", () => {
    const failure = new DatasetError("notAnObject", 0, "the English message");

    expect(datasetErrorText(failure, es, "es-ES")).toBe(
      es.datasetError.notAnObject("es-ES", 0),
    );
    expect(datasetErrorText(failure, es, "es-ES")).not.toBe(
      datasetErrorText(failure, en, "en-US"),
    );
  });

  it("falls to the unexpected sentence for a failure carrying no code", () => {
    expect(datasetErrorText(new Error("Failed to fetch"), en, "en-US")).toBe(
      "An unexpected error occurred",
    );
  });

  // The preserved cause is engine text kept for a developer, and the message is
  // written for a developer too. Neither is what this returns, in either branch.
  it("returns neither the failure's own message nor its cause", () => {
    const cause = new Error("TypeError: NetworkError when attempting to fetch");
    const failure = new DatasetError(
      "transport",
      0,
      "the developer-facing text",
      { cause },
    );

    const sentence = datasetErrorText(failure, en, "en-US");

    expect(sentence).not.toContain("the developer-facing text");
    expect(sentence).not.toContain("NetworkError");
    expect(sentence).toBe(
      "The city data could not be downloaded. Check your connection and try again.",
    );
  });
});
