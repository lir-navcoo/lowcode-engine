/**
 * @monbolc/lowcode-editor-skeleton — UI Overlays
 *
 * Five visual feedback components for the design-mode canvas:
 *   - Border:             1px outline around the selected node(s)
 *   - Hover:              subtle blue tint on the hovered node
 *   - DragGhost:          ghost element that follows the cursor during drag
 *   - InsertionIndicator: horizontal line showing where a drop will land
 *   - ResizeHandles:      4 corner + 4 edge handles for the (first)
 *                         selected node (visual only in v2.3; drag
 *                         wiring ships in v2.4)
 *
 * All five read from Project + Dragon state. They mount as
 * absolutely-positioned siblings of the canvas.
 *
 * The borders are positioned via `getBoundingClientRect()`. We
 * can't read them inside a single useEffect and trust the result:
 * when the user drags a node to a new parent, the Skeleton's
 * document-change useEffect re-renders the simulator via
 * `root.render(...)` (a *separate* React root) AFTER our
 * useLayoutEffect has already run. Without a follow-up repaint
 * the border would stick on the old coordinates. The fix is a
 * `MutationObserver` on the canvas subtree: every time React
 * mounts/unmounts/moves a node, we re-read the rect and re-paint.
 * Observer callbacks are debounced into the next animation frame
 * so a flurry of mutations collapses to one repaint.
 */

import { useEffect } from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { Project } from '@monbolc/lowcode-designer';
import type { DropTarget } from '@monbolc/lowcode-designer';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface OverlaysProps {
  project: Project;
  /** The canvas container (used to position overlays relative to it). */
  canvasContainer: HTMLElement | null;
}

function tagSelector(id: string): string {
  return `[data-lce-id="${id.replace(/"/g, '\\"')}"]`;
}

/**
 * Border: render a 1px blue outline around the currently-selected
 * node(s). Done via DOM manipulation (not React) so we can render
 * overlays in a separate React tree. Tailwind utility classes drive
 * the styling; absolute position + dimensions are set inline because
 * they change per node.
 */
function renderBorders(canvas: HTMLElement, selectedIds: string[]): void {
  // Clear old borders
  canvas.querySelectorAll('.sapu-border-overlay').forEach((n) => n.remove());

  for (const id of selectedIds) {
    const el = canvas.querySelector(tagSelector(id)) as HTMLElement | null;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const canvasR = canvas.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className =
      'sapu-border-overlay absolute border-[1.5px] border-blue-500 rounded-sm pointer-events-none';
    overlay.style.left = `${r.left - canvasR.left - 1}px`;
    overlay.style.top = `${r.top - canvasR.top - 1}px`;
    overlay.style.width = `${r.width + 2}px`;
    overlay.style.height = `${r.height + 2}px`;
    overlay.style.zIndex = '9998';
    canvas.appendChild(overlay);
  }
}

/** Hover: light blue tint on the currently-hovered node. */
function renderHover(canvas: HTMLElement, hoverId: string | null): void {
  canvas.querySelectorAll('.sapu-hover-overlay').forEach((n) => n.remove());
  if (!hoverId) return;
  const el = canvas.querySelector(tagSelector(hoverId)) as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const canvasR = canvas.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = 'sapu-hover-overlay absolute bg-blue-500/[0.06] pointer-events-none';
  overlay.style.left = `${r.left - canvasR.left}px`;
  overlay.style.top = `${r.top - canvasR.top}px`;
  overlay.style.width = `${r.width}px`;
  overlay.style.height = `${r.height}px`;
  overlay.style.zIndex = '9997';
  canvas.appendChild(overlay);
}

