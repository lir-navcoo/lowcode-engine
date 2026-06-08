/**
 * @monbolc/lowcode-designer — OffsetObserver (Phase B ali-mirror)
 *
 * Ali-faithful port of
 * `alibaba/lowcode-engine/packages/designer/src/designer/offset-observer.ts`.
 * Tracks a single DOM node's `getBoundingClientRect()` in the
 * background using `requestIdleCallback` (ali uses `ric-shim` for
 * cross-browser support; sapu's package.json already has it).
 *
 * Sapu's slim design: NO MobX decorators. All mutable fields are
 * plain class fields; the public getters return live values. The
 * class emits a `change` event when `hasOffset` flips or the
 * geometry updates, so a React component (Phase D) can subscribe
 * via the `observerHOC` to re-render.
 *
 * Why Phase B (not D): the OffsetObserver has NO React, NO
 * bem-tool machinery — it's a plain class + Emitter + DOM
 * reads. It belongs in Phase B's pure-helper bucket. Phase D's
 * bem-tool files will USE this class.
 *
 * The ali port omits a few ali-only fields that depend on the
 * ali DocumentModel's `computeComponentInstanceRect`. Sapu's
 * `BuiltinSimulatorHost.computeComponentInstanceRect` ships in
 * Phase C. For now (Phase B), the OffsetObserver accepts a
 * `rectProvider: () => DOMRect | null` callback that the host
 * wires in Phase C. The default provider is `null` (no rect
 * available → `hasOffset=false`).
 */

import { Emitter, type EventMap, uid } from '@monbolc/lowcode-utils';
// ric-shim is a no-op in non-DOM test envs; safe to import.
// No types are shipped, so we declare the surface we use.
declare const requestIdleCallback: (cb: () => void) => number;
declare const cancelIdleCallback: (id: number) => void;

export interface OffsetObserverEvents extends EventMap {
  /** Fired when `hasOffset` flips, or when any of `height/width/top/left/bottom` changes. */
  change: { hasOffset: boolean };
}

/** Minimal viewport contract (slim; ali's is larger).
 *  Phase C.Y: each numeric field can be a plain getter (slim
 *  consumers) OR an ali-faithful `Observable<number>`-backed
 *  getter on a real `Viewport`. The OffsetObserver reads these
 *  once per `_compute()` call; consumers that want to react to
 *  scroll/scale changes can subscribe via the `*Obs` accessors
 *  on the concrete `Viewport` class. */
export interface IViewportLite {
  readonly width: number;
  readonly height: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly scale: number;
  /** Ali-faithful: `true` while the scroll target is actively
   *  scrolling (any cause: user drag, `scrollBy`, `scrollTo`).
   *  Auto-resets 80ms after the last `scroll` event. We use
   *  it to skip geometry refreshes during scroll. */
  readonly scrolling: boolean;
}

/** Per-instance descriptor. Ali-faithful shape. */
export interface NodeInstanceRef {
  /** Unique id for the logical node (the rendered instances
   *  all share the same node id). */
  readonly nodeId: string;
  /** Ali-faithful: `instance` is the per-render counter. */
  readonly instance?: unknown;
}

export class OffsetObserver {
  readonly id: string;
  readonly events = new Emitter<OffsetObserverEvents>();
  readonly nodeInstance: NodeInstanceRef;

  // Plain class fields (no MobX). Ali-faithful names so Phase D
  // consumers can use the same code shape.
  private _height = 0;
  private _width = 0;
  private _left = 0;
  private _top = 0;
  private _right = 0;
  private _bottom = 0;
  private _hasOffset = false;
  private _pid: number | undefined;
  /** Ali-faithful: when the node IS the focus root, geometry
   *  tracks the viewport directly. */
  private readonly _isRoot: boolean;
  /** Ali-faithful. Sapu's slim default is `null` (host wires
   *  this in Phase C once `computeComponentInstanceRect` ships). */
  private readonly _viewport: IViewportLite | null;
  /** Provider for the live DOM rect. Ali's `host.computeComponentInstanceRect`
   *  is what we call here. Defaults to `null` (Phase C will wire). */
  private readonly _rectProvider: (() => DOMRect | null) | null;

