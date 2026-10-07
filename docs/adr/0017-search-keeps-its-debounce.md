# 17. The search keeps its debounce

Status: accepted
Date recorded: 2026-10-07

## Context

The search commits a term 150 ms after the last keystroke. `DatasetView` holds what is in the box, and `useDebouncedCallback` delays the one commit that moves the view state.

React 19.3.0 changed how transitions render. Its changelog says "Transitions now render independently instead of being entangled into a single render, so a slow transition no longer holds up unrelated ones." So it was worth measuring whether a concurrent primitive could do the debounce's job better.

Deferring every keystroke, with `useDeferredValue` or a `startTransition` per key, was never a candidate. The search is not derived during render. Each commit runs the fetch effect, a filter over 50,250 rows outside render, an address write and a results announcement, and React can neither interrupt nor drop any of them. Safari also throws once a page makes more than 100 history calls in 30 seconds, and the guard around `replaceState` would swallow that error and leave the address behind.

The measured alternative kept the debounce and ran the commit as a transition. Wrapping the commit alone changes nothing for the result, because the rows arrive after an `await`, and an update after an `await` is no longer part of the transition that started it. The alternative wrapped every dispatch after the `await` as well: the rows, the failure and the settle. Wrapping only the rows would let the settle commit first, clearing the busy flag while the previous rows are still on screen, and the live region would announce their stale count.

## Decision

Keep the debounce as it is.

The two versions were compared over 20 runs of the latency spec against production builds, alternating between them, 10 runs each. Each run takes the median of five repeats with the processor slowed four times. The rule was written down before the first run: adopt the transitions only if their median total long-animation-frame blocking while typing at 200 ms a key falls below the debounce's first quartile, and no other metric's median rises above the debounce's third quartile. A tie goes to the shorter code.

That blocking was 0 ms in every run of both versions, so typing produced no long animation frame either way. The slowest key event was 24 ms in both, at 50 and 200 ms a key. Two metrics moved, both against the transitions:

| Metric                                   | Debounce, median (quartiles) | Transitions, median (quartiles) |
| ---------------------------------------- | ---------------------------- | ------------------------------- |
| Last key to settled results, 50 ms a key | 176.5 ms (176 to 178.8)      | 186 ms (175.5 to 186.8)         |
| Committed search to rendered results     | 171.5 ms (171 to 172)        | 176.5 ms (174.3 to 182.3)       |

For every other metric, the transitions' median stayed inside the debounce's quartiles.

`useDebouncedCallback` stays a root export of the package. Removing it is a breaking change and needs a decision of its own.

## Consequences

No search code changes. The 150 ms delay now has a record and numbers behind it.

The typing metrics stay in the latency spec with their budgets, so the next change to the search path is measured the same way.

The filter still runs on the main thread when a term commits, and no transition can yield across it. That cost is the same in both versions, so the transitions had nothing to win here.

Revisit when the search becomes render-derived, with the dataset loaded once and filtered during render. Then the work is a deferred search term over that filter, measured against these numbers.