/** DragGhost: a ghost element at the cursor position during a drag. */
function renderDragGhost(canvas: HTMLElement, x: number, y: number, label: string): void {
  let ghost = canvas.querySelector('.sapu-drag-ghost') as HTMLElement | null;
  if (!ghost) {
    ghost = document.createElement('div');
    ghost.className =
      'sapu-drag-ghost absolute px-2 py-1 bg-blue-500 text-white text-xs font-mono rounded ' +
      'shadow-md pointer-events-none';
    canvas.appendChild(ghost);
  }
  const canvasR = canvas.getBoundingClientRect();
  ghost.style.left = `${x - canvasR.left + 8}px`;
  ghost.style.top = `${y - canvasR.top + 8}px`;
  ghost.style.zIndex = '9999';
  ghost.textContent = label;
}

function clearDragGhost(canvas: HTMLElement): void {
  canvas.querySelectorAll('.sapu-drag-ghost').forEach((n) => n.remove());
}

/** InsertionIndicator: 2px blue line at the computed drop position.
 *
 * v2.3: real child-rect math instead of the v2.2 `index / total`
 * ratio. We look up the parent's DIRECT children, sort by their
 * DOM order (matches the schema's children order because the
 * renderer preserves order), and place the line at the midpoint
 * between the child at `target.index - 1` and the child at
 * `target.index` — or at the parent's top edge for index 0, or
 * at the parent's bottom edge for index === count.
 */
function renderInsertion(canvas: HTMLElement, target: DropTarget | null): void {
  canvas.querySelectorAll('.sapu-insertion-indicator').forEach((n) => n.remove());
  if (!target) return;
  // Resolve the parent element.
  const parent = target.parentId
    ? canvas.querySelector(tagSelector(target.parentId)) as HTMLElement | null
    : canvas; // root
  if (!parent) return;
  const parentR = parent.getBoundingClientRect();
  const canvasR = canvas.getBoundingClientRect();
  // Direct children that carry `data-lce-id` are the simulator's
  // own nodes; foreign children (e.g. wrapper divs from the host)
  // are ignored so the indicator only lands on real lce nodes.
  const allChildren = Array.from(parent.querySelectorAll(':scope > [data-lce-id]'));
  // Sort by DOM order (querySelectorAll already returns in order,
  // but be defensive in case a host uses a different insertion
  // path). `compareDocumentPosition` is the canonical DOM-order
  // comparator.
  allChildren.sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  // Compute the line's y. Three cases:
  //   (1) index 0     → parent top edge
  //   (2) index === n → parent bottom edge
  //   (3) otherwise   → midpoint between child[index-1] and child[index]
  let y: number;
  if (allChildren.length === 0) {
    y = parentR.top - canvasR.top + parentR.height / 2;
  } else if (target.index <= 0) {
    y = parentR.top - canvasR.top;
  } else if (target.index >= allChildren.length) {
    y = parentR.bottom - canvasR.top;
  } else {
    const prev = allChildren[target.index - 1]!.getBoundingClientRect();
    const next = allChildren[target.index]!.getBoundingClientRect();
    y = (prev.bottom + next.top) / 2 - canvasR.top;
  }

  const line = document.createElement('div');
  line.className = 'sapu-insertion-indicator absolute h-0.5 bg-blue-500 pointer-events-none';
  line.style.left = `${parentR.left - canvasR.left}px`;
  line.style.top = `${y - 1}px`;
  line.style.width = `${parentR.width}px`;
  line.style.zIndex = '9996';
  line.setAttribute('data-lce-index', String(target.index));
  line.setAttribute('data-lce-parent', target.parentId ?? 'root');
  canvas.appendChild(line);
}

/** ResizeHandle: 4 corner + 4 edge handles for the (first) selected
 *  node. Visual only in v2.3 — the drag wiring ships in a follow-up
 *  (the resize engine is in `designer/drag-resize.ts`, planned for
 *  v2.4). For now they prove the boundary is readable; the user
 *  can already resize by editing props in the Settings panel.
 */
