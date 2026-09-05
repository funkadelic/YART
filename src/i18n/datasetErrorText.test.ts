import { describe, expect, it } from "vitest";

import { DATASET_ERROR_CODES, DatasetError } from "../api/getCities";
import { en } from "./catalogs/en";
import { es } from "./catalogs/es";
import { datasetErrorText } from "./datasetErrorText";

/**
 * The one place a failure code becomes a sentence. Two branches: a dataset
 * error is what the loader produces, and everything else is what a stubbed
 * seam, a browser extension or a future caller can produce. The second branch
 * decides whether an application that has already failed can still say why.
 */
describe("datasetErrorText", () => {
  it("says what happened for every code the loader can carry", () => {
    for (const code of DATASET_ERROR_CODES) {
      const sentence = datasetErrorText(
        new DatasetError(code, 0, "the developer-facing text"),
        en.cities,
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
        en.cities,
        "en-US",
      ),
    ).toBe("The city data could not be downloaded (status 503).");
  });

  it("reads the sentence out of the catalog it is given", () => {
    const failure = new DatasetError("notAnObject", 0, "the English message");

    expect(datasetErrorText(failure, es.cities, "es-ES")).toBe(
      es.cities.datasetError.notAnObject("es-ES", 0),
    );
    expect(datasetErrorText(failure, es.cities, "es-ES")).not.toBe(
      datasetErrorText(failure, en.cities, "en-US"),
    );
  });

  it("falls to the unexpected sentence for a failure carrying no code", () => {
    expect(
      datasetErrorText(new Error("Failed to fetch"), en.cities, "en-US"),
    ).toBe("An unexpected error occurred.");
  });

  // The preserved cause is engine text kept for a developer, and the message is
  // written for a developer too. This returns the catalog's sentence in either
  // branch.
  it("returns neither the failure's own message nor its cause", () => {
    const cause = new Error("TypeError: NetworkError when attempting to fetch");
    const failure = new DatasetError(
      "transport",
      0,
      "the developer-facing text",
      { cause },
    );

    const sentence = datasetErrorText(failure, en.cities, "en-US");

    expect(sentence).not.toContain("the developer-facing text");
    expect(sentence).not.toContain("NetworkError");
    expect(sentence).toBe(
      "The city data could not be downloaded. Check your connection and try again.",
    );
  });
});
