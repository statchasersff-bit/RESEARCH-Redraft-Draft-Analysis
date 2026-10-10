import { useCallback, useRef, useState } from "react";

// Measures the live width of a container element so the draft board can size its
// columns from real pixels (containerWidth / teams) instead of grid-cols-*.
//
// Uses a callback ref (not useEffect + useRef) so the ResizeObserver attaches the
// moment the node actually mounts. This matters because the consumer renders a
// loading skeleton first — the measured element isn't in the DOM on the initial
// mount, so an effect with [] deps would bail out and never re-run once the real
// board appears, leaving width stuck at 0.
export function useContainerWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(node);
    roRef.current = ro;
    setWidth(node.clientWidth);
  }, []);

  return { ref, width };
}