function renderResizeHandles(canvas: HTMLElement, selectedIds: string[]): void {
  canvas.querySelectorAll('.sapu-resize-handle').forEach((n) => n.remove());
  if (selectedIds.length === 0) return;
  // Only show handles for the first selected node. Multi-select
  // resize is a v2.4 feature.
  const id = selectedIds[0]!;
  const el = canvas.querySelector(tagSelector(id)) as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const canvasR = canvas.getBoundingClientRect();
  const left = r.left - canvasR.left;
  const top = r.top - canvasR.top;
  const right = left + r.width;
  const bottom = top + r.height;
  const cx = left + r.width / 2;
  const cy = top + r.height / 2;
  // 8 anchor points: 4 corners + 4 edge midpoints.
  const anchors: { name: string; x: number; y: number }[] = [
    { name: 'nw', x: left,   y: top },
    { name: 'n',  x: cx,     y: top },
    { name: 'ne', x: right,  y: top },
    { name: 'e',  x: right,  y: cy },
    { name: 'se', x: right,  y: bottom },
    { name: 's',  x: cx,     y: bottom },
    { name: 'sw', x: left,   y: bottom },
    { name: 'w',  x: left,   y: cy },
  ];
  for (const a of anchors) {
    const handle = document.createElement('div');
    handle.className =
      'sapu-resize-handle absolute w-2 h-2 bg-white border border-blue-500 pointer-events-auto ' +
      'hover:bg-blue-100 data-[anchor=se]:cursor-se-resize';
    handle.style.left = `${a.x - 4}px`;
    handle.style.top = `${a.y - 4}px`;
    handle.style.zIndex = '9998';
    handle.setAttribute('data-lce-handle', a.name);
    handle.setAttribute('data-lce-target', id);
    canvas.appendChild(handle);
  }
}

/**
 * The Overlays component reads from project + dragon, then imperatively
 * renders the overlay divs. Itself returns null.
 */
