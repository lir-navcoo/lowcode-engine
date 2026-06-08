/**
 * @monbolc/lowcode-designer — DragResizeEngine
 *
 * Resize a node by dragging one of the 8 overlay handles
 * (nw / n / ne / e / se / s / sw / w). Pure DOM geometry: this
 * engine only mutates inline styles on the canvas DOM element
 * during the drag (so the user sees the rect grow/shrink in
 * real time) and, on `commit()`, writes the final
 * `width` / `height` (and, for NW/N/NE/W/SW anchors, `left` /
 * `top`) to the node's `props` so the change is durable.
 *
 * **v2.4 design**:
 *   - The Overlays component owns the visual handle divs. Each
 *     handle's `onPointerDown` calls `engine.start(id, anchor, e)`.
 *   - The engine binds `pointermove` + `pointerup` on `document`
 *     (one shared instance per drag), computes the new rect,
 *     and applies the inline style.
 *   - On `commit()`, the engine writes
 *     `{ width, height, left?, top? }` to the node's props
 *     through `DocumentModel.setProps`. The change is observable
 *     to the simulator's renderer (which re-renders with the new
 *     size on the next commit) and to the Settings panel.
 *   - On `cancel()` (ESC), the inline styles are reverted to
 *     their pre-drag values and the props are NOT touched.
 *
 * **Why inline styles during drag, props on commit**:
 *   Writing `setProps` on every `pointermove` would flood the
 *   document with mutations and trigger a re-render of the
 *   whole canvas per frame. Inline styles are cheap and only
 *   the final commit hits the schema. Ali does the same.
 *
 * **Why no document.move**:
 *   Resize is a STYLE change (px sizing), not a tree move.
 *   The node's `parent` and `children` are unchanged.
 *
 * **Minimum bounding box** (8px): an anchor can't drag the rect
 * below this size. Prevents accidental zero-sized widgets.
 */

import type { Project } from './project';
import type { Node } from './node';

export type ResizeAnchor = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const MIN_SIZE = 8; // px — minimum width / height after a resize

/** CSS props a resize may touch. `left` / `top` are only set by
 *  NW / N / NE / W / SW (the anchors that move the rect's origin
 *  in addition to resizing the opposite edge). */
interface ResizeResultStyle {
  width: number;
  height: number;
  left?: number;
  top?: number;
}

export interface DragResizeEngineOptions {
  readonly project: Project;
  /** The canvas container — used to find the node's DOM element
   *  via `[data-lce-id="${id}"]`. The engine never re-queries
   *  during a drag (the same element is reused). */
  readonly canvas: HTMLElement;
  /** Optional: a custom `setProps`-like function. Defaults to
   *  `project.document.setProps(node, patch)`. Exposed for
   *  tests so they can stub the commit side-effect. */
  readonly applyProps?: (node: Node, patch: Record<string, number>) => void;
}

export class DragResizeEngine {
  private readonly _project: Project;
  private readonly _canvas: HTMLElement;
  private readonly _applyProps: (node: Node, patch: Record<string, number>) => void;

