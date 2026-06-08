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
}
