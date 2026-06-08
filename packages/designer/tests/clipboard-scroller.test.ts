/**
 * @monbolc/lowcode-designer — clipboard + scroller tests (Phase B)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clipboard, clipboard as defaultClipboard } from '../src/designer/clipboard';
import { Scroller } from '../src/scroller';
import { Viewport } from '../src/viewport';

describe('Clipboard (Phase B ali-mirror)', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    host.id = 'test-host-clipboard';
    document.body.appendChild(host);
  });
  afterEach(() => {
    document.body.removeChild(host);
  });

  it('injects a hidden textarea into the body on construction', () => {
    const c = new Clipboard(document);
    const pasteAreas = document.querySelectorAll('textarea[style*="-9999px"]');
    expect(pasteAreas.length).toBeGreaterThan(0);
  });

  it('setData emits the set event and returns true on successful copy', () => {
    const c = new Clipboard(document);
    // happy-dom doesn't actually run execCommand — but
    // setData emits on the path that runs (we just want
    // to assert the event flow). We override execCommand
    // to return true so the emit fires.
    const origExec = document.execCommand;
    document.execCommand = vi.fn(() => true);
    try {
      const seen: Array<{ data: unknown }> = [];
      c.events.on('set', (e) => seen.push({ data: e.data }));
      const ok = c.setData({ componentName: 'A' });
      expect(ok).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0]!.data).toEqual({ componentName: 'A' });
    } finally {
      document.execCommand = origExec;
    }
  });

  it('setData returns false when no copyPaster is registered for the target document', () => {
    // Use a fresh Clipboard that has never been wired to any
    // document. The setData() lookup `find(x => x.ownerDocument)`
    // will return undefined → we return false before touching
    // the textarea. We construct against the test document
    // but then remove the textarea to verify the empty case.
    const c = new Clipboard(document);
    // Strip the constructor's textarea out of the DOM AND
    // the internal copyPasters list.
    c['_copyPasters'].length = 0;
    document.querySelectorAll('textarea[style*="-9999px"]').forEach((t) => t.remove());
    const ok = c.setData({ x: 1 });
    expect(ok).toBe(false);
  });

  it('default singleton is constructed and live', () => {
    // The module-level singleton has already run constructor;
    // it injected a textarea into document.body. We just check
    // it's there + has the events surface.
    expect(defaultClipboard).toBeInstanceOf(Clipboard);
    expect(typeof defaultClipboard.setData).toBe('function');
  });
});

describe('Scroller ali-faithful extensions (Phase B)', () => {
  let host: HTMLDivElement;
  let vp: Viewport;
  let scroller: Scroller;

  beforeEach(() => {
    host = document.createElement('div');
    host.id = 'test-host-scroller';
    document.body.appendChild(host);
    host.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    vp = new Viewport({ canvas: host });
    scroller = new Scroller({ viewport: vp });
  });
  afterEach(() => {
    document.body.removeChild(host);
  });

  it('setSensitive / getSensitive round-trip', () => {
    expect(scroller.getSensitive()).toBe(1);
    scroller.setSensitive(0.5);
    expect(scroller.getSensitive()).toBe(0.5);
    scroller.setSensitive(0);
    expect(scroller.getSensitive()).toBe(0);
  });

  it('detectBounds returns zero delta when the pointer is centered', () => {
    const d = scroller.detectBounds(100, 100);
    expect(d).toEqual({ x: 0, y: 0 });
  });

  it('detectBounds returns negative dx when the pointer is near the left edge', () => {
    // Threshold is 30px, viewport left = 0 → pointer.x < 30.
    const d = scroller.detectBounds(10, 100);
    expect(d.x).toBeLessThan(0);
    expect(d.y).toBe(0);
  });

  it('detectBounds returns positive dy when the pointer is near the bottom edge', () => {
    // Threshold is 30px, viewport bottom = 200 → pointer.y > 170.
    const d = scroller.detectBounds(100, 190);
    expect(d.y).toBeGreaterThan(0);
  });

  it('detectBounds returns zero when sensitivity is 0', () => {
    scroller.setSensitive(0);
    expect(scroller.detectBounds(10, 190)).toEqual({ x: 0, y: 0 });
  });

  it('autoScroll schedules a rAF loop and isRunning becomes true', () => {
    scroller.autoScroll(-5, 0);
    expect(scroller.isRunning).toBe(true);
    scroller.cancel();
    expect(scroller.isRunning).toBe(false);
  });

  it('autoScroll with (0, 0) cancels immediately', () => {
    scroller.autoScroll(0, 0);
    expect(scroller.isRunning).toBe(false);
  });
});
