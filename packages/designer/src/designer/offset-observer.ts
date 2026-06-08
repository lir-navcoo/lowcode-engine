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

import { Emitter, type EventMap, uid, type Observable } from '@monbolc/lowcode-utils';
// ric-shim is a no-op in non-DOM test envs; safe to import.
// No types are shipped, so we declare the surface we use.
declare const requestIdleCallback: (cb: () => void) => number;
declare const cancelIdleCallback: (id: number) => void;

export interface OffsetObserverEvents extends EventMap {
  /** Fired when `hasOffset` flips, or when any of `height/width/top/left/bottom` changes. */
  change: { hasOffset: boolean };
}

/** Minimal viewport contract (slim; ali's is larger).
 *
 * Phase C.Y: each numeric field can be a plain getter (slim
 * consumers) OR an ali-faithful `Observable<number>`-backed
 * getter on a real `Viewport` (Phase C.Y).
 *
 * Phase C.AA: the optional `*Obs` accessors let the OffsetObserver
 * AUTO-SUBSCRIBE to viewport changes (re-compute on scroll / scale
 * / scrolling-state transitions) instead of polling. A slim
 * consumer (a test mock) can omit these — the OffsetObserver
 * degrades gracefully to "compute once at construction".
 */
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
  /** Phase C.AA: optional Observable accessors. When present
   *  (ali-faithful `Viewport` instances expose all four), the
   *  OffsetObserver subscribes to their `change` events and
   *  re-fires `_compute()` on transition. Slim consumers (test
   *  mocks, plain-object viewports) leave them out. */
  readonly scaleObs?: Observable<number>;
  readonly scrollXObs?: Observable<number>;
  readonly scrollYObs?: Observable<number>;
  readonly scrollingObs?: Observable<boolean>;
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
      // Phase C.AA: still subscribe so re-renders fire on viewport
      // changes (e.g. canvas resize). The root observer's geometry
      // is viewport-derived; the subscribers re-fire _compute which
      // re-reads _refreshFromViewport.
      this._subscribeViewport();
      return;
    }
    if (!this._rectProvider) return;
    this._compute();
    if (typeof requestIdleCallback === 'function') {
      this._pid = requestIdleCallback(() => this._compute());
    }
    // Phase C.AA: subscribe AFTER the initial compute so we don't
    // double-fire on the constructor. The subscription path
    // re-fires on every viewport change from now on.
    this._subscribeViewport();
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

  /** Phase C.AA: auto-subscribe to viewport observables. When
   *  the viewport exposes any `*Obs` accessor, attach a `change`
   *  listener that re-fires `_compute()`. Returns the disposer
   *  list so `purge()` (or the test) can detach cleanly.
   *
   *  The subscription handler does NOT just call `_compute()`
   *  (which has a no-op gate that suppresses `change` events
   *  when the rect values didn't change). The viewport scale
   *  change can leave the rect values identical but change
   *  the CONSUMER's view (via the `width * scale` getter) —
   *  so we always emit `change` on a viewport transition.
   *
   *  Idempotent: a 2nd call replaces the previous list.
   *  Ali-faithful: ali's OffsetObserver also subscribes to the
   *  viewport observables (via MobX) — sapu mirrors the
   *  behavior with the Phase A `Observable-lite` Emitter. */
  private _viewportDisposers: Array<() => void> = [];
  private _subscribeViewport(): void {
    if (!this._viewport) return;
    // Detach any previous subscriptions (in case _subscribeViewport
    // is called twice — defensive against host misuse).
    this._detachViewportSubs();
    const onViewportChange = (): void => {
      // Re-run the compute so the cached rect values stay fresh
      // (relevant for non-root observers that scale by viewport.scale).
      // For ROOT observers, `_compute` has no rect to read — it
      // still emits once if the rectProvider has been wired (the
      // constructor set `_hasOffset = true` for root, so the
      // no-op gate fires on the first call). To avoid the double-
      // emit, root observers re-emit directly without `_compute`.
      if (this._isRoot) {
        this.events.emit('change', { hasOffset: this._hasOffset });
      } else {
        this._compute();
        this.events.emit('change', { hasOffset: this._hasOffset });
      }
    };
    const v = this._viewport;
    if (v.scaleObs) this._viewportDisposers.push(v.scaleObs.events.on('change', onViewportChange));
    if (v.scrollXObs) this._viewportDisposers.push(v.scrollXObs.events.on('change', onViewportChange));
    if (v.scrollYObs) this._viewportDisposers.push(v.scrollYObs.events.on('change', onViewportChange));
    if (v.scrollingObs) this._viewportDisposers.push(v.scrollingObs.events.on('change', onViewportChange));
  }
  private _detachViewportSubs(): void {
    for (const d of this._viewportDisposers) d();
    this._viewportDisposers = [];
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
    // Phase C.AA: also detach the viewport Observable subscriptions
    // so a purge'd observer stops reacting to scroll/scale changes.
    this._detachViewportSubs();
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
