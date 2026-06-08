/**
 * @monbolc/lowcode-designer — misc helpers (Phase B ali-mirror)
 *
 * Ali-faithful port of
 * `alibaba/lowcode-engine/packages/designer/src/utils/misc.ts`.
 * Three helpers ali uses from `designer/` and `builtin-simulator/`:
 *
 * - `isElementNode(domNode)` — true if the DOM node is an Element
 *   (excludes text nodes, comments).
 * - `isDOMNodeVisible(domNode, viewport)` — true if ANY part of
 *   the node is inside the viewport content bounds. Ali uses this
 *   to skip rendering or scroll-into-view for offscreen nodes.
 *   Sapu's slim `Viewport` class already has `contentBounds` (P3).
 * - `normalizeTriggers(triggers)` — uppercases an array of
 *   keyboard / mouse trigger names. Ali uses this to dedupe
 *   and normalize setter `triggers` props.
 *
 * The 4th helper in ali's `misc.ts` — `makeEventsHandler` —
 * is a cross-frame helper for the iframe simulator. Sapu has
 * no iframe simulator (Phase A scope decision: skip cross-frame
 * coord normalization). Drop the helper; if a future plugin
 * needs the same surface, port it then.
 */
import { Viewport } from '../viewport';

export function isElementNode(domNode: Element): boolean {
  return domNode.nodeType === Node.ELEMENT_NODE;
}

export function isDOMNodeVisible(domNode: Element, viewport: Viewport): boolean {
  const r = domNode.getBoundingClientRect();
  const { width, height } = viewport.contentBounds;
  const { left, right, top, bottom, width: nodeWidth, height: nodeHeight } = r;
  return (
    left >= -nodeWidth &&
    top >= -nodeHeight &&
    bottom <= height + nodeHeight &&
    right <= width + nodeWidth
  );
}

export function normalizeTriggers(triggers: string[]): string[] {
  return triggers.map((trigger: string) => trigger?.toUpperCase());
}