export function Overlays(props: OverlaysProps) {
  // Build a single `repaint(canvas)` closure that's the one source
  // of truth for "draw the borders + the drag-ghost + the
  // insertion indicator based on current Project + Dragon state".
  // Multiple effects call it: the project/dragon effect for state
  // changes, a MutationObserver for React's commit reordering the
  // canvas children, and the scroll/resize effect at the bottom
  // for window events.
  //
  // The component returns null — it has no visual output of its
  // own; everything it draws is imperatively attached to the
  // canvas container. State subscriptions for "trigger a re-render"
  // are unnecessary: the repaint closure already reads
  // `props.project.selectedIds` and `props.project.dragon.state`
  // fresh on every invocation, so an external event just needs to
  // call repaint, not force a re-render.
  //
  // The MutationObserver path is the important one: when the user
  // drags a node to a new parent, the Skeleton's document-change
  // effect calls `root.render(...)` on the SEPARATE React root
  // that mounts the simulator. That commit happens AFTER our
  // useLayoutEffect runs (parent vs child effect order), so a
  // single useEffect-based repaint would read the OLD bounding
  // rect and leave the border stuck on the original spot. The
  // observer fires once React has actually moved the DOM node,
  // and the rAF debounce collapses the burst of mutations from
  // one commit to a single repaint.
  useEffect(() => {
    const canvas = props.canvasContainer;
    if (!canvas) return;

    let rafScheduled = false;
    const scheduleRepaint = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        repaint();
      });
    };

    const repaint = () => {
      renderBorders(canvas, props.project.selectedIds);
      renderResizeHandles(canvas, props.project.selectedIds);
      const ds = props.project.dragon.state;
      // Two drag modes share the same overlay:
      //   - move (draggingNodeId set)    → ghost shows `↔ ComponentName`
      //   - boost (boost set)           → ghost shows `+ ComponentName`
      // The v2.3 instrumented path fires `startBoost` immediately
      // on `boost(meta, x, y)` and `start` on `start(id, x, y)`,
      // so this branch is hit for palette drops too.
      if (ds.draggingNodeId) {
        const node = props.project.document.getNode(ds.draggingNodeId);
        const label = node ? `↔ ${node.componentName}` : '↔ ?';
        renderDragGhost(canvas, ds.x, ds.y, label);
        renderInsertion(canvas, ds.dropTarget);
      } else if (ds.boost) {
        renderDragGhost(canvas, ds.x, ds.y, `+ ${ds.boost.componentName}`);
        renderInsertion(canvas, ds.dropTarget);
      } else {
        clearDragGhost(canvas);
        renderInsertion(canvas, null);
      }
    };

    // Run once on mount so the border appears before any
    // mutation / scroll / drag event.
    repaint();

    // Watch the canvas subtree for any DOM mutation (child added /
    // removed / moved / attribute changed). React's commit phase
    // is what fires these; by the time the callback runs, the new
    // tree is in place and `getBoundingClientRect()` returns the
    // correct coordinates. The `subtree: true` option covers
    // descendants of the canvas (the simulator's nested elements),
    // so a re-order deep inside the tree still triggers a repaint.
    // `attributes: true` catches `data-lce-id` mutations if any
    // host re-tags nodes (rare, but cheap to track).
    const observer = new MutationObserver(scheduleRepaint);
    observer.observe(canvas, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-lce-id', 'style', 'class'],
    });

    // Scroll + resize: the canvas's overflow-auto parent scrolls
    // the simulator up/down; the border's getBoundingClientRect
    // result changes with scroll, so we re-paint on every
    // scroll tick. Window resize moves both canvas and selected
    // element together, but their relative offset is what the
    // border uses — that doesn't change with resize, so resize
    // alone isn't strictly necessary. We keep it for safety.
    const scrollables: Element[] = [];
    let el: Element | null = canvas.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      if (
        style.overflowY === 'auto' || style.overflowY === 'scroll' ||
        style.overflowX === 'auto' || style.overflowX === 'scroll'
      ) {
        scrollables.push(el);
      }
      el = el.parentElement;
    }
    scrollables.forEach((s) => s.addEventListener('scroll', scheduleRepaint, { passive: true }));
    window.addEventListener('resize', scheduleRepaint);

    // Project + Dragon events: any selection / document / drag
    // change requires a repaint. The mutation observer catches
    // DOM-level effects of document changes, but selection-only
    // changes (no DOM change) and Dragon state-only changes
    // (no DOM change yet) wouldn't otherwise trigger a repaint.
    // We subscribe to the same 9 events the previous `useRev`
    // hook did, but route them straight to `scheduleRepaint`
    // instead of bumping a React state counter — the repaint
    // closure reads live project + dragon state, so a re-render
    // would be wasted work.
    const ev = props.project.events;
    const dEv = props.project.dragon.events;
    // The Dragon emits 7 events; subscribe to ALL of them so the
    // overlay repaints on both move-mode AND boost-mode transitions.
    // The previous version of this file subscribed to a non-existent
    // `'end'` event (a holdover from a v1 API), which meant drag-end
    // repaints never fired — the ghost and insertion indicator would
    // stick around after a drop. P6.1 fixes that.
    const eventNames = [
      'selectionChanged', 'nodeMoved', 'nodeAdded', 'nodeRemoved',
    ] as const;
    const dragonEventNames = [
      // move-mode
      'start', 'move', 'drop', 'cancel',
      // boost-mode (palette → canvas)
      'startBoost', 'dropBoost', 'cancelBoost',
      // new instrumented API (v2.3)
      'dragstart', 'drag', 'dragend',
    ] as const;
    eventNames.forEach((n) => ev.on(n, scheduleRepaint));
    dragonEventNames.forEach((n) => dEv.on(n, scheduleRepaint));

    return () => {
      observer.disconnect();
      scrollables.forEach((s) => s.removeEventListener('scroll', scheduleRepaint));
      window.removeEventListener('resize', scheduleRepaint);
      eventNames.forEach((n) => ev.off(n, scheduleRepaint));
      dragonEventNames.forEach((n) => dEv.off(n, scheduleRepaint));
    };
  }, [props.canvasContainer, props.project]);

  return null;
}
