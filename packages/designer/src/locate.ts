/**
 * @monbolc/lowcode-designer — locate math
 *
 * Pure functions for computing drop-target geometry. The DOM
 * interaction lives in the sensor (BuiltinSimulatorHost); this
 * module only knows about rectangles and distances.
 *
 * Ported from alibaba/lowcode-engine v1.3.2's
 * `builtin-simulator/host.ts#locate` (lines 1189-1381) — same
 * three-mode algorithm:
 *
 *   1. **point-in-rect** — pointer is INSIDE a child → use that child.
 *   2. **nearest child by Euclidean distance** — pointer is in the
 *      "no man's land" between children → pick the closest.
 *   3. **edge-snap** — pointer is closer to the container's top /
 *      bottom edge than to any child → snap to start or end of
 *      children.
 *
 * Plus `isChildInline` / `isRowContainer` to detect flex / grid
 * layouts and switch the insert axis (V vs H). Without this,
 * dropping between items in a `flex-direction: row` container
 * always lands "above" them instead of "to the left of".
 *
 * Everything in this file is pure: no DOM, no events, no
 * closures. Inputs are `Rect` objects + child nodes; outputs
 * are `IPublicTypeLocation`. Unit-testable in happy-dom without
 * a real browser.
 */

import type { IPublicTypeLocation, IPublicTypeNodeLike } from '@monbolc/lowcode-types';

// ---------- Rect primitives ----------

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const Rect = {
  contains(outer: Rect, x: number, y: number): boolean {
    return (
      x >= outer.x &&
      x <= outer.x + outer.width &&
      y >= outer.y &&
      y <= outer.y + outer.height
    );
  },
  distance(x: number, y: number, r: Rect): number {
    // 0 if the point is inside the rect; otherwise the Euclidean
    // distance to the closest edge / corner.
    if (Rect.contains(r, x, y)) return 0;
    const dx = Math.max(r.x - x, 0, x - (r.x + r.width));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.height));
    return Math.hypot(dx, dy);
  },
  /** Per-edge distance. `top` = vertical distance to the rect's top edge, etc. */
  distanceToEdges(x: number, y: number, r: Rect): { top: number; bottom: number; left: number; right: number } {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    return {
      top: Math.abs(y - r.y),
      bottom: Math.abs(y - (r.y + r.height)),
      left: Math.abs(x - r.x),
      right: Math.abs(x - (r.x + r.width)),
    };
  },
  isPointInRect(x: number, y: number, r: Rect): boolean {
    return Rect.contains(r, x, y);
  },
};

// ---------- Insert math ----------

/**
 * The "axis" of insertion. `'H'` (horizontal) means the children
 * stack left-to-right (or the container is a row flex / grid) —
 * inserts land between children on the horizontal axis. `'V'`
 * (vertical, the default) means children stack top-to-bottom
 * (block layout) — inserts land between children on the vertical
 * axis.
 */
export type InsertAxis = 'H' | 'V';

/** A child candidate for the locate algorithm. */
export interface LocateChild<TNode extends IPublicTypeNodeLike> {
  readonly node: TNode;
  readonly rect: Rect;
  /** Whether the child renders inline (e.g. `display: inline`,
   *  `span`, flex item in a row). Used to pick the insert axis
   *  when the container's own layout is ambiguous. */
  readonly inline?: boolean;
}

export interface LocateOptions<TNode extends IPublicTypeNodeLike> {
  /** Pointer position (canvas-local coords). */
  readonly pointer: { readonly x: number; readonly y: number };
  /** The container node (the one whose children we're dropping into). */
  readonly container: TNode;
  /** The container's bounding rect in the same coord space as `pointer`. */
  readonly containerRect: Rect;
  /** The container's existing children, each with its bounding rect. */
  readonly children: readonly LocateChild<TNode>[];
  /** Whether the container is a row flex / grid (defaults to `false`). */
  readonly rowContainer?: boolean;
  /**
   * Optional override: insert inside the container as a child of
   * the container itself (no specific index). `null` lets the
   * algorithm pick an index. `true` forces the `Self` detail.
   */
  readonly forceInside?: boolean;
}

/**
 * Run the three-mode locate algorithm and return a `Location`.
 *
 * The function is total: it always returns a `Location` (never
 * `null`) — the caller decides whether the container is a valid
 * drop target (via `handleAccept`).
 */
export function computeInsertLocation<TNode extends IPublicTypeNodeLike>(
  opts: LocateOptions<TNode>,
): IPublicTypeLocation<TNode> {
  const { pointer, container, containerRect, children } = opts;

  // Empty container: drop inside as the first child.
  if (children.length === 0 || opts.forceInside) {
    return {
      target: container,
      detail: { type: 'Self' },
    };
  }

  // Determine insert axis. Inline children or a row container → 'H';
  // otherwise 'V' (block layout, the common case).
  const axis: InsertAxis =
    opts.rowContainer || children.some((c) => c.inline) ? 'H' : 'V';

  // Walk children, tracking the nearest one + the min distance.
  let nearChild: LocateChild<TNode> | null = null;
  let nearIndex = -1;
  let minDistance = Infinity;
  let insideChild: LocateChild<TNode> | null = null;

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const d = Rect.distance(pointer.x, pointer.y, child.rect);

    if (d === 0) {
      // Point is INSIDE this child → short-circuit, use it directly.
      insideChild = child;
      break;
    }
    if (d < minDistance) {
      minDistance = d;
      nearChild = child;
      nearIndex = i;
    }
  }

  if (insideChild) {
    return {
      target: insideChild.node,
      detail: { type: 'Self' },
    };
  }

  // No point-in-rect hit → use the nearest child.
  if (nearChild && nearIndex >= 0) {
    const pos = isNearAfter(pointer, nearChild.rect, axis);
    return {
      target: container,
      detail: {
        type: 'Children',
        index: pos === 'after' ? nearIndex + 1 : nearIndex,
        near: { node: nearChild.node, pos },
        edge: { rect: containerRect, align: axis === 'H' ? 'H' : 'V' },
      },
    };
  }

  // Shouldn't reach here (we'd have returned earlier), but fall
  // through safely: drop at the end of children.
  return {
    target: container,
    detail: { type: 'Children', index: children.length },
  };
}

/**
 * Decide whether a drop should land AFTER the given child rect
 * (rather than BEFORE it), based on which half of the rect the
 * pointer is closer to.
 *
 * For `'V'` axis: pointer below the rect's vertical midpoint → after.
 * For `'H'` axis: pointer right of the rect's horizontal midpoint → after.
 */
function isNearAfter(
  pointer: { readonly x: number; readonly y: number },
  rect: Rect,
  axis: InsertAxis,
): 'before' | 'after' {
  if (axis === 'V') {
    const midY = rect.y + rect.height / 2;
    return pointer.y > midY ? 'after' : 'before';
  }
  // 'H' (row)
  const midX = rect.x + rect.width / 2;
  return pointer.x > midX ? 'after' : 'before';
}
