/**
 * @monbolc/lowcode-designer — Viewport
 *
 * Encapsulates the canvas's scroll + position math. The host
 * creates one per `mount()` and tears it down on `unmount()`.
 *
 * **Phase C.Y ali-mirror**: `scrollX`, `scrollY`, `scale`, and
 * `scrolling` are `Observable-lite` properties (Phase A's
 * `Observable<T>` from `@monbolc/lowcode-utils`). Ali uses
 * `@obx.ref` (MobX) for the same surface; sapu mirrors the
 * shape without MobX. The plain getters (`scale`, `scrollX`,
 * etc.) are kept for Phase B `IViewportLite` compat — they
 * return the current Observable value.
 *
 * The bem-tool files in Phase D (border-selecting,
 * border-detecting) and any plugin that wants to react to
 * viewport changes subscribe via the `*Obs` accessors and
 * re-render through the upcoming `observerHOC`. For
 * non-React consumers, `autorun` + the Emitter surface
 * give the same effect.
 *
 * Slim version of ali's `builtin-simulator/viewport.ts`:
 *   - `bounds` returns the canvas's viewport-relative rect.
 *   - `setScrollTarget` wires a scroll listener that auto-updates
 *     `scrollX` / `scrollY` / `scrolling` observables. Sapu doesn't
 *     have an iframe simulator (the canvas IS the viewport).
 *   - `toGlobalPoint` / `toLocalPoint` round-trip between
 *     canvas-local and global (viewport) coordinates.
 *   - `contentBounds` is scale-aware (consumed by `isDOMNodeVisible`
 *     in `utils/misc.ts`).
 */
import { Observable } from '@monbolc/lowcode-utils';

export interface ViewportOptions {
  /** The canvas element whose getBoundingClientRect drives bounds. */
  readonly canvas: HTMLElement;
}

export class Viewport {
  private readonly _canvas: HTMLElement;
  private _scrollTarget: Window | HTMLElement | null = null;
  /** Phase C.Y: ali-faithful `scale` as an `Observable<number>`.
   *  Default 1. Mutate via `setScale(s)` so subscribers re-fire. */
  private readonly _scale: Observable<number>;
  /** Phase C.Y: ali-faithful `scrollX` / `scrollY` (auto-synced
   *  from the scroll target's `scroll` event when set). */
  private readonly _scrollX: Observable<number>;
  private readonly _scrollY: Observable<number>;
  /** Phase C.Y: ali-faithful `scrolling` flag. `true` while the
   *  scroll target is actively scrolling (any cause: user drag,
 *  `scrollBy`, `scrollTo`). Auto-resets to `false` 80ms after
   *  the last `scroll` event (ali-faithful timeout). Subscribers
   *  (notably the Phase B `OffsetObserver`) use this to skip
   *  geometry refreshes during scroll. */
  private readonly _scrolling: Observable<boolean>;
  /** Ali-faithful: a 80ms timer that flips `_scrolling` back to
   *  `false` after the last `scroll` event. */
  private _scrollingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bound scroll listener (so `setScrollTarget` can remove it
   *  on swap; currently sapu only calls `setScrollTarget` once
   *  but the indirection is cheap). */
  private readonly _onScroll: () => void;

  constructor(options: ViewportOptions) {
    this._canvas = options.canvas;
    this._scale = new Observable<number>(1);
    this._scrollX = new Observable<number>(options.canvas.scrollLeft);
    this._scrollY = new Observable<number>(options.canvas.scrollTop);
    this._scrolling = new Observable<boolean>(false);
    this._onScroll = (): void => this._handleScroll();
    // Default: the canvas itself is the scroll target. Wiring
    // through `setScrollTarget` (rather than assigning the field
    // directly) attaches the `scroll` listener + seeds the
    // scrollX/Y observables. If a host wants a different target
    // (ali-faithful iframe simulator path), it calls
    // `setScrollTarget(other)` which removes the canvas listener
    // and wires the new one.
    this.setScrollTarget(options.canvas);
  }

  /** The canvas's viewport-relative rect. Re-read on every call —
   *  the canvas can scroll, resize, or animate, so caching is wrong. */
  get bounds(): DOMRect {
    return this._canvas.getBoundingClientRect();
  }

  /**
   * The content-area rect in canvas-local coordinates, taking
   * the current `scale` into account. Ali-faithful — used by
   * `isDOMNodeVisible` in `utils/misc.ts` and by the bem-tool
   * hover ring math in Phase D. With `scale=1` (the default)
   * this is `(0, 0, bounds.width, bounds.height)`.
   */
  get contentBounds(): DOMRect {
    const b = this.bounds;
    return new DOMRect(0, 0, b.width / this._scale.get(), b.height / this._scale.get());
  }

  /**
   * Set the canvas scale (1 = 100%, 0.5 = 50%, etc.). Used
   * by the bem-tool zoom controls in Phase D. Ali-faithful
   * validation: rejects NaN / non-positive (matches ali's
   * `if (isNaN(newScale) || newScale <= 0) throw`).
   */
  setScale(s: number): void {
    if (Number.isNaN(s) || s <= 0) {
      throw new Error(`Viewport.setScale: invalid scale "${s}" (must be a finite positive number)`);
    }
    this._scale.set(s);
  }

