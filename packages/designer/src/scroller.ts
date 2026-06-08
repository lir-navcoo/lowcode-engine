/**
 * @monbolc/lowcode-designer — Scroller
 *
 * Auto-scroll the canvas when the pointer is near the edge of the
 * viewport. Slim version of ali's `designer/src/designer/scroller.ts`.
 *
 * Lifecycle:
 *   1. Host creates one in `mount()` with a Viewport.
 *   2. On every `scrolling(e)`, the Scroller checks if the
 *      pointer is within `EDGE_THRESHOLD` of any viewport edge.
 *      If so, it nudges the canvas in that direction by
 *      `STEP` pixels on a `requestAnimationFrame` loop.
 *   3. Host calls `cancel()` to stop the loop.
 *
 * Implementation note: a single rAF loop with a "is running" flag
 * — no setInterval, no setTimeout, no observable subscription.
 */
const EDGE_THRESHOLD = 30; // px
const STEP = 8;            // px per tick
const MAX_DURATION_MS = 30_000; // safety: stop after 30s of continuous scroll

export interface ScrollerOptions {
  readonly viewport: import('./viewport').Viewport;
}

export class Scroller {
  private readonly _viewport: import('./viewport').Viewport;
  private _rafHandle: number | null = null;
  private _startTime = 0;
  private _lastPointer: { x: number; y: number } | null = null;
  private _lastDelta: { x: number; y: number } | null = null;

  constructor(options: ScrollerOptions) {
    this._viewport = options.viewport;
  }

  /**
   * Start (or continue) auto-scrolling. Computes the edge delta
   * from the pointer's position relative to the viewport, then
   * schedules a single rAF tick. Idempotent — calling repeatedly
   * is fine; the rAF handle is reused.
   */
  scrolling(e: { clientX: number; clientY: number }): void {
    const bounds = this._viewport.bounds;
    let dx = 0;
    let dy = 0;
    if (e.clientX < bounds.left + EDGE_THRESHOLD) dx = -STEP;
    else if (e.clientX > bounds.right - EDGE_THRESHOLD) dx = STEP;
    if (e.clientY < bounds.top + EDGE_THRESHOLD) dy = -STEP;
    else if (e.clientY > bounds.bottom - EDGE_THRESHOLD) dy = STEP;

    this._lastPointer = { x: e.clientX, y: e.clientY };
    this._lastDelta = { x: dx, y: dy };

    if (dx === 0 && dy === 0) {
      this.cancel();
      return;
    }

    if (this._rafHandle !== null) return; // already running
    this._startTime = Date.now();
    this._rafHandle = requestAnimationFrame(() => this._tick());
  }

  private _tick(): void {
    this._rafHandle = null;
    if (!this._lastDelta) return;
    if (Date.now() - this._startTime > MAX_DURATION_MS) {
      this.cancel();
      return;
    }
    const target = this._viewport.scrollTarget;
    if (target instanceof HTMLElement) {
      target.scrollBy({ left: this._lastDelta.x, top: this._lastDelta.y });
    } else if (typeof Window !== 'undefined' && target) {
      (target as Window).scrollBy(this._lastDelta.x, this._lastDelta.y);
    }
    // Re-schedule: the pointer might still be near the edge next frame.
    this._rafHandle = requestAnimationFrame(() => this._tick());
  }

  /** Stop the auto-scroll loop. */
  cancel(): void {
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
    this._lastDelta = null;
    this._lastPointer = null;
  }

  /** True iff a rAF loop is currently scheduled. */
  get isRunning(): boolean {
    return this._rafHandle !== null;
  }

  // ============================================================================
  // Phase B.2 ali-mirror additions: sensitivity + bounds detection
  // ============================================================================
  //
  // Ali's scroller has two extra surfaces the slim version lacked:
  //   - `setSensitive(s)` / `getSensitive()` — disable / re-enable
  //     the auto-scroll without tearing down the Scroller.
  //     Plugins use this when they take over pointer handling
  //     (e.g. a context-menu drag) and don't want background
  //     auto-scroll firing.
  //   - `detectBounds()` — the EDGE_THRESHOLD detection that
  //     `scrolling()` uses internally, exposed as a method so
  //     plugins can ask "is the pointer at the edge?" without
  //     triggering a scroll.
  //   - `autoScroll()` — ali-faithful reschedule helper for
  //     plugins that want to re-arm the loop with custom delta.

  /** Auto-scroll sensitivity. Default 1.0 (full); set to 0 to
   *  disable the scroll loop without canceling it. Ali-faithful. */
  private _sensitive = 1;

  setSensitive(s: number): void {
    this._sensitive = s;
  }

  getSensitive(): number {
    return this._sensitive;
  }

  /**
   * Detect whether a pointer is near any viewport edge. Returns
   * the edge delta `{ x, y }` (zero on both axes if the pointer
   * is comfortably inside). Ali-faithful — used by
   * `scrolling()` to compute the per-tick delta, exposed here
   * so plugins can ask "would scrolling fire?" without triggering
   * it.
   */
  detectBounds(clientX: number, clientY: number): { x: number; y: number } {
    if (this._sensitive === 0) return { x: 0, y: 0 };
    const bounds = this._viewport.bounds;
    let dx = 0;
    let dy = 0;
    if (clientX < bounds.left + EDGE_THRESHOLD) dx = -STEP;
    else if (clientX > bounds.right - EDGE_THRESHOLD) dx = STEP;
    if (clientY < bounds.top + EDGE_THRESHOLD) dy = -STEP;
    else if (clientY > bounds.bottom - EDGE_THRESHOLD) dy = STEP;
    return { x: dx, y: dy };
  }

  /**
   * Ali-faithful autoScroll. Same algorithm as `scrolling()`
   * but with an explicit (dx, dy) delta (useful for plugins
   * that compute the delta themselves, e.g. a wheel handler).
   * Re-arms the rAF loop if either axis is non-zero.
   */
  autoScroll(dx: number, dy: number): void {
    if (this._sensitive === 0) return;
    this._lastPointer = null;
    this._lastDelta = { x: dx, y: dy };
    if (dx === 0 && dy === 0) {
      this.cancel();
      return;
    }
    if (this._rafHandle !== null) return;
    this._startTime = Date.now();
    this._rafHandle = requestAnimationFrame(() => this._tick());
  }
}
