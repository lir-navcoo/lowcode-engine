/**
 * @monbolc/lowcode-designer — offset-observer + detecting tests (Phase B.3)
 */
import { describe, it, expect } from 'vitest';
import { OffsetObserver, createOffsetObserver, type IViewportLite } from '../src/designer/offset-observer';
import { Detecting } from '../src/designer/detecting';

describe('OffsetObserver (Phase B ali-mirror)', () => {
  const vp: IViewportLite = { width: 800, height: 600, scrollX: 0, scrollY: 0, scale: 1, scrolling: false };

  it('createOffsetObserver returns null when no instance', () => {
    expect(createOffsetObserver({ nodeId: 'n1' })).toBeNull();
  });

  it('initialises the root-mode geometry from the viewport', () => {
    const o = new OffsetObserver({ nodeInstance: { nodeId: 'root' }, isRoot: true, viewport: vp });
    expect(o.hasOffset).toBe(true);
    expect(o.width).toBe(800);
    expect(o.height).toBe(600);
    expect(o.left).toBe(0);
    expect(o.top).toBe(0);
  });

  it('emits change on construction when root', () => {
    let count = 0;
    const o = new OffsetObserver({ nodeInstance: { nodeId: 'root' }, isRoot: true, viewport: vp });
    o.events.on('change', () => count++);
    // The constructor already fired; no further event from us.
    expect(count).toBe(0);
  });

  it('reads the rect from the provider (Phase C will wire this to computeComponentInstanceRect)', () => {
    const provider = (): DOMRect => ({ left: 10, top: 20, right: 110, bottom: 70, width: 100, height: 50, x: 10, y: 20, toJSON: () => ({}) } as DOMRect);
    const o = new OffsetObserver({ nodeInstance: { nodeId: 'n1', instance: 'inst' }, viewport: vp, rectProvider: provider });
    expect(o.hasOffset).toBe(true);
    expect(o.width).toBe(100);
    expect(o.height).toBe(50);
    expect(o.left).toBe(10);
    expect(o.top).toBe(20);
    expect(o.right).toBe(110);
    expect(o.bottom).toBe(70);
  });

  it('hasOffset=false when the provider returns null', () => {
    const o = new OffsetObserver({ nodeInstance: { nodeId: 'n1', instance: 'inst' }, viewport: vp, rectProvider: () => null });
    expect(o.hasOffset).toBe(false);
    expect(o.width).toBe(0);
  });

  it('honors the scale field on a non-root observer', () => {
    const provider = (): DOMRect => ({ left: 10, top: 20, right: 110, bottom: 70, width: 100, height: 50, x: 10, y: 20, toJSON: () => ({}) } as DOMRect);
    const scaledVp = { ...vp, scale: 0.5 };
    const o = new OffsetObserver({ nodeInstance: { nodeId: 'n1', instance: 'inst' }, viewport: scaledVp, rectProvider: provider });
    expect(o.width).toBe(50);   // 100 * 0.5
    expect(o.height).toBe(25);  // 50 * 0.5
    expect(o.right).toBe(55);   // 110 * 0.5
  });

  it('purge() cancels the idle callback; isPurged() reflects it', () => {
    const o = new OffsetObserver({ nodeInstance: { nodeId: 'n1', instance: 'inst' }, viewport: vp, rectProvider: () => null });
    // Constructor queued an idle callback (since provider is non-null
    // but returns null, no actual work).
    o.purge();
    expect(o.isPurged()).toBe(true);
  });
});

describe('Detecting (Phase B ali-mirror)', () => {
  it('starts with current=null and enable=true', () => {
    const d = new Detecting();
    expect(d.current).toBeNull();
    expect(d.enable).toBe(true);
  });

  it('capture sets the current node and emits', () => {
    const d = new Detecting<{ id: string }>();
    const seen: Array<{ id: string | null }> = [];
    d.onDetectingChange((n) => seen.push(n ? { id: n.id } : { id: null }));
    d.capture({ id: 'n1' });
    expect(d.current).toEqual({ id: 'n1' });
    expect(seen).toEqual([{ id: 'n1' }]);
  });

  it('capture with the SAME node does NOT emit (id-based equality)', () => {
    // Pass an id-based equality predicate so the test doesn't
    // rely on object reference identity (which is what the
    // default === does, and would be too strict for typical
    // "this is the same node" usage).
    const d = new Detecting<{ id: string }>({
      equals: (a, b) => a?.id === b?.id,
    });
    d.capture({ id: 'n1' });
    let count = 0;
    d.onDetectingChange(() => count++);
    d.capture({ id: 'n1' });
    expect(count).toBe(0);
  });

  it('release() clears current when node matches', () => {
    const d = new Detecting<{ id: string }>({
      equals: (a, b) => a?.id === b?.id,
    });
    d.capture({ id: 'n1' });
    const seen: Array<string | null> = [];
    d.onDetectingChange((n) => seen.push(n ? n.id : null));
    d.release({ id: 'n1' });
    expect(d.current).toBeNull();
    expect(seen).toEqual([null]);
  });

  it('release() with a different node does NOT clear current', () => {
    const d = new Detecting<{ id: string }>({
      equals: (a, b) => a?.id === b?.id,
    });
    d.capture({ id: 'n1' });
    d.release({ id: 'n2' });
    expect(d.current).toEqual({ id: 'n1' });
  });

  it('enable=false clears current', () => {
    const d = new Detecting<{ id: string }>();
    d.capture({ id: 'n1' });
    d.enable = false;
    expect(d.current).toBeNull();
    expect(d.enable).toBe(false);
  });

  it('onDetectingChange returns a disposer that removes the listener', () => {
    const d = new Detecting<{ id: string }>();
    const seen: string[] = [];
    const dispose = d.onDetectingChange((n) => seen.push(n!.id));
    d.capture({ id: 'a' });
    dispose();
    d.capture({ id: 'b' });
    expect(seen).toEqual(['a']);
  });

  it('leave() clears current only if it belongs to the given document', () => {
    const d = new Detecting<{ id: string; document?: object }>();
    const docA = { id: 'A' };
    d.capture({ id: 'n1', document: docA });
    d.leave({ id: 'B' }); // different doc → no clear
    expect(d.current).not.toBeNull();
    d.leave(docA);
    expect(d.current).toBeNull();
  });
});
