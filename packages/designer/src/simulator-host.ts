/**
 * @monbolc/lowcode-designer — BuiltinSimulatorHost
 *
 * Wires the canvas DOM to the Dragon state machine. Listens for
 * `pointerdown` / `pointermove` / `pointerup` on the canvas, feeds
 * the Dragon the current pointer + computed drop target, and on a
 * successful commit dispatches the right `DocumentModel` mutation
 * (insert for boost, move for move-mode).
 *
 * **v2.3 changes** (from the slim v2.2 version):
 *   - `computeDropTarget` now delegates to `computeInsertLocation`
 *     (the three-mode algorithm: point-in-rect / nearest / edge-snap
 *     + inline/row axis detection). Ali-faithful.
 *   - `handleDown` skips `pointerdown` on form-event targets
 *     (`<input>`, `<textarea>`, `<select>`) and on any element
 *     matching `customizeIgnoreSelectors` (defaults to `.next-*`,
 *     `.editor-container`).
 *   - `registerAsSensor(dragon)` wires the host into the new
 *     instrumented Dragon API as a `IPublicTypeSensor<Node>`. The
 *     old manual API (start/move/commit) still works for back-compat.
 *   - Owns a `Viewport` (bounds math) + a `Scroller` (auto-scroll
 *     when the pointer is near the canvas edge).
 *
 * The drop-target math lives in `./locate.ts`; this file is
 * glue + DOM listeners + the insert / move side effects.
 */

import type { Project } from './project';
import type { DropTarget, Dragon } from './dragon';
import { getHitInfo } from './dom';
import { computeInsertLocation, type LocateChild } from './locate';
import { Viewport } from './viewport';
import { Scroller } from './scroller';
import type {
  IPublicTypeBoostMeta,
  IPublicTypeDragObject,
  IPublicTypeLocateEvent,
  IPublicTypeLocation,
  IPublicTypeNodeLike,
  IPublicTypeSensor,
  IPublicTypeNodeSchema,
  JSONValue,
} from '@monbolc/lowcode-types';

export interface SimulatorHostOptions {
  /** The canvas container — same element the simulator renders into. */
  canvas: HTMLElement;
  /** Drop event hook. Called once per successful commit. */
  onDrop?: (info: { kind: 'move' | 'boost'; target: DropTarget; meta?: IPublicTypeBoostMeta; nodeId?: string }) => void;
  /**
   * If true, ignore drops that would target the same parent+index
   * the dragged node is already at. Default true — avoids the
   * "drag a node where it already is" footgun.
   */
  noOpOnSameSpot?: boolean;
  /**
   * CSS selectors to ignore on click (don't select the node when
   * the user clicks an element matching one of these). Ali's
   * defaults: `.next-*`, `.editor-container`. Sapu keeps the same
   * defaults so plugins written for ali work out of the box.
   */
  customizeIgnoreSelectors?: string[];
}

/** Tags that should NOT trigger a node selection on pointerdown.
 *  These are form controls whose native UX is independent of the
 *  design surface. */
const FORM_EVENT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

const DEFAULT_IGNORE_SELECTORS = ['.next-*', '.editor-container'];

/** Pointer-move distance (in CSS px) above which a canvas
 *  `pointerdown` is treated as the start of a drag (move mode) rather
 *  than a click that selects the node. 4px matches the Dragon's
 *  shake gate (same value, different layer). */
const DRAG_START_THRESHOLD = 4;

export class BuiltinSimulatorHost {
  private readonly canvas: HTMLElement;
  private readonly project: Project;
  private readonly onDrop?: SimulatorHostOptions['onDrop'];
  private readonly noOpOnSameSpot: boolean;
  private readonly ignoreSelectors: string[];
  private bound = false;
  // DOM listeners
  private readonly onDown = (e: PointerEvent) => this.handleDown(e);
  private readonly onMove = (e: PointerEvent) => this.handleMove(e);
  private readonly onUp = (e: PointerEvent) => this.handleUp(e);
  // Click-vs-drag tracking
  private pendingClick: { id: string; x: number; y: number } | null = null;
  // Viewport + scroller (new in v2.3)
  readonly viewport: Viewport;
  private readonly scroller: Scroller;

  constructor(project: Project, options: SimulatorHostOptions) {
    this.project = project;
    this.canvas = options.canvas;
    this.onDrop = options.onDrop;
    this.noOpOnSameSpot = options.noOpOnSameSpot ?? true;
    this.ignoreSelectors = options.customizeIgnoreSelectors ?? DEFAULT_IGNORE_SELECTORS;
    this.viewport = new Viewport({ canvas: options.canvas });
    this.scroller = new Scroller({ viewport: this.viewport });
  }

