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
