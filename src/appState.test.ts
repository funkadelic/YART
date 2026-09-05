import { describe, expect, it } from "vitest";

import {
  INITIAL_APP_STATE,
  applyAppAction,
  type AppAction,
  type AppState,
} from "./appState";
import { CITY_FIXTURE } from "./test/cityFixture";

import type { City } from "./api/getCities";

const ROWS: City[] = CITY_FIXTURE.slice(0, 2);

const FAILURE = new Error("The city service is unreachable");

const attempted: AppState<City> = {
  ...INITIAL_APP_STATE,
  loading: true,
};

const failed: AppState<City> = {
  ...attempted,
  error: FAILURE,
};

const resolved: AppState<City> = {
  ...attempted,
  rows: ROWS,
  datasetReady: true,
};

describe("applyAppAction: starting an attempt", () => {
  it("raises the loading flag and clears the error in one transition", () => {
    const next = applyAppAction(INITIAL_APP_STATE, { type: "attempt" });

    expect(next.loading).toBe(true);
    expect(next.error).toBeNull();
  });

  it("clears a previous failure, so a retry does not show the old error beside the new load", () => {
    const next = applyAppAction(failed, { type: "attempt" });

    expect(next.error).toBeNull();
    expect(next.loading).toBe(true);
  });

  it("leaves the rows that are already on screen alone", () => {
    const next = applyAppAction(resolved, { type: "attempt" });

    expect(next.rows).toBe(ROWS);
  });
});

describe("applyAppAction: an attempt that resolves", () => {
  it("stores the rows and records that the collection has arrived", () => {
    const next = applyAppAction(attempted, { type: "resolved", rows: ROWS });

    expect(next.rows).toBe(ROWS);
    expect(next.datasetReady).toBe(true);
  });

  it("keeps the arrival flag raised through a later attempt", () => {
    const arrived = applyAppAction(attempted, {
      type: "resolved",
      rows: ROWS,
    });

    expect(applyAppAction(arrived, { type: "attempt" }).datasetReady).toBe(
      true,
    );
  });

  it("clears an error it lands on top of", () => {
    const next = applyAppAction(failed, { type: "resolved", rows: ROWS });

    expect(next.error).toBeNull();
  });
});

describe("applyAppAction: an attempt that fails", () => {
  it("stores the error it was given", () => {
    expect(
      applyAppAction(attempted, { type: "failed", error: FAILURE }).error,
    ).toBe(FAILURE);
  });

  it("leaves the rows and the arrival flag exactly as they were", () => {
    const next = applyAppAction(resolved, { type: "failed", error: FAILURE });

    expect(next.rows).toBe(ROWS);
    expect(next.datasetReady).toBe(true);
  });
});

describe("applyAppAction: settling", () => {
  const SETTLED_FROM: Array<[string, AppState<City>]> = [
    ["resolved", resolved],
    ["failed", failed],
  ];

  for (const [label, state] of SETTLED_FROM) {
    it(`lowers the loading flag from a ${label} state, so no outcome leaves a permanent spinner`, () => {
      expect(applyAppAction(state, { type: "settled" }).loading).toBe(false);
    });
  }
});

describe("applyAppAction: retrying", () => {
  it("increments the attempt counter", () => {
    expect(applyAppAction(failed, { type: "retry" }).retryAttempt).toBe(1);

    const twice = applyAppAction(applyAppAction(failed, { type: "retry" }), {
      type: "retry",
    });
    expect(twice.retryAttempt).toBe(2);
  });

  it("changes nothing else, so the effect it re-runs decides what happens next", () => {
    const next = applyAppAction(failed, { type: "retry" });

    expect(next).toEqual({ ...failed, retryAttempt: 1 });
  });
});

describe("applyAppAction: purity", () => {
  const EVERY_ACTION: AppAction<City>[] = [
    { type: "attempt" },
    { type: "resolved", rows: ROWS },
    { type: "failed", error: FAILURE },
    { type: "settled" },
    { type: "retry" },
  ];

  for (const action of EVERY_ACTION) {
    it(`returns a new object and leaves the old one alone on a ${action.type} action`, () => {
      const before = { ...resolved };

      const next = applyAppAction(resolved, action);

      expect(next).not.toBe(resolved);
      expect(resolved).toEqual(before);
    });

    it(`leaves the ${action.type} action itself untouched`, () => {
      const before = { ...action };

      applyAppAction(resolved, action);

      expect(action).toEqual(before);
    });
  }
});

describe("INITIAL_APP_STATE", () => {
  it("holds no rows, no error, nothing in flight, nothing arrived, and no attempt made", () => {
    expect(INITIAL_APP_STATE).toEqual({
      rows: [],
      error: null,
      loading: false,
      datasetReady: false,
      retryAttempt: 0,
    });
  });
});
