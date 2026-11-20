import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * The DOM environment implements no ResizeObserver and lays nothing out, so an
 * observer fires only when a test calls `resize` on an element it watches,
 * after setting the sizes it wants read.
 */
const watchers = new Map<Element, Set<() => void>>();

/** Fires every connected observer watching `target`, as a layout change would. */
export function resize(target: Element): void {
  act(() => {
    for (const callback of watchers.get(target) ?? []) callback();
  });
}

/** Installs the stub; `vi.unstubAllGlobals` removes it after each test. */
export function installResizeObserverStub(): void {
  watchers.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly #callback: () => void;
      readonly #targets = new Set<Element>();
      constructor(callback: () => void) {
        this.#callback = callback;
      }
      observe(target: Element) {
        this.#targets.add(target);
        const set = watchers.get(target) ?? new Set();
        set.add(this.#callback);
        watchers.set(target, set);
      }
      disconnect() {
        for (const target of this.#targets) {
          watchers.get(target)?.delete(this.#callback);
        }
        this.#targets.clear();
      }
    },
  );
}