  // ==========================================================================
  // Phase C.Y: Observable-lite surface (ali-faithful @obx.ref)
  // ==========================================================================
  //
  // The `*Obs` accessors return the underlying Observable so the
  // bem-tool files in Phase D (and any plugin) can subscribe via
  // `autorun` or `reaction` to react to viewport changes. The
  // plain getters (`scale`, `scrollX`, `scrollY`, `scrolling`)
  // are kept as compat for the Phase B `IViewportLite` contract
  // in `offset-observer.ts` and for read-only consumers.

  /** Current canvas scale (default 1). */
  get scale(): number {
    return this._scale.get();
  }
  /** Ali-faithful `scale` Observable. */
  get scaleObs(): Observable<number> {
    return this._scale;
  }
  /** Current scroll-X (0 if no scroll target). */
  get scrollX(): number {
    return this._scrollX.get();
  }
  /** Ali-faithful `scrollX` Observable. */
  get scrollXObs(): Observable<number> {
    return this._scrollX;
  }
  /** Current scroll-Y (0 if no scroll target). */
  get scrollY(): number {
    return this._scrollY.get();
  }
  /** Ali-faithful `scrollY` Observable. */
  get scrollYObs(): Observable<number> {
    return this._scrollY;
  }
  /** `true` while the scroll target is actively scrolling
   *  (auto-resets 80ms after the last `scroll` event). */
  get scrolling(): boolean {
    return this._scrolling.get();
  }
  /** Ali-faithful `scrolling` Observable. */
  get scrollingObs(): Observable<boolean> {
    return this._scrolling;
  }

  /** Stub: stores the scroll target for future iframe support.
   *  Sapu doesn't ship a simulator iframe; the canvas IS the
   *  viewport. Wiring the `scroll` listener on the target
   *  makes `scrollX` / `scrollY` / `scrolling` auto-update. */
  setScrollTarget(target: Window | HTMLElement): void {
    // Remove the previous listener (if any) — we currently
    // only call this once but the indirection is the ali-faithful
    // swap behavior. The `scroll` and `resize` listeners are ali-faithful
    // (ali's `setScrollTarget` does the same).
    if (this._scrollTarget && this._scrollTarget !== target) {
      this._scrollTarget.removeEventListener('scroll', this._onScroll);
    }
    this._scrollTarget = target;
    if (this._scrollTarget) {
      this._scrollTarget.addEventListener('scroll', this._onScroll, { passive: true });
      // Seed the scrollX/Y observables from the current scroll
      // position so consumers reading them right after construction
      // get a non-zero value if the target is already scrolled.
      this._seedScrollFromTarget();
    }
  }

  /**
   * Ali-faithful `setScroll(x, y)`. Updates the scroll
   * observables + nudges the scroll target. Used by
   * `Scroller._tick()` (auto-scroll) and by `host.scrollToNode`
   * (scroll-into-view, Phase D).
   *
   * Calling with the current values is a no-op (Observable's
   * `===` short-circuit + the scroll event listener's self-update
   * being a no-op).
   */
  setScroll(x: number, y: number): void {
    this._scrollX.set(x);
    this._scrollY.set(y);
    const target = this._scrollTarget;
    if (!target) return;
    if (typeof Window !== 'undefined' && target === window) {
      target.scrollTo(x, y);
    } else if (target instanceof HTMLElement) {
      target.scrollTo(x, y);
    }
  }

  /** Currently-attached scroll target. */
  get scrollTarget(): Window | HTMLElement | null {
    return this._scrollTarget;
  }

  /** Ali-faithful `toGlobalPoint(canvas)`: canvas-local +
   *  bounds.left/top. Cross-frame no-op for sapu (no iframe). */
  toGlobalPoint(canvasX: number, canvasY: number): { x: number; y: number } {
    const r = this.bounds;
    return { x: r.left + canvasX, y: r.top + canvasY };
  }

  /** Ali-faithful `toLocalPoint(global)`: global - bounds.left/top. */
  toLocalPoint(globalX: number, globalY: number): { x: number; y: number } {
    const r = this.bounds;
    return { x: globalX - r.left, y: globalY - r.top };
  }

  // ---- internals ----

  private _seedScrollFromTarget(): void {
    const target = this._scrollTarget;
    if (!target) return;
    if (target instanceof HTMLElement) {
      this._scrollX.set(target.scrollLeft);
      this._scrollY.set(target.scrollTop);
    } else if (typeof Window !== 'undefined' && target === window) {
      this._scrollX.set(target.scrollX);
      this._scrollY.set(target.scrollY);
    }
  }

  private _handleScroll(): void {
    this._seedScrollFromTarget();
    this._scrolling.set(true);
    if (this._scrollingTimer) clearTimeout(this._scrollingTimer);
    this._scrollingTimer = setTimeout(() => {
      this._scrolling.set(false);
      this._scrollingTimer = null;
    }, 80);
  }

  /** Clear the scroll-listener + the auto-reset timer. Call on
   *  host unmount. */
  destroy(): void {
    if (this._scrollTarget) {
      this._scrollTarget.removeEventListener('scroll', this._onScroll);
    }
    if (this._scrollingTimer) {
      clearTimeout(this._scrollingTimer);
      this._scrollingTimer = null;
    }
  }
}
