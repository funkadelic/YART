import {
  expect,
  test as base,
  type CDPSession,
  type Page,
  type TestInfo,
} from "@playwright/test";

/**
 * Interaction latency on the cities page with the processor slowed, measured
 * with Event Timing and gated on the median of repeated runs.
 */

// Covers fetching, parsing and indexing the real dataset, as the other specs do.
const DATASET_READY_TIMEOUT_MS = 20_000;

/** How much slower the processor runs, standing in for a mid-tier device. */
const CPU_SLOWDOWN = 4;

/** Runs per interaction; each metric is gated on the median. */
const REPEATS = 5;

/** The smallest duration threshold the event observer accepts. */
const EVENT_TIMING_FLOOR_MS = 16;

/** Every row in the committed dataset. */
const TOTAL_ROWS = 50250;

const RESOLVED_TAG = "en-US";
const GROUPED_TOTAL = new Intl.NumberFormat(RESOLVED_TAG).format(TOTAL_ROWS);
const FULL_CAPTION = `City data with ${GROUPED_TOTAL} entries, currently not sorted`;
/** The caption once City is sorted ascending. */
const SORTED_CAPTION = `City data with ${GROUPED_TOTAL} entries, currently sorted by City ascending`;

// Mirrors the container's search debounce.
const SEARCH_DEBOUNCE_MS = 150;

/** A term matching enough rows to filter and page, as the url-state spec uses. */
const SEARCH_TERM = "san";
const MATCHING_ROWS = 1701;
const SEARCH_CAPTION = `City data with ${new Intl.NumberFormat(RESOLVED_TAG).format(MATCHING_ROWS)} entries, currently not sorted`;

/**
 * Median budgets in ms. Event durations take 3x a local baseline rounded up to
 * 50, floored at the INP "good" boundary (200); time to a settled result
 * (searchResults, sortSettled) takes the 3x rule without the floor.
 */
const BUDGET_MS = {
  // Samples measured 16 to 40 ms; the first asc and desc clicks are cold, painting
  // the busy state inside the click while the pass continues across frames.
  sort: 200,
  // Baseline 32 to 40 ms; 3x is under the 200 ms floor.
  coldSort: 200,
  // 3x a 420 ms baseline (387 to 528 ms); the pass runs across frames, so this
  // is time to result, not input delay.
  sortSettled: 1300,
  // Baseline 16 ms; 3x is under the 200 ms floor.
  nextPage: 200,
  // Baseline 32 ms; 3x is under the 200 ms floor.
  pageSize: 200,
  // Baseline 24 ms; 3x is under the 200 ms floor.
  keystroke: 200,
  // Debounce plus 3x the 23 ms of work in a 173 ms baseline; the wall-clock
  // debounce is not scaled.
  searchResults: 250,
};

interface EventSample {
  name: string;
  duration: number;
}

interface FrameSample {
  duration: number;
  blockingDuration: number;
  invoker: string | null;
}

interface Drained {
  events: EventSample[];
  frames: FrameSample[];
}

interface ProbeWindow {
  latencyProbe: { drain(): Drained };
}

// lib.dom has no long-animation-frame types yet.
interface ScriptTiming {
  invoker: string;
  duration: number;
}
interface FrameTiming extends PerformanceEntry {
  blockingDuration: number;
  scripts: ScriptTiming[];
}

interface Sample {
  eventMs: number;
  frameMs: number | null;
  frameBlockingMs: number | null;
  frameInvoker: string | null;
}

/** Runs in the page before any script, so it is serialized and closes over nothing. */
function installProbe(floorMs: number): void {
  const events: EventSample[] = [];
  const frames: FrameSample[] = [];
  const keepEvents = (list: PerformanceEntryList) => {
    for (const entry of list as PerformanceEventTiming[]) {
      if (entry.interactionId > 0) {
        events.push({ name: entry.name, duration: entry.duration });
      }
    }
  };
  const keepFrames = (list: PerformanceEntryList) => {
    for (const entry of list as FrameTiming[]) {
      const longest = entry.scripts.reduce<ScriptTiming | null>(
        (worst, script) =>
          !worst || script.duration > worst.duration ? script : worst,
        null,
      );
      frames.push({
        duration: entry.duration,
        blockingDuration: entry.blockingDuration,
        invoker: longest ? longest.invoker : null,
      });
    }
  };

  const eventObserver = new PerformanceObserver((list) =>
    keepEvents(list.getEntries()),
  );
  // lib.dom lacks durationThreshold.
  const eventOptions: PerformanceObserverInit & { durationThreshold: number } =
    { type: "event", buffered: true, durationThreshold: floorMs };
  eventObserver.observe(eventOptions);

  const frameObserver = PerformanceObserver.supportedEntryTypes.includes(
    "long-animation-frame",
  )
    ? new PerformanceObserver((list) => keepFrames(list.getEntries()))
    : null;
  frameObserver?.observe({ type: "long-animation-frame", buffered: true });

  (window as unknown as ProbeWindow).latencyProbe = {
    drain() {
      keepEvents(eventObserver.takeRecords());
      if (frameObserver) keepFrames(frameObserver.takeRecords());
      return { events: events.splice(0), frames: frames.splice(0) };
    },
  };
}

