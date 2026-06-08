/**
 * @monbolc/lowcode-designer — Phase C.AA tests
 * OffsetObserver auto-subscribe to viewport observables
 *
 * Per `~/.claude/plans/dynamic-marinating-rabbit.md` Phase C.
 * The Phase B `OffsetObserver` was designed to be re-fired when
 * viewport changes (scroll, scale, scrolling-state transitions).
 * Before this commit, it only re-computed on construction +
 * `requestIdleCallback`; consumers that wanted re-fires had to
 * wire their own autorun. This commit makes the OffsetObserver
 * auto-subscribe to the optional `IViewportLite.*Obs` accessors
 * so it re-fires on every viewport change. The `Observable-lite`
 * is the Phase A foundation; the Viewport exposes the *Obs
 * accessors (Phase C.Y).
 */
import { describe, it, expect } from 'vitest';
import { Observable } from '@monbolc/lowcode-utils';
import { OffsetObserver, type IViewportLite, type NodeInstanceRef } from '../src/designer/offset-observer';

/** Build a stub IViewportLite that has the *Obs accessors and a
 *  controllable rectProvider. Returns the viewport + helpers so
 *  the test can drive it. */
function mkViewport(): { vp: IViewportLite; setScale: (s: number) => void; setScroll: (x: number, y: number) => void; setScrolling: (v: boolean) => void } {
  const scaleObs = new Observable<number>(1);
  const scrollXObs = new Observable<number>(0);
  const scrollYObs = new Observable<number>(0);
  const scrollingObs = new Observable<boolean>(false);
  const vp: IViewportLite = {
    width: 800,
    height: 600,
    scrollX: 0,
    scrollY: 0,
    scale: 1,
    scrolling: false,
    scaleObs, scrollXObs, scrollYObs, scrollingObs,
  };
  return {
    vp,
    setScale: (s) => { vp.scale = s; scaleObs.set(s); },
    setScroll: (x, y) => { vp.scrollX = x; vp.scrollY = y; scrollXObs.set(x); scrollYObs.set(y); },
    setScrolling: (v) => { vp.scrolling = v; scrollingObs.set(v); },
  };
}

const defaultRect = (): DOMRect => ({ left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

/** Build an observer + a pre-attached `change` listener so the
 *  listener catches the constructor's initial emit too. */
function mkWithListener(opts: { isRoot?: boolean; viewport?: IViewportLite | null; rectProvider?: (() => DOMRect | null) | null } = {}): { ob: OffsetObserver; seen: Array<{ hasOffset: boolean }> } {
  const seen: Array<{ hasOffset: boolean }> = [];
  const nodeInstance: NodeInstanceRef = { nodeId: 'n1', instance: 'i1' };
  const ob = new OffsetObserver({
    nodeInstance,
    isRoot: opts.isRoot,
    viewport: opts.viewport ?? undefined,
    rectProvider: opts.rectProvider ?? defaultRect,
  });
  ob.events.on('change', (e) => seen.push(e));
  return { ob, seen };
}

describe('OffsetObserver auto-subscribe to viewport (Phase C.AA)', () => {
  // Note: the OffsetObserver constructor may emit `change` once
  // synchronously (initial compute). The `mkWithListener` helper
  // attaches the listener AFTER construction, so the initial
  // emit is NOT counted in `seen`. Each test asserts on the
  // DELTA — what re-fires the auto-subscribe path causes.

  it('re-fires on viewport.scale change', () => {
    const { vp, setScale } = mkViewport();
    const { seen } = mkWithListener({ viewport: vp });
    setScale(0.5);
    expect(seen.length).toBe(1);
    expect(seen[0]).toEqual({ hasOffset: true });
  });

  it('re-fires on viewport.scrollX change', () => {
    const { vp, setScroll } = mkViewport();
    const { seen } = mkWithListener({ viewport: vp });
    setScroll(50, 0);
    expect(seen.length).toBe(1);
  });

  it('re-fires on viewport.scrollY change', () => {
    const { vp, setScroll } = mkViewport();
    const { seen } = mkWithListener({ viewport: vp });
    setScroll(0, 75);
    expect(seen.length).toBe(1);
  });

  it('re-fires on viewport.scrolling transition (true → false)', () => {
    const { vp, setScrolling } = mkViewport();
    const { seen } = mkWithListener({ viewport: vp });
    setScrolling(true);
    setScrolling(false);
    expect(seen.length).toBe(2);
  });

  it('slim viewport (no *Obs) still works — no auto-subscribe, no extra re-fires', () => {
    const slimVp: IViewportLite = {
      width: 800, height: 600, scrollX: 0, scrollY: 0, scale: 1, scrolling: false,
      // no *Obs accessors
    };
    // No auto-subscribe → no re-fires after the (missed-by-listener)
    // initial compute. The test asserts zero events because we
    // don't drive any viewport Observable.
    const { seen } = mkWithListener({ viewport: slimVp });
    expect(seen.length).toBe(0);
  });

  it('root observer also auto-subscribes to viewport observables', () => {
    const { vp, setScale } = mkViewport();
    const { seen } = mkWithListener({ isRoot: true, viewport: vp });
    // Root path: constructor may emit (root-mode initial emit);
    // we don't count that here. After construction, the auto-
    // subscribe path attaches. A setScale(0.5) re-fires.
    setScale(0.5);
    expect(seen.length).toBe(1);
  });

  it('purge() detaches subscriptions — no re-fires after purge', () => {
    const { vp, setScale } = mkViewport();
    const { ob, seen } = mkWithListener({ viewport: vp });
    ob.purge();
    setScale(0.5);
    expect(seen.length).toBe(0);
  });

  it('works without a viewport (no auto-subscribe)', () => {
    // No viewport → no auto-subscribe path. The constructor's
    // initial emit is missed by the listener.
    const { seen } = mkWithListener({ viewport: null });
    expect(seen.length).toBe(0);
  });
});