  /** Attach DOM listeners. Idempotent. */
  mount(): void {
    if (this.bound) return;
    this.bound = true;
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    // Use window-level pointerup so a drop outside the canvas still
    // commits (the ghost might have drifted out).
    window.addEventListener('pointerup', this.onUp);
  }

  /** Detach DOM listeners. Call on editor unmount. */
  unmount(): void {
    if (!this.bound) return;
    this.bound = false;
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.pendingClick = null;
    this.scroller.cancel();
  }

  // ==========================================================================
  // Drop target computation
  // ==========================================================================

  /**
   * Compute a DropTarget for the given pointer position. Exposed
   * publicly so the canvas can preview the drop indicator on each
   * move. Pure — no Dragon interaction.
   *
   * v2.3 algorithm: **thirds decide parent vs inside** at the
   * top level; **`computeInsertLocation` decides the index** only
   * for the inside case. Why this split?
   *
   *   - For the sibling (before/after) decision, the pointer is
   *     necessarily INSIDE the hit's rect — so feeding
   *     `computeInsertLocation` the hit's own children
   *     short-circuits to "Self on hit" and we lose the
   *     before/after info.
   *   - The "thirds on the hit's rect" heuristic (top → before,
   *     middle → inside, bottom → after) is the conventional
   *     designer UX and matches ali's `IPublicTypeLocation`
   *     detail semantics.
   *   - For the index inside the container we DO want the
   *     full three-mode algorithm (point-in-rect, nearest,
   *     edge-snap, plus inline/row axis) — that's where
   *     `computeInsertLocation` earns its keep.
   */
  computeDropTarget(x: number, y: number): DropTarget | null {
    const root = this.project.document.root;
    const hit = getHitInfo(this.canvas, x, y);
    if (!hit.hitId) {
      // Empty canvas → append to root.
      const rootChildren = root.children ?? [];
      return { parentId: null, index: rootChildren.length, placement: 'inside' };
    }
    const hitNode = this.project.document.getNode(hit.hitId);
    if (!hitNode) return null;
    const hitRect = this._rectForNode(hitNode.id);
    if (!hitRect) return null;

    // Top-level decision: thirds on the hit's own rect.
    const relY = y - hitRect.top;
    const topThird = hitRect.height / 3;
    const bottomThird = (hitRect.height * 2) / 3;

    if (this._isInCenterBand(y, hitRect) && (hitNode.schema.children ?? []).length > 0) {
      // Drop INSIDE the hit. Use the three-mode algorithm to pick
      // the index among the hit's children.
      const hitChildren = (hitNode.schema.children ?? []) as IPublicTypeNodeSchema[];
      const children = this._buildLocateChildren(hitChildren);
      const loc = computeInsertLocation<IPublicTypeNodeLike>({
        pointer: { x, y },
        container: hitNode.schema as IPublicTypeNodeLike,
        containerRect: hitRect,
        children,
      });
      return this._locationToDropTarget(loc, hitNode.id);
    }

    // Drop as a SIBLING of the hit. Thirds → before / after index.
    const parent = hitNode.parent;
    const parentId = parent?.id ?? null;
    // Locate the hit's index within its parent's children (siblings).
    const siblings = parent
      ? parent.children
      : (root.children ?? []).map((c) => ({ id: (c.key as string) ?? '', schema: c }));
    const hitIdx = siblings.findIndex((s: { id: string }) => s.id === hitNode.id);
    if (hitIdx < 0) return null;
    if (relY < topThird) {
      return { parentId, index: hitIdx, placement: 'before' };
    }
    if (relY > bottomThird) {
      return { parentId, index: hitIdx + 1, placement: 'after' };
    }
    // Exact centre (rare with pointer events, but the spec leaves
    // it in): default to "before" the hit. Center-band + empty
    // children falls through here too, so defaulting to before is
    // the same as a sibling-drop near the top.
    return { parentId, index: hitIdx, placement: 'before' };
  }

  /** Translate an `IPublicTypeLocation` to the legacy `DropTarget` shape.
   *
   * For `Self`: drop INTO the target as a child. The index is the
   * current child count of the target (i.e. append at the end).
   * This matches the user expectation: clicking the centre of an
   * empty area inside a container should land the new node at
   * the bottom of that container's children, not at index 0
   * (which would push existing children down).
   */
  private _locationToDropTarget(
    loc: ReturnType<typeof computeInsertLocation>,
    fallbackParentId: string | null,
  ): DropTarget {
    if (loc.detail.type === 'Self') {
      const targetId = loc.target?.id ?? fallbackParentId;
      const childCount = this._childCountOf(targetId);
      return {
        parentId: targetId,
        index: childCount,
        placement: 'inside',
      };
    }
    return {
      parentId: loc.target?.id ?? fallbackParentId,
      index: loc.detail.index,
      placement: (loc.detail.near?.pos ?? 'before') as 'before' | 'after',
    };
  }

