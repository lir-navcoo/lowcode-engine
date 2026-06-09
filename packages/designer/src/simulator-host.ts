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
import type { Node } from './node';
import { getHitInfo, findDOMNodes, type InstanceLike } from './dom';
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

/**
 * Ali-faithful component-instance type. Slim union:
 *   - `Element` — the common case (sapu's `data-lce-id`-tagged canvas)
 *   - `{ dom?: Element; element?: Element }` — for plugins/objects
 *     that wrap the DOM element under one of these keys.
 *
 * Phase D's bem-tool files will add React-fibre / synthetic-component
 * unwrapping (via a renderer abstraction). For Phase C, the slim
 * `InstanceLike` from `./dom` covers the drag/rect/border math.
 */
export type IPublicTypeComponentInstance = InstanceLike;

/**
 * Ali-faithful rect shape — a `DOMRect` augmented with the elements
 * the rect was computed from, plus a `computed` flag that's true
 * when the rect spans multiple disjoint sub-rects (union of instances).
 * `computeComponentInstanceRect` sets both.
 */
export type IPublicTypeRect = DOMRect & {
  elements?: Array<Element | Text>;
  computed?: boolean;
};

/** v2.4: per-component move hooks. Ali-faithful (`onMoveHook` +
 *  `onChildMoveHook` in `node.componentMeta.advanced.callbacks`).
 *  Sapu mirrors the JS-side registry shape: a map keyed by
 *  `componentName` whose values are the host's predicates.
 *
 *  - `onMoveHook(node)` returns false to lock the node against
 *    being moved/dropped. The drop is rejected.
 *  - `onChildMoveHook(node, parent)` returns false to lock the
 *    `parent` against accepting new children. Ali uses this for
 *    "static" container types (e.g. a list that shouldn't grow).
 */
export interface ComponentMoveHooks {
  onMoveHook?: (node: Node) => boolean;
  onChildMoveHook?: (node: Node, parent: Node) => boolean;
}

export interface SimulatorHostOptions {
  /** The canvas container — same element the simulator renders into. */
  canvas: HTMLElement;
  /** Drop event hook. Called once per successful commit. */
  onDrop?: (info: { kind: 'move' | 'boost'; target: DropTarget; meta?: IPublicTypeBoostMeta; nodeId?: string }) => void;
  /**
   * Phase D.I6: optional pre-built `bemToolsManager` (use the D.I2
   * `BemToolsManager` class). If absent, the slim host defaults to a
   * no-op manager (renders no custom bem-tools).
   */
  bemToolsManager?: { getAllBemTools: () => Array<{ name: string; item: React.ComponentType<{ host: BuiltinSimulatorHost }> }> };
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
  /**
   * v2.4: per-component move hooks. Map of `componentName →
   *  { onMoveHook, onChildMoveHook }`. Ali-faithful: a host
   *  that registers `onMoveHook: () => false` for a component
   *  makes it undraggable (component-meta.ts:213). Sapu accepts
   *  the same map shape; the host (or a plugin) populates it.
   */
  componentMeta?: Record<string, ComponentMoveHooks>;
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
  private readonly componentMeta: Record<string, ComponentMoveHooks>;
  private bound = false;
  // ==== Phase D.I6 bem-tool slots (additive) ====
  // The slim bem-tool files (BorderDetecting / BorderSelecting / etc.)
  // read these fields. Slim defaults: empty style + no class + no
  // device, no-op setProps / mountViewport / mountContentFrame, a
  // minimal `liveEditing.editing` flag, a `designer` slot exposing
  // `editor.eventBus` + `detecting` (use the existing slim Detecting
  // via `Project.designer.detecting` slot) + `bemToolsManager` (D.I2
  // BemToolsManager instance). Real device-mode + iframe-mode +
  // live-editing are Phase D.I6+ follow-ups.
  readonly designMode: 'design' | 'live' | 'preview' = 'design';
  readonly deviceStyle: { canvas?: React.CSSProperties; viewport?: React.CSSProperties } = {};
  readonly deviceClassName: string = '';
  readonly device: string | undefined = undefined;
  readonly liveEditing: { editing: boolean } = { editing: false };
  /** Alias for `project.document` (ali-faithful surface). */
  get currentDocument() { return this.project.document; }
  // Minimal `designer` slot mirroring the slim facade. The slim port
  // wires this in the constructor.
  readonly designer: {
    editor: { eventBus: { on: (...a: any[]) => any; off: (...a: any[]) => any; emit: (...a: any[]) => any } };
    detecting: { current: unknown };
    bemToolsManager: { getAllBemTools: () => Array<{ name: string; item: React.ComponentType<{ host: BuiltinSimulatorHost }> }> };
  };
  // DOM listeners
  private readonly onDown = (e: PointerEvent) => this.handleDown(e);
  private readonly onMove = (e: PointerEvent) => this.handleMove(e);
  private readonly onUp = (e: PointerEvent) => this.handleUp(e);
  // Click-vs-drag tracking
  private pendingClick: { id: string; x: number; y: number } | null = null;
  // Viewport + scroller (new in v2.3)
  readonly viewport: Viewport;
  private readonly scroller: Scroller;
  // Bound no-select listeners (v2.3.2: prevent text-selection on drag)
  private _boundAddNoSelect: (() => void) | null = null;
  private _boundRemoveNoSelect: (() => void) | null = null;
  private _noSelectCount = 0;
  // Phase C: per-node component-instance map. Sapu is single-document
  // per Project, so we drop ali's `docId` dimension and key the map
  // by `node.id` directly. Populated by `setInstance` (the simulator
  // calls it on every mount/unmount); read by `getComponentInstances`
  // + `computeComponentInstanceRect` + `DocumentModel.computeRect`.
  private readonly _instancesMap = new Map<string, IPublicTypeComponentInstance[]>();