/** The element at the midpoint of a sorted copy. */
function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

/**
 * Entries arrive once the frame is presented, which can trail the visible
 * outcome by several frames, so the probe is drained for up to this long.
 */
const ENTRY_SETTLE_MS = 250;

/** Drains the probe per frame until the settle time passes, or an event entry arrives when `untilEvent`. */
function collect(page: Page, untilEvent: boolean): Promise<Drained> {
  return page.evaluate(
    ({ settleMs, untilEvent }) =>
      new Promise<Drained>((resolve) => {
        const probe = (window as unknown as ProbeWindow).latencyProbe;
        const drained: Drained = { events: [], frames: [] };
        const start = performance.now();
        const poll = () => {
          const { events, frames } = probe.drain();
          drained.events.push(...events);
          drained.frames.push(...frames);
          const done =
            (untilEvent && drained.events.length > 0) ||
            performance.now() - start >= settleMs;
          if (done) resolve(drained);
          else requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }),
    { settleMs: ENTRY_SETTLE_MS, untilEvent },
  );
}

/** Measures one real interaction; `act` performs it and waits for its visible outcome. */
async function measure(page: Page, act: () => Promise<void>): Promise<Sample> {
  // Lets a prior interaction's late entries land, then discards them.
  await collect(page, false);
  await act();
  const { events, frames } = await collect(page, true);
  const longest = frames.reduce<FrameSample | null>(
    (worst, frame) =>
      !worst || frame.duration > worst.duration ? frame : worst,
    null,
  );
  return {
    eventMs: Math.max(0, ...events.map((entry) => entry.duration)),
    frameMs: longest ? longest.duration : null,
    frameBlockingMs: longest ? longest.blockingDuration : null,
    frameInvoker: longest ? longest.invoker : null,
  };
}

/** Prints one JSON line, attaches it to the report, then gates the median on its budget. */
function report(
  testInfo: TestInfo,
  metric: keyof typeof BUDGET_MS,
  samples: number[],
  frames: Omit<Sample, "eventMs">[],
): void {
  const budget = BUDGET_MS[metric];
  const result = {
    metric,
    median: median(samples),
    budget,
    samples,
    frames: frames.map(({ frameMs, frameBlockingMs, frameInvoker }) => ({
      frameMs,
      frameBlockingMs,
      frameInvoker,
    })),
  };
  const line = JSON.stringify(result);
  testInfo.annotations.push({ type: "latency", description: line });
  console.log(line);
  // Soft, so every metric in a test still reports when one misses.
  expect
    .soft(result.median, `${metric} median over its ${budget} ms budget`)
    .toBeLessThanOrEqual(budget);
}

/** One DevTools session per test, shared by beforeEach and the body, so the rate set last is the only one in force. */
const test = base.extend<{ session: CDPSession }>({
  session: async ({ page }, provide) => {
    await provide(await page.context().newCDPSession(page));
  },
});

/** Loads the cities page at full speed and slows the processor only once the dataset is ready, so the parse does not eat the timeout. */
async function openThrottled(page: Page, session: CDPSession): Promise<void> {
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.goto("/");
  await expect(page.getByRole("table")).toHaveAccessibleName(FULL_CAPTION, {
    timeout: DATASET_READY_TIMEOUT_MS,
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
}

test.beforeEach(async ({ page, session }) => {
  await page.addInitScript(installProbe, EVENT_TIMING_FLOOR_MS);
  await openThrottled(page, session);
});

test("sorting the whole dataset by City", async ({ page }, testInfo) => {
  const cityButton = page.getByRole("button", { name: "City", exact: true });
  const samples: Sample[] = [];

  for (let run = 0; run < REPEATS; run++) {
    samples.push(
      await measure(page, async () => {
        await cityButton.click();
        await expect(page).toHaveURL("/?sort=name");
        // A cold sort settles across frames; the next click must not land mid-pass.
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      }),
    );
    samples.push(
      await measure(page, async () => {
        await cityButton.click();
        await expect(page).toHaveURL("/?sort=-name");
        // A cold sort settles across frames; the next click must not land mid-pass.
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      }),
    );
    await cityButton.click();
    await expect(page).toHaveURL("/");
  }

  const eventMs = samples.map((sample) => sample.eventMs);
  report(testInfo, "sort", eventMs, samples);
});

test("a cold sort of the whole dataset by City", async ({
  page,
  session,
}, testInfo) => {
  const cityButton = page.getByRole("button", { name: "City", exact: true });
  const clicks: Sample[] = [];
  const settled: number[] = [];

  for (let run = 0; run < REPEATS; run++) {
    // The order cache is module scope, so each cold click needs a new document.
    if (run > 0) await openThrottled(page, session);
    let elapsed = 0;
    clicks.push(
      await measure(page, async () => {
        await page.evaluate(() =>
          window.addEventListener(
            "pointerdown",
            (event) => Reflect.set(window, "sortClickAt", event.timeStamp),
            { capture: true, once: true },
          ),
        );
        await cityButton.click();
        // Click to the sorted rows on screen, which Event Timing cannot see past the busy paint.
        elapsed = await page.evaluate(
          (caption) =>
            new Promise<number>((resolve) => {
              const poll = () => {
                if (
                  document.querySelector("caption")?.textContent === caption &&
                  !document.querySelector('[aria-busy="true"]')
                ) {
                  resolve(
                    Math.round(
                      performance.now() -
                        Number(Reflect.get(window, "sortClickAt")),
                    ),
                  );
                } else {
                  requestAnimationFrame(poll);
                }
              };
              poll();
            }),
          SORTED_CAPTION,
        );
        await expect(page).toHaveURL("/?sort=name");
      }),
    );
    settled.push(elapsed);
  }

  const eventMs = clicks.map((sample) => sample.eventMs);
  report(testInfo, "coldSort", eventMs, clicks);
  report(testInfo, "sortSettled", settled, clicks);
  // A cold click renders a busy table over the whole dataset, measured 32 to 40 ms,
  // so a zero means a dead probe.
  for (const ms of eventMs) {
    expect(
      ms,
      "the observer recorded nothing for a cold full-dataset sort",
    ).toBeGreaterThan(0);
  }
});

test("moving to the next page", async ({ page }, testInfo) => {
  const nextButton = page.getByRole("button", { name: "Go to next page" });
  const samples: Sample[] = [];

  for (let run = 1; run <= REPEATS; run++) {
    samples.push(
      await measure(page, async () => {
        await nextButton.click();
        await expect(page).toHaveURL(`/?page=${run + 1}`);
      }),
    );
  }

  report(
    testInfo,
    "nextPage",
    samples.map((sample) => sample.eventMs),
    samples,
  );
});

test("changing the page size to 100", async ({ page }, testInfo) => {
  const pageSize = page.getByLabel("Per page:");
  // Real keys, because Event Timing ignores the synthetic events selectOption sends.
  await pageSize.focus();
  const samples: Sample[] = [];

  for (let run = 0; run < REPEATS; run++) {
    samples.push(
      await measure(page, async () => {
        await page.keyboard.press("End");
        await expect(pageSize).toHaveValue("100");
        await expect(page).toHaveURL("/?size=100");
      }),
    );
    await page.keyboard.press("Home");
    await expect(page).toHaveURL("/");
  }

  report(
    testInfo,
    "pageSize",
    samples.map((sample) => sample.eventMs),
    samples,
  );
});

test("searching the whole dataset", async ({ page }, testInfo) => {
  const table = page.getByRole("table");
  const searchBox = page.getByRole("textbox", { name: "Search" });
  const keystrokes: Sample[] = [];
  const results: number[] = [];
  const resultFrames: Sample[] = [];

  const reset = async () => {
    await searchBox.fill("");
    await expect(table).toHaveAccessibleName(FULL_CAPTION);
  };

  for (let run = 0; run < REPEATS; run++) {
    keystrokes.push(
      await measure(page, async () => {
        await searchBox.pressSequentially(SEARCH_TERM);
        await expect(table).toHaveAccessibleName(SEARCH_CAPTION);
      }),
    );
    await reset();

    // Input to settled results, which Event Timing cannot see past the debounce.
    let elapsed = 0;
    const frame = await measure(page, async () => {
      elapsed = await searchBox.evaluate((input: HTMLInputElement, term) => {
        const caption = () => document.querySelector("caption")?.textContent;
        const before = caption();
        const start = performance.now();
        // The prototype setter, so React's value tracker sees the change.
        Reflect.set(HTMLInputElement.prototype, "value", term, input);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return new Promise<number>((resolve) => {
          const poll = () => {
            if (
              caption() !== before &&
              !document.querySelector('[aria-busy="true"]')
            ) {
              resolve(Math.round(performance.now() - start));
            } else {
              requestAnimationFrame(poll);
            }
          };
          poll();
        });
      }, SEARCH_TERM);
      await expect(table).toHaveAccessibleName(SEARCH_CAPTION);
    });
    results.push(elapsed);
    resultFrames.push(frame);
    await reset();
  }

  report(
    testInfo,
    "keystroke",
    keystrokes.map((sample) => sample.eventMs),
    keystrokes,
  );
  report(testInfo, "searchResults", results, resultFrames);
  expect(Math.min(...results)).toBeGreaterThanOrEqual(SEARCH_DEBOUNCE_MS);
});