  /** Count the children of a node by id. The root is a schema
   *  (not a Node), so it falls back to the document's root schema. */
  private _childCountOf(id: string | null): number {
    if (!id) {
      return this.project.document.root.children?.length ?? 0;
    }
    const node = this.project.document.getNode(id);
    return node?.children?.length ?? 0;
  }

  private _isInCenterBand(y: number, rect: DOMRect): boolean {
    const centerY = rect.top + rect.height / 2;
    // Within 1/3 of the rect's height of the center → "inside" the hit.
    return Math.abs(y - centerY) < rect.height / 3;
  }

  private _rectForNode(nodeId: string): DOMRect | null {
    const el = this.canvas.querySelector(`[data-lce-id="${nodeId.replace(/"/g, '\\"')}"]`) as HTMLElement | null;
    return el ? el.getBoundingClientRect() : null;
  }

  private _buildLocateChildren(
    schemas: readonly IPublicTypeNodeSchema[],
  ): LocateChild<IPublicTypeNodeLike>[] {
    const out: LocateChild<IPublicTypeNodeLike>[] = [];
    for (const s of schemas) {
      if (!s.key) continue;
      const rect = this._rectForNode(s.key);
      if (!rect) continue;
      out.push({
        node: { id: s.key, componentName: s.componentName },
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      });
    }
    return out;
  }

  private _buildLocateChildrenFromNodes(
    nodes: ReadonlyArray<{ id: string; schema: IPublicTypeNodeSchema }>,
  ): LocateChild<IPublicTypeNodeLike>[] {
    const out: LocateChild<IPublicTypeNodeLike>[] = [];
    for (const n of nodes) {
      const rect = this._rectForNode(n.id);
      if (!rect) continue;
      out.push({
        node: { id: n.id, componentName: n.schema.componentName },
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      });
    }
    return out;
  }

  // ==========================================================================
  // Sensor adapter (v2.3 instrumented-mode bridge)
  // ==========================================================================

  /**
   * Register this host as a sensor on the given Dragon. After this
   * call, the Dragon's instrumented mode (`boost(dragObject, e)`)
   * will route per-tick locate events through this host's
   * `computeDropTarget` + `viewport` math.
   *
   * Returns the registered sensor (use the returned name to
   * `removeSensor` later, e.g. in `unmount()`).
   */
  registerAsSensor<TNode extends IPublicTypeNodeLike>(
    dragon: Dragon<TNode>,
  ): IPublicTypeSensor<TNode> {
    // The sensor's inner handlers need an explicit `TNode`-bound
    // `LocateEvent` type; without it TypeScript's contextual typing
    // collapses TNode to `unknown` and `dragon.addSensor` rejects
    // the value. We declare a local alias so the inline object
    // literal binds to TNode.
    type LEvent = IPublicTypeLocateEvent<TNode>;
    type Loc = IPublicTypeLocation<TNode>;
    const opaqueDrag: IPublicTypeDragObject<TNode> = { type: 'Any', extra: null };

    const sensor: IPublicTypeSensor<TNode> = {
      name: 'sapu.simulator-host',
      isEnter: (e: LEvent): boolean => {
        const r = this.viewport.bounds;
        return e.globalX >= r.left && e.globalX <= r.right && e.globalY >= r.top && e.globalY <= r.bottom;
      },
      fixEvent: (e: MouseEvent | DragEvent): LEvent => {
        // For the slim version, globalX/Y and canvasX/Y coincide
        // (sapu has no iframe simulator). If we later add one, this
        // is where the cross-iframe translation lives.
        return {
          globalX: e.clientX,
          globalY: e.clientY,
          canvasX: e.clientX,
          canvasY: e.clientY,
          clientX: e.clientX,
          clientY: e.clientY,
          target: e.target as Element | null,
          dragObject: opaqueDrag,
          originalEvent: e,
        };
      },
      locate: (_e: LEvent): Loc | null => {
        // The host's manual `dragon.move(x, y, target)` path
        // already drives the drop target; the sensor
        // just gates `isEnter`. The Dragon's instrumented
        // mode will fire `drag` events but the actual
        // drop geometry comes from the host.
        return null;
      },
    };
    dragon.addSensor(sensor);
    return sensor;
  }

  // ==========================================================================
  // DOM event handlers (manual mode — back-compat with v2.2 Dragon)
  // ==========================================================================