  constructor(project: Project, options: SimulatorHostOptions) {
    this.project = project;
    this.canvas = options.canvas;
    this.onDrop = options.onDrop;
    this.noOpOnSameSpot = options.noOpOnSameSpot ?? true;
    this.ignoreSelectors = options.customizeIgnoreSelectors ?? DEFAULT_IGNORE_SELECTORS;
    this.componentMeta = options.componentMeta ?? {};
    this.viewport = new Viewport({ canvas: options.canvas });
    this.scroller = new Scroller({ viewport: this.viewport });
    // Phase D.I6: wire the `designer` slot. The slim `Project` exposes
    // `events` (the Emitter) + `setDetecting` / `getDetecting`; the
    // bem-tool files read `designer.detecting.current` (the currently
    // hovered node) and `designer.editor.eventBus`. Sapu doesn't have
    // an ali-faithful `Editor` class yet; the slim facade is a
    // structural slot ali-faithful enough for the bem-tool port.
    this.designer = {
      editor: {
        eventBus: {
          on: project.events.on.bind(project.events),
          off: project.events.off.bind(project.events),
          emit: project.events.emit.bind(project.events),
        },
      },
      detecting: {
        get current(): unknown {
          const id = project.getDetecting();
          if (!id) return null;
          return project.document.getNode(id) ?? null;
        },
      },
      bemToolsManager: options.bemToolsManager ?? { getAllBemTools: () => [] },
    } as BuiltinSimulatorHost['designer'];
    // Phase C: register this host as the document's `IDocumentModelHost`
    // so `document.computeRect(node)` / `getNodeInstancesRect(node)` route
    // through `getComponentInstances` + `computeComponentInstanceRect`.
    // Tests that construct a host get the wiring for free; the test for
    // `document.computeRect` swaps the host out via `setHost` to verify
    // the indirection works.
    project.document.setHost({
      getComponentInstances: (n) => this.getComponentInstances(n),
      computeComponentInstanceRect: (inst, sel) => this.computeComponentInstanceRect(inst as IPublicTypeComponentInstance, sel),
    });
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
    // v2.3.2: prevent text-selection-on-drag. While the Dragon
    // is dragging, set `user-select: none` on `documentElement`
    // so the browser doesn't accidentally select text in the
    // canvas / palette / outline as the user drags across them.
    // We listen to BOTH event sets (ali + v2.2-legacy) and use
    // a refcount to handle nested / overlapping events safely.
    const dEvents = this.project.dragon.events;
    this._boundAddNoSelect = () => this._addNoSelect();
    this._boundRemoveNoSelect = () => this._removeNoSelect();
    dEvents.on('dragstart', this._boundAddNoSelect);
    dEvents.on('start', this._boundAddNoSelect);
    dEvents.on('startBoost', this._boundAddNoSelect);
    dEvents.on('dragend', this._boundRemoveNoSelect);
    dEvents.on('drop', this._boundRemoveNoSelect);
    dEvents.on('cancel', this._boundRemoveNoSelect);
    dEvents.on('dropBoost', this._boundRemoveNoSelect);
    dEvents.on('cancelBoost', this._boundRemoveNoSelect);
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
    const dEvents = this.project.dragon.events;
    if (this._boundAddNoSelect) {
      dEvents.off('dragstart', this._boundAddNoSelect);
      dEvents.off('start', this._boundAddNoSelect);
      dEvents.off('startBoost', this._boundAddNoSelect);
    }
    if (this._boundRemoveNoSelect) {
      dEvents.off('dragend', this._boundRemoveNoSelect);
      dEvents.off('drop', this._boundRemoveNoSelect);
      dEvents.off('cancel', this._boundRemoveNoSelect);
      dEvents.off('dropBoost', this._boundRemoveNoSelect);
      dEvents.off('cancelBoost', this._boundRemoveNoSelect);
    }
    this._boundAddNoSelect = null;
    this._boundRemoveNoSelect = null;
    // Force-release the no-select: clear the inline styles,
    // remove the selectstart preventer, reset the refcount.
    const de = document.documentElement;
    const body = document.body;
    de.style.userSelect = '';
    (de.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = '';
    if (body) {
      body.style.userSelect = '';
      (body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = '';
    }
    document.removeEventListener('selectstart', this._onSelectStart, { capture: true });
    this._noSelectCount = 0;
  }

  // ==========================================================================
  // Phase C ali-mirror: per-node instance registry + rect computation
  // ==========================================================================
  //
  // Ali-faithful port of
  // `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/host.ts`:
  //   - `setInstance(docId, id, instances)`        → host.ts:907
  //   - `getComponentInstances(node, context?)`   → host.ts:921
  //   - `computeComponentInstanceRect(...)`       → host.ts:969
  //   - `findDOMNodes(instance, selector?)`       → host.ts:1035
  //
  // Sapu is single-document per Project, so the `docId` dimension
  // ali uses is dropped. The map is keyed by `node.id` directly.
  // The rect-union algorithm is ported verbatim — sapu uses real
  // `Element.getClientRects()` (no iframe contentDocument in slim),
  // so the slim `findDOMNodes` in `./dom.ts` is the unwrap step.

  /**
   * Register (or unregister) the DOM instance(s) for a node. Call
   * this on every mount/unmount so the host's rect math stays
   * accurate. Pass `null` to clear.
   *
   * Ali-faithful: the simulator calls this from the renderer
   * mount/unmount lifecycle. Sapu's slim version: the host (or a
   * test) calls it directly.
   */
  setInstance(nodeId: string, instances: IPublicTypeComponentInstance[] | null): void {
    if (instances == null) {
      this._instancesMap.delete(nodeId);
      return;
    }
    this._instancesMap.set(nodeId, instances.slice());
  }

  /**
   * Ali-faithful: return the per-instance list for a node, or
   * `null` if no instances are registered. The optional
   * `context` parameter (a `IPublicTypeNodeInstance` shape) is
   * ali-faithful for filtering; sapu's slim version accepts a
   * `{ nodeId?: string; instance?: unknown }` shape and returns
   * all matching instances.
   */
  getComponentInstances(
    node: Node,
    _context?: { nodeId?: string; instance?: unknown },
  ): IPublicTypeComponentInstance[] | null {
    const instances = this._instancesMap.get(node.id) ?? null;
    return instances ? instances.slice() : null;
  }

  /**
   * Ali-faithful: find the DOM elements backing an instance. Slim
   * version: unwraps `IPublicTypeComponentInstance` to a DOM Element
   * via `./dom.ts`'s `findDOMNodes`. Phase D's bem-tool files will
   * need React-fibre / synthetic-component unwrapping — that's
   * the only thing this stub doesn't cover.
   */
  findDOMNodes(
    instance: IPublicTypeComponentInstance,
    selector?: string,
  ): Array<Element | Text> | null {
    return findDOMNodes(instance, selector);
  }

  /**
   * Ali-faithful: compute the union rect for one component
   * instance. Walks all the instance's DOM elements + their
   * `getClientRects()` (which can be multiple for inline /
   * multi-line elements), returns the smallest rect that
   * contains them all. Sets `computed: true` when the union
   * spans more than one rect.
   *
   * Returns `null` when no DOM elements are found (the instance
   * is unmounted, or the renderer returned nothing).
   */
  computeComponentInstanceRect(
    instance: IPublicTypeComponentInstance,
    selector?: string,
  ): IPublicTypeRect | null {
    const elements = this.findDOMNodes(instance, selector);
    if (!elements || elements.length === 0) return null;

    // Ali-faithful union algorithm: pop elements + their
    // `getClientRects()` off a stack; for each rect, expand
    // the running `{x, y, r, b}` box. `computed: true` if the
    // box was ever expanded (i.e. the union is non-trivial).
    const elems = elements.slice();
    const rects: DOMRect[] = [];
    let last: { x: number; y: number; r: number; b: number } | undefined;
    let computed = false;
    while (true) {
      if (rects.length < 1) {
        const elem = elems.pop();
        if (!elem) break;
        // `getClientRects` is an Element method (TS DOM lib doesn't
        // expose it on Text). Text nodes' rects are subsumed by
        // their parent Element's rects, so skipping them is a
        // safe no-op for the union computation.
        if (elem instanceof Element) {
          const got = elem.getClientRects();
          for (let i = got.length - 1; i >= 0; i--) rects.push(got.item(i) as DOMRect);
        }
      }
      const rect = rects.pop();
      if (!rect) continue;
      if (rect.width === 0 && rect.height === 0) continue;
      if (!last) {
        last = { x: rect.left, y: rect.top, r: rect.right, b: rect.bottom };
        continue;
      }
      if (rect.left < last.x) { last.x = rect.left; computed = true; }
      if (rect.top < last.y) { last.y = rect.top; computed = true; }
      if (rect.right > last.r) { last.r = rect.right; computed = true; }
      if (rect.bottom > last.b) { last.b = rect.bottom; computed = true; }
    }
    if (!last) return null;
    const rect: IPublicTypeRect = new DOMRect(last.x, last.y, last.r - last.x, last.b - last.y);
    rect.elements = elements;
    rect.computed = computed;
    return rect;
  }

  /**
   * Convenience: clear all registered instances. Called by
   * `unmount()` (already done above) or by tests that swap
   * schemas. Not ali-faithful (ali does this via document
   * destruction); sapu exposes it for tests + the demo.
   */
  clearInstances(): void {
    this._instancesMap.clear();
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
    // P8.3: drop the parent's `isLocked` flag rejects drops into
    // the locked node OR any of its descendants. Ali's pattern
    // (host.ts line 1228): `getClosestNode(dropContainer?.container,
    // n => n.isLocked)` — same shape. We walk up the hit's
    // ancestors looking for any with `props.isLocked === true`.
    // Returns null so the Dragon emits `cancel` instead of `drop`.
    const hit = getHitInfo(this.canvas, x, y);
    if (!hit.hitId) {
      // Empty canvas → append to root. Walk root's ancestors
      // (root has none) — drop is allowed by default.
      const rootChildren = root.children ?? [];
      return { parentId: null, index: rootChildren.length, placement: 'inside' };
    }
    // P8.3: walk the hit's ancestor chain. If any ancestor has
    // `isLocked: true` in its props, reject the drop entirely.
    let cursor: Node | undefined | null = this.project.document.getNode(hit.hitId);
    while (cursor) {
      if (cursor.props.isLocked === true) {
        return null;
      }
      cursor = cursor.parent;
    }
    // P10.2: per-component move hooks. If the dragged node's
    // `onMoveHook` returns false, the drop is rejected (ali's
    // `component-meta.ts:213` default). Same shape for the
    // hit node's parent's `onChildMoveHook` — if it returns
    // false, the parent refuses to accept the drop. Both
    // checks are no-ops when the host didn't register any
    // hooks (the common case for the demo).
    const draggingId = this.project.dragon.state.draggingNodeId;
    if (draggingId) {
      const draggedNode = this.project.document.getNode(draggingId);
      if (draggedNode) {
        const meta = this.componentMeta[draggedNode.componentName];
        if (meta?.onMoveHook && !meta.onMoveHook(draggedNode)) {
          return null;
        }
      }
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
      // P10.2: when the drop lands inside the hit, the hit IS
      // the parent → check the hit's onChildMoveHook.
      const inside = this._locationToDropTarget(loc, hitNode.id);
      return this._applyChildMoveHook(inside, hitNode, hitNode);
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
      return this._applyChildMoveHook({ parentId, index: hitIdx, placement: 'before' }, parent, hitNode);
    }
    if (relY > bottomThird) {
      return this._applyChildMoveHook({ parentId, index: hitIdx + 1, placement: 'after' }, parent, hitNode);
    }
    // Exact centre (rare with pointer events, but the spec leaves
    // it in): default to "before" the hit. Center-band + empty
    // children falls through here too, so defaulting to before is
    // the same as a sibling-drop near the top.
    return this._applyChildMoveHook({ parentId, index: hitIdx, placement: 'before' }, parent, hitNode);
  }

  /**
   * P10.2: if the resolved drop target's parent has an
   * `onChildMoveHook` registered and it returns false for the
   * dragged node, reject the drop. Ali-faithful
   * (host.ts:1198-1204). The check is gated on the parent
   * having a `componentMeta` entry — most components don't,
   * so the check is a cheap no-op in the common case.
   */
  private _applyChildMoveHook(
    target: DropTarget,
    parent: Node | null,
    hitNode: Node,
  ): DropTarget | null {
    if (!parent) return target; // root → no parent to consult
    const meta = this.componentMeta[parent.componentName];
    if (!meta?.onChildMoveHook) return target;
    const draggingId = this.project.dragon.state.draggingNodeId;
    const dragged = draggingId ? this.project.document.getNode(draggingId) : null;
    if (!dragged) return target;
    if (!meta.onChildMoveHook(dragged, parent)) {
      return null;
    }
    // We touched the parent + hitNode only for the side-effect;
    // the parameter list keeps the lint-clean.
    void hitNode;
    return target;
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
    return this.getNodeRect(nodeId);
  }

  /**
   * Phase C.AC: ali-faithful multi-instance rect union. When a
   * component is rendered N times on the canvas (ali calls
   * these "instances" of a single Node), all N share the same
   * `data-lce-id`. The drop-target math needs the UNION of
   * their rects so the third / nearest / edge-snap algorithms
   * have the right geometric context.
   *
   * Sapu's slim `querySelector` returned only the FIRST
   * instance's first element — wrong for multi-instance cases
   * (e.g. 3 Sidebar nodes in a Dashboard layout, each rendered
   * to its own DOM container). This method uses
   * `querySelectorAll` + a per-rect union to compute the
   * bounding rect of ALL instances.
   *
   * Returns `null` when no instance is mounted (e.g. the node
   * was removed from the document but the drop math was still
   * pointing at it).
   *
   * Note: sapu has no iframe simulator, so we don't need
   * ali's `host.inIframe()` / `frame.contentDocument` check
   * that the multi-instance drop math does in ali.
   */
  getNodeRect(nodeId: string): DOMRect | null {
    // CSS.escape() is the standard way to escape arbitrary
    // characters in a CSS attribute value. happy-dom's
    // `querySelectorAll` accepts the CSS-escape sequences
    // (`\\`, `\\'`, etc.) consistently, unlike hand-rolled
    // `\"` / `\'` which are browser-only and rejected by
    // happy-dom. Ali-faithful: ali's port also uses CSS.escape
    // semantics in newer code paths; the slim sapu version
    // uses CSS.escape directly.
    const elements = Array.from(
      this.canvas.querySelectorAll(`[data-lce-id="${CSS.escape(nodeId)}"]`),
    ) as HTMLElement[];
    if (elements.length === 0) return null;
    // Single-instance fast path: just return the rect (no
    // per-rect union loop overhead).
    if (elements.length === 1) {
      const r = elements[0]!.getBoundingClientRect();
      return new DOMRect(r.left, r.top, r.width, r.height);
    }
    // Multi-instance union: walk every element's rect, expand
    // the running `{x, y, r, b}` box. Ali-faithful: same
    // algorithm as the rect-union in `computeComponentInstanceRect`,
    // but applied across DOM elements (not getClientRects).
    let minX = Infinity, minY = Infinity, maxR = -Infinity, maxB = -Infinity;
    for (const el of elements) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // skip collapsed
      if (r.left < minX) minX = r.left;
      if (r.top < minY) minY = r.top;
      if (r.right > maxR) maxR = r.right;
      if (r.bottom > maxB) maxB = r.bottom;
    }
    if (minX === Infinity) return null; // all collapsed
    return new DOMRect(minX, minY, maxR - minX, maxB - minY);
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
    // v2.3.2: arm the no-select IMMEDIATELY on pointerdown so the
    // first 4px of movement (the dragon's shake gate) doesn't let
    // the browser start a text selection. The Dragon's `start`
    // event fires later (in `handleMove` past the threshold) and
    // re-arms the no-select — the refcount stays balanced because
    // `handleUp` removes once and the Dragon's `drop` removes once.
    this._addNoSelect();
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
    // P8.2: forward the source PointerEvent so the Dragon reads
    // `altKey` / `ctrlKey` and sets `copy: true` on the
    // `dragstart` payload. Ali-faithful UX (alt-drag a node =
    // duplicate it instead of moving it).
    this.project.dragon.start(pending.id, pending.x, pending.y, e);
    const target = this.computeDropTarget(pending.x, pending.y);
    this.project.dragon.move(pending.x, pending.y, target);
  }

  private handleUp(_e: PointerEvent): void {
    this.scroller.cancel();
    // v2.3.2: clear the no-select on pointerup. If a drag
    // started, the Dragon's `drop` (or `cancel`) event will
    // also clear it — the refcount stays balanced (one add
    // from `handleDown`, one remove from `handleUp`, plus the
    // add/remove pair from the Dragon's start/drop events).
    this._removeNoSelect();
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

  /**
   * v2.3.2: add `user-select: none` (with `-webkit-` prefix for
   * older WebKit) to BOTH `documentElement` and `document.body`
   * while a drag is in progress. Some browsers honor the rule on
   * the root only, others on body only — setting both is the
   * cheapest cross-browser guarantee. Refcounted so overlapping
   * events (the `start` + `dragstart` pair in ali-mode, or
   * nested boosts) don't accidentally leave the no-select stuck.
   *
   * Belt-and-suspenders: also `preventDefault()` on `selectstart`
   * while the no-select is active. The CSS `user-select: none`
   * stops text-selection-from-pointer in most cases, but a
   * `selectstart` event can still fire in some browsers and lead
   * to a tiny selection range on a single line. preventDefault
   * is the only fully-reliable way to block it.
   */
  private _addNoSelect(): void {
    this._noSelectCount += 1;
    if (this._noSelectCount === 1) {
      const de = document.documentElement;
      const body = document.body;
      de.style.userSelect = 'none';
      (de.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
      if (body) {
        body.style.userSelect = 'none';
        (body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
      }
      document.addEventListener('selectstart', this._onSelectStart, { capture: true });
    }
  }

  private _removeNoSelect(): void {
    this._noSelectCount = Math.max(0, this._noSelectCount - 1);
    if (this._noSelectCount === 0) {
      const de = document.documentElement;
      const body = document.body;
      de.style.userSelect = '';
      (de.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = '';
      if (body) {
        body.style.userSelect = '';
        (body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = '';
      }
      document.removeEventListener('selectstart', this._onSelectStart, { capture: true });
    }
  }

  /** Bound `selectstart` preventer. Lives on `document` with
   *  `capture: true` so it fires BEFORE any element's own
   *  `selectstart` listener can react. */
  private readonly _onSelectStart = (e: Event): void => {
    e.preventDefault();
  };

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

  // ==== Phase D.I6: bem-tool / host-view no-op stubs ====
  // The slim bem-tool files (BorderDetecting etc.) + the slim
  // BuiltinSimulatorHostView (host-view.tsx) call these methods. Ali
  // used them to wire an iframe's contentDocument into the host;
  // sapu has no iframe simulator, so the slim port keeps the same
  // method shape (per audit: "future-proof; no-op for no-iframe").

  /** Phase D.I6 no-op: ali-faithful surface; slim has no iframe content frame. */
  mountContentFrame(_frame: HTMLIFrameElement | null): void {
    // Intentionally empty. The slim canvas is mounted directly in
    // the host's render, not inside an iframe.
  }

  /** Phase D.I6 no-op: ali-faithful surface; slim has no separate viewport mount. */
  mountViewport(_elmt: HTMLElement | null): void {
    // Intentionally empty. The slim viewport is derived from the
    // canvas itself via the Viewport class.
  }

  /** Phase D.I6 no-op: ali-faithful surface; slim doesn't apply props to the host at runtime. */
  setProps(_props: unknown): void {
    // Intentionally empty. The slim host is constructed once with its
    // root schema via `Project`; props are not re-applied.
  }
}
