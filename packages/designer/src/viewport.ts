/**
 * @monbolc/lowcode-designer — Viewport
 *
 * Encapsulates the canvas's scroll + position math. The host
 * creates one per `mount()` and tears it down on `unmount()`.
 *
 * Slim version of ali's `builtin-simulator/viewport.ts`:
 *   - `bounds` returns the canvas's viewport-relative rect.
 *   - `setScrollTarget` is a no-op (sapu doesn't have an iframe
 *     simulator — the canvas IS the viewport).
 *   - `toGlobalPoint` / `toLocalPoint` round-trip between
 *     canvas-local and global (viewport) coordinates.
 *
 * The Viewport is intentionally tiny; the real value comes from
 * having ONE place to do the coord math so the host and the
 * Scroller agree.
 */
export interface ViewportOptions {
  /** The canvas element whose getBoundingClientRect drives bounds. */
  readonly canvas: HTMLElement;
}

export class Viewport {
  private readonly _canvas: HTMLElement;
  private _scrollTarget: Window | HTMLElement | null = null;
  private _scale = 1;

  constructor(options: ViewportOptions) {
    this._canvas = options.canvas;
    this._scrollTarget = options.canvas; // default: the canvas itself
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
    return new DOMRect(0, 0, b.width / this._scale, b.height / this._scale);
  }

  /**
   * Set the canvas scale (1 = 100%, 0.5 = 50%, etc.). Used
   * by the bem-tool zoom controls in Phase D. Ali-faithful;
   * the scale is plain internal state, no MobX.
   */
  setScale(s: number): void {
    this._scale = s;
  }

  /** Current canvas scale (default 1). */
  get scale(): number {
    return this._scale;
  }

  /** Stub: stores the scroll target for future iframe support.
   *  Sapu doesn't ship a simulator iframe; this is here so the
   *  Scroller's API matches ali's. */
  setScrollTarget(target: Window | HTMLElement): void {
    this._scrollTarget = target;
  }

  /** Canvas-local → global (viewport) coordinates. */
  toGlobalPoint(canvasX: number, canvasY: number): { x: number; y: number } {
    const r = this.bounds;
    return { x: r.left + canvasX, y: r.top + canvasY };
  }

  /** Global → canvas-local coordinates. */
  toLocalPoint(globalX: number, globalY: number): { x: number; y: number } {
    const r = this.bounds;
    return { x: globalX - r.left, y: globalY - r.top };
  }

  /** The currently-attached scroll target. */
  get scrollTarget(): Window | HTMLElement | null {
    return this._scrollTarget;
  }
}