  private handleDown(e: PointerEvent): void {
    // If a drag (boost or move) is already in progress, don't
    // interfere. The existing drag owns the pointer until pointerup.
    if (this.project.dragon.isDragging) return;
    // Only respond to primary button. Right-click / middle-click /
    // pen barrel button all fall through.
    if (e.button !== 0) return;
    // v2.3: skip form-event targets so clicking an input inside
    // a custom component doesn't change selection.
    if (this._isFormEvent(e)) return;
    // v2.3: skip elements matching customizeIgnoreSelectors.
    if (this._isIgnored(e)) return;
    const hit = getHitInfo(this.canvas, e.clientX, e.clientY);
    if (!hit.hitId) {
      // Empty canvas — leave selection alone.
      this.pendingClick = null;
      return;
    }
    // v2.3.1: do NOT call `project.select(...)` here. The legacy
    // behavior was to select on pointerdown, but that meant a
    // user dragging a node saw it get selected mid-drag (and the
    // boost-from-palette path also "selected" whatever canvas
    // node happened to be under the pointer as the drag started).
    // Conventional UX (Figma / VS Code / Finder) defers the
    // selection to pointerup — a click without movement selects;
    // a click with movement becomes a drag, and the drag itself
    // decides the post-drop selection (move = no change, boost
    // = the freshly-inserted node). `handleUp` flushes the
    // pendingClick when no drag started.
    this.pendingClick = { id: hit.hitId, x: e.clientX, y: e.clientY };
  }

  private handleMove(e: PointerEvent): void {
    // v2.3: drive the auto-scroller when a drag is in progress.
    if (this.project.dragon.isDragging) {
      this.scroller.scrolling(e);
      const target = this.computeDropTarget(e.clientX, e.clientY);
      this.project.dragon.move(e.clientX, e.clientY, target);
      return;
    }
    // No active drag yet — promote a pending click past the threshold.
    const pending = this.pendingClick;
    if (!pending) return;
    const dx = e.clientX - pending.x;
    const dy = e.clientY - pending.y;
    if (dx * dx + dy * dy < DRAG_START_THRESHOLD * DRAG_START_THRESHOLD) {
      return;
    }
    this.pendingClick = null;
    this.project.dragon.start(pending.id, pending.x, pending.y);
    const target = this.computeDropTarget(pending.x, pending.y);
    this.project.dragon.move(pending.x, pending.y, target);
  }

  private handleUp(_e: PointerEvent): void {
    this.scroller.cancel();
    if (!this.project.dragon.isDragging) {
      // No drag started — this was a plain click on a canvas
      // node. Commit the deferred selection from `handleDown`.
      // (A click on empty canvas leaves `pendingClick === null`
      // and selection is preserved.)
      if (this.pendingClick) {
        this.project.select(this.pendingClick.id);
      }
      this.pendingClick = null;
      return;
    }
    const result = this.project.dragon.commit();
    if (!result) return;
    this.commitDrop(result);
  }

  private _isFormEvent(e: PointerEvent): boolean {
    const target = e.target as Element | null;
    if (!target) return false;
    return FORM_EVENT_TAGS.has(target.tagName);
  }

  private _isIgnored(e: PointerEvent): boolean {
    const target = e.target as Element | null;
    if (!target) return false;
    for (const sel of this.ignoreSelectors) {
      try {
        if (target.matches(sel)) return true;
        if (target.closest(sel)) return true;
      } catch {
        // ignore invalid selectors
      }
    }
    return false;
  }

  private commitDrop(
    result:
      | { kind: 'move'; nodeId: string; target: DropTarget }
      | { kind: 'boost'; meta: import('./dragon').BoostMeta; target: DropTarget },
  ): void {
    if (result.kind === 'move') {
      const node = this.project.document.getNode(result.nodeId);
      if (!node) return;
      const newParent = result.target.parentId
        ? this.project.document.getNode(result.target.parentId) ?? null
        : null;
      if (this.noOpOnSameSpot && node.parent?.id === result.target.parentId) {
        const curSiblings: Array<{ id: string }> = node.parent
          ? node.parent.children
          : (this.project.document.root.children ?? []).map((c) => ({ id: (c.key as string) ?? '' }));
        const curIdx = curSiblings.findIndex((c) => c.id === node.id);
        if (curIdx === result.target.index) return;
      }
      this.project.document.move(node, newParent, result.target.index);
      this.onDrop?.({ kind: 'move', target: result.target, nodeId: result.nodeId });
      return;
    }
    // Boost: create a new schema node (always with `props: {}` so
    // the settings panel has a stable target).
    const initialProps = result.meta.initialProps as Record<string, JSONValue> | undefined;
    const schema: IPublicTypeNodeSchema = {
      componentName: result.meta.componentName,
      props: { ...(initialProps ?? {}) },
    };
    const parent = result.target.parentId
      ? this.project.document.getNode(result.target.parentId) ?? null
      : null;
    const inserted = this.project.document.insert(schema, parent, result.target.index);
    this.onDrop?.({
      kind: 'boost',
      target: result.target,
      meta: { componentName: result.meta.componentName, initialProps },
    });
    this.project.select(inserted.id);
  }
}