  constructor(opts: {
    nodeInstance: NodeInstanceRef;
    isRoot?: boolean;
    viewport?: IViewportLite;
    rectProvider?: () => DOMRect | null;
  }) {
    this.id = uid('oobx');
    this.nodeInstance = opts.nodeInstance;
    this._isRoot = opts.isRoot ?? false;
    this._viewport = opts.viewport ?? null;
    this._rectProvider = opts.rectProvider ?? null;
    if (this._isRoot) {
      this._hasOffset = true;
      this._refreshFromViewport();
      // Fire a synthetic change so Phase D consumers re-render.
      this.events.emit('change', { hasOffset: true });
      return;
    }
    if (!this._rectProvider) return;
    this._compute();
    if (typeof requestIdleCallback === 'function') {
      this._pid = requestIdleCallback(() => this._compute());
    }
  }

  // ---- Ali-faithful public getters (no MobX, plain fields) ----
  get hasOffset(): boolean { return this._hasOffset; }
  get height(): number {
    return this._isRoot ? (this._viewport?.height ?? 0) : this._height * (this._viewport?.scale ?? 1);
  }
  get width(): number {
    return this._isRoot ? (this._viewport?.width ?? 0) : this._width * (this._viewport?.scale ?? 1);
  }
  get top(): number {
    return this._isRoot ? 0 : this._top * (this._viewport?.scale ?? 1);
  }
  get left(): number {
    return this._isRoot ? 0 : this._left * (this._viewport?.scale ?? 1);
  }
  get bottom(): number {
    return this._isRoot ? (this._viewport?.height ?? 0) : this._bottom * (this._viewport?.scale ?? 1);
  }
  get right(): number {
    return this._isRoot ? (this._viewport?.width ?? 0) : this._right * (this._viewport?.scale ?? 1);
  }

  /**
   * Ali-faithful: re-read the rect from the provider and update
   * the cached fields. Emits `change` if the rect is non-null
   * AND has changed since last read.
   *
   * The `_pid` guard ali uses: if the observer was `purge()`d
   * and a new one constructed, the old pid would race. We
   * increment `_pid` on each `compute()` call; if a stale `compute`
   * is queued via `requestIdleCallback`, it bails.
   */
  private _pidCounter = 0;
  private _compute(): void {
    if (!this._rectProvider) return;
    const myPid = ++this._pidCounter;
    const rect = this._rectProvider();
    if (myPid !== this._pidCounter) return; // stale
    if (!rect) {
      this._hasOffset = false;
      this.events.emit('change', { hasOffset: false });
      return;
    }
    const prev = { h: this._height, w: this._width, l: this._left, t: this._top, r: this._right, b: this._bottom, has: this._hasOffset };
    this._height = rect.height;
    this._width = rect.width;
    this._left = rect.left;
    this._top = rect.top;
    this._right = rect.right;
    this._bottom = rect.bottom;
    this._hasOffset = true;
    if (
      prev.h !== this._height || prev.w !== this._width ||
      prev.l !== this._left || prev.t !== this._top ||
      prev.r !== this._right || prev.b !== this._bottom ||
      !prev.has
    ) {
      this.events.emit('change', { hasOffset: true });
    }
  }

  private _refreshFromViewport(): void {
    if (!this._viewport) return;
    this._left = 0;
    this._top = 0;
    this._right = this._viewport.width;
    this._bottom = this._viewport.height;
  }

  /** Ali-faithful: cancel any pending idle callback. */
  purge(): void {
    if (this._pid) {
      cancelIdleCallback(this._pid);
      this._pid = undefined;
    }
  }

  isPurged(): boolean {
    return this._pid === undefined;
  }
}

/** Ali-faithful factory: returns null if no instance. */
export function createOffsetObserver(
  nodeInstance: NodeInstanceRef,
  opts?: { isRoot?: boolean; viewport?: IViewportLite; rectProvider?: () => DOMRect | null },
): OffsetObserver | null {
  if (!nodeInstance.instance) return null;
  return new OffsetObserver({ nodeInstance, ...opts });
}