  // Active drag state. `null` when idle.
  private _nodeId: string | null = null;
  private _anchor: ResizeAnchor | null = null;
  private _originX = 0;
  private _originY = 0;
  private _originStyle: ResizeResultStyle | null = null;
  /** Last computed preview. On commit, we use this directly
   *  (not a fresh `getBoundingClientRect`) so the patch matches
   *  the inline styles we just applied. happy-dom (and some
   *  browser edge cases) don't always reflect inline styles
   *  in `getBoundingClientRect` synchronously, so relying on
   *  it would be fragile. */
  private _lastPreview: ResizeResultStyle | null = null;
  private _boundMove: ((e: PointerEvent) => void) | null = null;
  private _boundUp: ((e: PointerEvent) => void) | null = null;
  private _boundKey: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: DragResizeEngineOptions) {
    this._project = options.project;
    this._canvas = options.canvas;
    this._applyProps = options.applyProps ?? defaultApplyProps(options.project);
  }

  get isResizing(): boolean {
    return this._nodeId !== null;
  }

  /**
   * Begin a resize. The engine grabs the node's current
   * rect, remembers which anchor, and binds `pointermove` /
   * `pointerup` on `document` so the drag continues even if
   * the pointer leaves the handle / the canvas. ESC cancels.
   */
  start(nodeId: string, anchor: ResizeAnchor, e: PointerEvent): void {
    if (this._nodeId) return; // already resizing — refuse nested
    const el = this._canvas.querySelector(`[data-lce-id="${cssEscape(nodeId)}"]`) as HTMLElement | null;
    if (!el) return;
    const node = this._project.document.getNode(nodeId);
    if (!node) return;
    const r = el.getBoundingClientRect();
    // Pre-drag inline style (or computed from the current rect).
    this._nodeId = nodeId;
    this._anchor = anchor;
    this._originX = e.clientX;
    this._originY = e.clientY;
    this._originStyle = {
      width: r.width,
      height: r.height,
      left: r.left - this._canvas.getBoundingClientRect().left,
      top: r.top - this._canvas.getBoundingClientRect().top,
    };
    this._boundMove = (ev) => this._onMove(ev);
    this._boundUp = (ev) => this._onUp(ev);
    this._boundKey = (ev) => this._onKey(ev);
    document.addEventListener('pointermove', this._boundMove);
    document.addEventListener('pointerup', this._boundUp);
    document.addEventListener('keydown', this._boundKey);
  }

  /**
   * Apply the current preview style (called internally on every
   * pointermove). Public for tests that want to skip the
   * event-binding dance.
   */
  preview(deltaX: number, deltaY: number): ResizeResultStyle | null {
    if (!this._originStyle || !this._anchor) return null;
    const next = computeResize(this._originStyle, this._anchor, deltaX, deltaY);
    return next;
  }

  /** Apply `preview` to the live DOM. Called by the internal
   *  pointermove handler; exposed for tests. */
  applyPreview(deltaX: number, deltaY: number): void {
    if (!this._nodeId) return;
    const el = this._canvas.querySelector(`[data-lce-id="${cssEscape(this._nodeId)}"]`) as HTMLElement | null;
    if (!el) return;
    const next = this.preview(deltaX, deltaY);
    if (!next) return;
    this._lastPreview = next;
    el.style.width = `${next.width}px`;
    el.style.height = `${next.height}px`;
    if (next.left !== undefined) el.style.left = `${next.left}px`;
    if (next.top !== undefined) el.style.top = `${next.top}px`;
  }

  /** Commit: write the final style to the node's props and
   *  clear the inline style. Idempotent — safe to call twice.
   *
   *  Uses the last computed preview (not a fresh DOM read) so
   *  the patch matches the inline styles we just applied. If
   *  `commit()` is called before any `applyPreview()` (e.g. a
   *  click without a move), the patch is the origin style —
   *  same as "no resize happened, props unchanged".
   */
  commit(): void {
    const nodeId = this._nodeId;
    if (!nodeId) return;
    const el = this._canvas.querySelector(`[data-lce-id="${cssEscape(nodeId)}"]`) as HTMLElement | null;
    if (el) {
      const node = this._project.document.getNode(nodeId);
      // Build the patch from the last preview (or the origin
      // style if no preview ran).
      const last = this._lastPreview ?? this._originStyle;
      const patch: Record<string, number> = {
        width: Math.round(last?.width ?? 0),
        height: Math.round(last?.height ?? 0),
      };
      if (last?.left !== undefined) patch.left = Math.round(last.left);
      if (last?.top !== undefined) patch.top = Math.round(last.top);
      if (node) {
        this._applyProps(node, patch);
      }
      // Clear the inline styles so the next render reads from
      // the props (the simulator re-renders the node with its
      // new width/height inline).
      el.style.width = '';
      el.style.height = '';
      if (Object.prototype.hasOwnProperty.call(patch, 'left')) el.style.left = '';
      if (Object.prototype.hasOwnProperty.call(patch, 'top')) el.style.top = '';
    }
    this._teardown();
  }

  /** Cancel: revert inline styles to pre-drag, don't touch props. */
  cancel(): void {
    if (!this._nodeId || !this._originStyle) {
      this._teardown();
      return;
    }
    const el = this._canvas.querySelector(`[data-lce-id="${cssEscape(this._nodeId)}"]`) as HTMLElement | null;
    if (el) {
      el.style.width = `${this._originStyle.width}px`;
      el.style.height = `${this._originStyle.height}px`;
      if (this._originStyle.left !== undefined) el.style.left = `${this._originStyle.left}px`;
      if (this._originStyle.top !== undefined) el.style.top = `${this._originStyle.top}px`;
    }
    this._teardown();
  }

  // ---------- internals ----------

  private _onMove(e: PointerEvent): void {
    if (!this._nodeId) return;
    this.applyPreview(e.clientX - this._originX, e.clientY - this._originY);
  }

  private _onUp(_e: PointerEvent): void {
    this.commit();
  }

  private _onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.cancel();
  }

  private _teardown(): void {
    if (this._boundMove) document.removeEventListener('pointermove', this._boundMove);
    if (this._boundUp) document.removeEventListener('pointerup', this._boundUp);
    if (this._boundKey) document.removeEventListener('keydown', this._boundKey);
    this._boundMove = null;
    this._boundUp = null;
    this._boundKey = null;
    this._nodeId = null;
    this._anchor = null;
    this._originStyle = null;
    this._lastPreview = null;
  }
}

