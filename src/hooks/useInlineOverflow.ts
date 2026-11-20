import { useEffect, useState } from "react";

/** True when the element is a sideways scroller and its content is wider. */
function scrollsInline(node: HTMLElement): boolean {
  const { overflowX } = getComputedStyle(node);
  const scrollable = overflowX === "auto" || overflowX === "scroll";
  return scrollable && node.scrollWidth > node.clientWidth;
}

/**
 * A callback ref and whether its element scrolls sideways, measured again
 * whenever the element or one of its children resizes. Stays false where
 * ResizeObserver is missing, such as in a jsdom test.
 */
export function useInlineOverflow(): readonly [
  (node: HTMLElement | null) => void,
  boolean,
] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  // The node last measured as scrolling, so a remounted one starts false.
  const [scrolling, setScrolling] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Null while nothing scrollable is mounted, such as during a load.
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      // Kept while focused, so losing the tab stop never drops focus to the body.
      const keep = scrollsInline(node) || document.activeElement === node;
      setScrolling(keep ? node : null);
    });
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => {
      observer.disconnect();
    };
  }, [node]);

  return [setNode, node !== null && scrolling === node];
}
