/**
 * @monbolc/lowcode-designer — DOM utilities
 *
 * Helpers for measuring / querying the rendered DOM tree. These are
 * used by the Dragon (to compute drop targets) and the DesignerHost
 * (for selection / hover overlays).
 */

/** A rectangle with origin and size. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Get the bounding rect of an element, in viewport coordinates. */
export function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

/** Check whether two rects overlap (axis-aligned). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

/** Check whether `a` is fully contained within `b`. */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Return the midpoint of a rect. Useful for drag-drop sorting. */
export function rectMidpoint(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/**
 * Walk up the DOM tree to find the nearest ancestor with a
 * `data-lce-id` attribute. Returns the id, or null.
 */
export function findNodeIdFromElement(el: Element | null): string | null {
  let cur: Element | null = el;
  while (cur) {
    const id = cur.getAttribute('data-lce-id');
    if (id !== null) return id;
    cur = cur.parentElement;
  }
  return null;
}

/** Tag an element with the node id so we can find it again. */
export function tagElementWithNodeId(el: Element, id: string): void {
  el.setAttribute('data-lce-id', id);
}

/**
 * Hit test: given a point in viewport coords, return the
 * `data-lce-id` of the nearest ancestor of that point. Used by
 * Dragon to find the drop target. Returns null if no such element
 * exists within `container`.
 */
export function hitTest(container: Element, x: number, y: number): string | null {
  if (typeof document.elementsFromPoint !== 'function') return null;
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (!container.contains(el)) continue;
    const id = (el as Element).getAttribute?.('data-lce-id');
    if (id) return id;
  }
  return null;
}

/**
 * Compute a DropTarget from a hit-tested id and the pointer position.
 * The target's vertical position determines whether the drop is
 * 'before', 'after', or 'inside' the element.
 */
export interface HitInfo {
  /** id of the hit element, or null if no element found. */
  hitId: string | null;
  /** y-position relative to the hit element's bounding rect. */
  relativeY: number;
  /** height of the hit element. */
  height: number;
}

export function getHitInfo(
  container: Element,
  x: number,
  y: number,
): HitInfo {
  const hitId = hitTest(container, x, y);
  if (!hitId) return { hitId: null, relativeY: 0, height: 0 };
  const el = container.querySelector(`[data-lce-id="${CSS.escape(hitId)}"]`);
  if (!el) return { hitId: null, relativeY: 0, height: 0 };
  const r = el.getBoundingClientRect();
  return { hitId, relativeY: y - r.top, height: r.height };
}