// ---------- pure math ----------

/** Compute the new rect from the origin style + the anchor + the
 *  pointer delta. Pure function — easy to unit-test, mirrors
 *  ali's `drag-resize.ts` shape (one function, no closures). */
export function computeResize(
  origin: ResizeResultStyle,
  anchor: ResizeAnchor,
  dx: number,
  dy: number,
): ResizeResultStyle {
  // Edge-anchors: opposite edge stays put, dragged edge moves
  // by the delta. Width/height change. Origin (left/top) only
  // moves for NW/N/NE/W/SW.
  let { width, height, left, top } = origin;
  const moveLeft = left !== undefined;
  const moveTop = top !== undefined;

  switch (anchor) {
    case 'e':
      width = Math.max(MIN_SIZE, origin.width + dx);
      break;
    case 'w':
      width = Math.max(MIN_SIZE, origin.width - dx);
      if (moveLeft) left = (origin.left ?? 0) + (origin.width - width);
      break;
    case 's':
      height = Math.max(MIN_SIZE, origin.height + dy);
      break;
    case 'n':
      height = Math.max(MIN_SIZE, origin.height - dy);
      if (moveTop) top = (origin.top ?? 0) + (origin.height - height);
      break;
    case 'se':
      width = Math.max(MIN_SIZE, origin.width + dx);
      height = Math.max(MIN_SIZE, origin.height + dy);
      break;
    case 'sw':
      width = Math.max(MIN_SIZE, origin.width - dx);
      height = Math.max(MIN_SIZE, origin.height + dy);
      if (moveLeft) left = (origin.left ?? 0) + (origin.width - width);
      break;
    case 'ne':
      width = Math.max(MIN_SIZE, origin.width + dx);
      height = Math.max(MIN_SIZE, origin.height - dy);
      if (moveTop) top = (origin.top ?? 0) + (origin.height - height);
      break;
    case 'nw':
      width = Math.max(MIN_SIZE, origin.width - dx);
      height = Math.max(MIN_SIZE, origin.height - dy);
      if (moveLeft) left = (origin.left ?? 0) + (origin.width - width);
      if (moveTop) top = (origin.top ?? 0) + (origin.height - height);
      break;
  }

  const result: ResizeResultStyle = { width, height };
  if (moveLeft) result.left = left;
  if (moveTop) result.top = top;
  return result;
}

// ---------- helpers ----------

function defaultApplyProps(project: Project) {
  return (node: Node, patch: Record<string, number>): void => {
    project.document.setProps(node, patch as unknown as Record<string, import('@monbolc/lowcode-types').JSONValue>);
  };
}

function patchContains(patch: Record<string, number>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(patch, key);
}

function cssEscape(s: string): string {
  // Browser has CSS.escape; happy-dom in tests doesn't always.
  // Use it when present, fall back to a minimal escape that
  // handles the common case (double-quote + backslash).
  const esc = (globalThis as { CSS?: { escape(s: string): string } }).CSS?.escape;
  if (esc) return esc(s);
  return s.replace(/"/g, '\\"');
}
