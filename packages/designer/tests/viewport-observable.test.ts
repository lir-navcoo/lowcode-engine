/**
 * @monbolc/lowcode-designer — Phase C.Y ali-mirror tests
 * Viewport Observable-lite surface
 *
 * Per `~/.claude/plans/dynamic-marinating-rabbit.md` Phase C.
 * Closes the next gap: ali's Viewport exposes `scrollX` /
 * `scrollY` / `scale` / `scrolling` as MobX `@obx.ref` (auto-
 * tracking). Sapu mirrors the surface using Phase A's
 * `Observable-lite` so the Phase D bem-tool files (border-
 * selecting, border-detecting) can subscribe via `autorun` or
 * `reaction` and re-render on viewport changes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { autorun } from '@monbolc/lowcode-utils';
import { Viewport } from '../src/viewport';

describe('Viewport scale Observable (Phase C.Y)', () => {
  let canvas: HTMLDivElement;
  let vp: Viewport;

  beforeEach(() => {
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    vp = new Viewport({ canvas });
  });
  afterEach(() => {
    vp.destroy();
    document.body.removeChild(canvas);
  });

  it('default scale is 1 (observable + plain getter agree)', () => {
    expect(vp.scale).toBe(1);
    expect(vp.scaleObs.get()).toBe(1);
  });

  it('setScale updates both the observable and the plain getter', () => {
    vp.setScale(0.5);
    expect(vp.scale).toBe(0.5);
    expect(vp.scaleObs.get()).toBe(0.5);
  });

  it('setScale fires change subscribers', () => {
    const seen: Array<{ value: number; prev: number }> = [];
    const dispose = vp.scaleObs.events.on('change', (e) => seen.push(e));
    vp.setScale(0.75);
    expect(seen).toEqual([{ value: 0.75, prev: 1 }]);
    vp.setScale(0.5);
    expect(seen).toEqual([{ value: 0.75, prev: 1 }, { value: 0.5, prev: 0.75 }]);
    dispose();
    vp.setScale(2);
    expect(seen).toHaveLength(2);
  });

  it('setScale is a no-op on the same value (no spurious event)', () => {
    let count = 0;
    vp.scaleObs.events.on('change', () => count++);
    vp.setScale(1);
    vp.setScale(1);
    expect(count).toBe(0);
  });

  it('setScale rejects NaN / non-positive values (ali-faithful)', () => {
    expect(() => vp.setScale(NaN)).toThrow(/invalid scale/);
    expect(() => vp.setScale(0)).toThrow(/invalid scale/);
    expect(() => vp.setScale(-1)).toThrow(/invalid scale/);
    expect(vp.scale).toBe(1); // unchanged
  });

  it('autorun re-runs when scale changes', () => {
    const seen: number[] = [];
    const dispose = autorun(() => {
      seen.push(vp.scale);
    });
    expect(seen).toEqual([1]); // initial
    vp.setScale(0.5);
    vp.setScale(0.25);
    expect(seen).toEqual([1, 0.5, 0.25]);
    dispose();
    vp.setScale(0.1);
    expect(seen).toEqual([1, 0.5, 0.25]); // no more runs
  });
});

describe('Viewport scrollX / scrollY observables (Phase C.Y)', () => {
  let canvas: HTMLDivElement;
  let vp: Viewport;

  beforeEach(() => {
    canvas = document.createElement('div');
    canvas.id = 'phase-cy-canvas';
    Object.defineProperty(canvas, 'scrollLeft', { value: 0, writable: true, configurable: true });
    Object.defineProperty(canvas, 'scrollTop', { value: 0, writable: true, configurable: true });
    document.body.appendChild(canvas);
    vp = new Viewport({ canvas });
  });
  afterEach(() => {
    vp.destroy();
    document.body.removeChild(canvas);
  });

  it('setScroll updates the observables', () => {
    vp.setScroll(100, 50);
    expect(vp.scrollX).toBe(100);
    expect(vp.scrollY).toBe(50);
    expect(vp.scrollXObs.get()).toBe(100);
    expect(vp.scrollYObs.get()).toBe(50);
  });

  it('setScroll fires change subscribers', () => {
    const x: number[] = [];
    const y: number[] = [];
    const dx = vp.scrollXObs.events.on('change', (e) => x.push(e.value));
    const dy = vp.scrollYObs.events.on('change', (e) => y.push(e.value));
    vp.setScroll(10, 20);
    vp.setScroll(30, 40);
    expect(x).toEqual([10, 30]);
    expect(y).toEqual([20, 40]);
    dx();
    dy();
  });

  it('setScroll with the current values is a no-op', () => {
    vp.setScroll(10, 20);
    let count = 0;
    const dx = vp.scrollXObs.events.on('change', () => count++);
    vp.setScroll(10, 20);
    expect(count).toBe(0);
    dx();
  });

  it('scroll event on the target updates scrollX/scrollY', () => {
    Object.defineProperty(canvas, 'scrollLeft', { value: 200, writable: true, configurable: true });
    Object.defineProperty(canvas, 'scrollTop', { value: 150, writable: true, configurable: true });
    canvas.dispatchEvent(new Event('scroll'));
    expect(vp.scrollX).toBe(200);
    expect(vp.scrollY).toBe(150);
  });
});

describe('Viewport scrolling observable + 80ms auto-reset (Phase C.Y)', () => {
  let canvas: HTMLDivElement;
  let vp: Viewport;

  beforeEach(() => {
    canvas = document.createElement('div');
    Object.defineProperty(canvas, 'scrollLeft', { value: 0, writable: true, configurable: true });
    Object.defineProperty(canvas, 'scrollTop', { value: 0, writable: true, configurable: true });
    document.body.appendChild(canvas);
    vp = new Viewport({ canvas });
  });
  afterEach(() => {
    vp.destroy();
    document.body.removeChild(canvas);
  });

  it('scrolling starts false', () => {
    expect(vp.scrolling).toBe(false);
  });

  it('scroll event flips scrolling true; 80ms later flips it back false', () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(canvas, 'scrollLeft', { value: 50, writable: true, configurable: true });
      canvas.dispatchEvent(new Event('scroll'));
      expect(vp.scrolling).toBe(true);
      vi.advanceTimersByTime(80);
      expect(vp.scrolling).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('successive scroll events reset the 80ms timer', () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(canvas, 'scrollLeft', { value: 10, writable: true, configurable: true });
      canvas.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(50);
      Object.defineProperty(canvas, 'scrollLeft', { value: 20, writable: true, configurable: true });
      canvas.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(50);
      // 100ms since first scroll, 50ms since second. Still scrolling.
      expect(vp.scrolling).toBe(true);
      vi.advanceTimersByTime(30); // total 80ms since second
      expect(vp.scrolling).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('destroy() clears the auto-reset timer (no late flip to false)', () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(canvas, 'scrollLeft', { value: 10, writable: true, configurable: true });
      canvas.dispatchEvent(new Event('scroll'));
      expect(vp.scrolling).toBe(true);
      vp.destroy();
      vi.advanceTimersByTime(100);
      // After destroy, no further state changes; the timer was cleared.
      // (We can't observe the cancelled timer directly, but no error is
      // thrown and `scrolling` doesn't flip via the destroyed path.)
      expect(vp.scrolling).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scrolling is the public Observable (subscribe via .events)', () => {
    const seen: Array<{ value: boolean; prev: boolean }> = [];
    const dispose = vp.scrollingObs.events.on('change', (e) => seen.push(e));
    vi.useFakeTimers();
    try {
      Object.defineProperty(canvas, 'scrollLeft', { value: 5, writable: true, configurable: true });
      canvas.dispatchEvent(new Event('scroll'));
      expect(seen).toEqual([{ value: true, prev: false }]);
      vi.advanceTimersByTime(80);
      expect(seen).toEqual([
        { value: true, prev: false },
        { value: false, prev: true },
      ]);
    } finally {
      vi.useRealTimers();
    }
    dispose();
  });
});

describe('Viewport contentBounds is scale-aware (Phase C.Y)', () => {
  it('contentBounds shrinks by 1/scale', () => {
    const canvas = document.createElement('div');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    document.body.appendChild(canvas);
    const vp = new Viewport({ canvas });
    // scale 1: 200x100
    expect(vp.contentBounds.width).toBe(200);
    expect(vp.contentBounds.height).toBe(100);
    vp.setScale(0.5);
    // scale 0.5: 400x200 (content area is 2x in canvas-local)
    expect(vp.contentBounds.width).toBe(400);
    expect(vp.contentBounds.height).toBe(200);
    vp.destroy();
    document.body.removeChild(canvas);
  });
});

describe('Viewport setScrollTarget swap (Phase C.Y)', () => {
  it('re-wires the scroll listener when the target changes', () => {
    const canvas1 = document.createElement('div');
    Object.defineProperty(canvas1, 'scrollLeft', { value: 10, writable: true, configurable: true });
    Object.defineProperty(canvas1, 'scrollTop', { value: 20, writable: true, configurable: true });
    document.body.appendChild(canvas1);
    const vp = new Viewport({ canvas: canvas1 });
    expect(vp.scrollX).toBe(10);
    expect(vp.scrollY).toBe(20);

    // Swap to canvas2.
    const canvas2 = document.createElement('div');
    Object.defineProperty(canvas2, 'scrollLeft', { value: 100, writable: true, configurable: true });
    Object.defineProperty(canvas2, 'scrollTop', { value: 200, writable: true, configurable: true });
    document.body.appendChild(canvas2);
    vp.setScrollTarget(canvas2);
    // Seeds from new target.
    expect(vp.scrollX).toBe(100);
    expect(vp.scrollY).toBe(200);

    // Scrolling the OLD target no longer updates the observables.
    Object.defineProperty(canvas1, 'scrollLeft', { value: 999, writable: true, configurable: true });
    canvas1.dispatchEvent(new Event('scroll'));
    expect(vp.scrollX).toBe(100);

    // Scrolling the NEW target does.
    Object.defineProperty(canvas2, 'scrollLeft', { value: 300, writable: true, configurable: true });
    canvas2.dispatchEvent(new Event('scroll'));
    expect(vp.scrollX).toBe(300);

    vp.destroy();
    document.body.removeChild(canvas1);
    document.body.removeChild(canvas2);
  });
});

describe('Viewport destroy() (Phase C.Y)', () => {
  it('removes the scroll listener on destroy', () => {
    const canvas = document.createElement('div');
    Object.defineProperty(canvas, 'scrollLeft', { value: 0, writable: true, configurable: true });
    Object.defineProperty(canvas, 'scrollTop', { value: 0, writable: true, configurable: true });
    document.body.appendChild(canvas);
    const vp = new Viewport({ canvas });
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    vp.destroy();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    document.body.removeChild(canvas);
  });
});
