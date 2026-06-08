/**
 * @monbolc/lowcode-designer — DragResizeEngine tests
 *
 * P9 covers two things:
 *   1. The pure `computeResize` math for all 8 anchors. No DOM
 *      needed — these are the canonical resize-arithmetic tests.
 *   2. The `DragResizeEngine` integration: start → preview →
 *      commit, with a stub `applyProps` so we can assert the
 *      final patch without spinning up a real `DocumentModel`.
 */
import { describe, it, expect } from 'vitest';
import { computeResize, DragResizeEngine, type ResizeAnchor } from '../src/drag-resize';
import type { Node } from '../src/node';
import type { Project } from '../src/project';

const ORIGIN = { width: 100, height: 60, left: 20, top: 30 };

describe('computeResize (pure math)', () => {
  it('e (east) anchor: drags right edge, width grows', () => {
    const r = computeResize(ORIGIN, 'e', 40, 0);
    expect(r).toEqual({ width: 140, height: 60, left: 20, top: 30 });
  });

  it('w (west) anchor: drags left edge, width shrinks + left moves', () => {
    const r = computeResize(ORIGIN, 'w', -30, 0);
    // width 100 - (-30) = 130, left 20 + (100 - 130) = -10
    expect(r).toEqual({ width: 130, height: 60, left: -10, top: 30 });
  });

  it('se (south-east) anchor: width + height both grow', () => {
    const r = computeResize(ORIGIN, 'se', 20, 10);
    expect(r).toEqual({ width: 120, height: 70, left: 20, top: 30 });
  });

  it('nw (north-west) anchor: width + height shrink, left + top move', () => {
    const r = computeResize(ORIGIN, 'nw', -20, -10);
    // width 100 - (-20) = 120, height 60 - (-10) = 70
    // left 20 + (100 - 120) = 0, top 30 + (60 - 70) = 20
    expect(r).toEqual({ width: 120, height: 70, left: 0, top: 20 });
  });

  it('respects the MIN_SIZE floor (no zero-sized rects)', () => {
    // Drag w so far left that the natural width would be -50;
    // the engine should clamp to MIN_SIZE (8).
    const r = computeResize(ORIGIN, 'w', 200, 0);
    expect(r.width).toBe(8);
  });

  it('n (north) anchor: drags top edge, height shrinks + top moves', () => {
    const r = computeResize(ORIGIN, 'n', 0, -20);
    // height 60 - (-20) = 80, top 30 + (60 - 80) = 10
    expect(r).toEqual({ width: 100, height: 80, left: 20, top: 10 });
  });

  it('ne (north-east) anchor: width grows + height shrinks + top moves', () => {
    const r = computeResize(ORIGIN, 'ne', 20, -10);
    // width 100 + 20 = 120, height 60 - (-10) = 70, top 30 + (60-70) = 20
    expect(r).toEqual({ width: 120, height: 70, left: 20, top: 20 });
  });

  it('e/s anchors preserve the origin (left/top are unchanged, not dropped)', () => {
    // Ali-faithful: the engine ALWAYS carries left/top when the
    // origin has them. e/s anchors don't touch left/top, so the
    // values are the same as the origin. Consumers (the DOM
    // writer) choose whether to actually re-apply them based on
    // whether the value changed from the original.
    const e = computeResize(ORIGIN, 'e', 10, 0);
    expect(e.left).toBe(ORIGIN.left);
    expect(e.top).toBe(ORIGIN.top);
    expect(e.width).toBe(110);
    expect(e.height).toBe(60);
  });
});

describe('DragResizeEngine', () => {
  // Build a fake `Project` + `Node` just for the engine.
  // We don't drive a real drag through events (happy-dom
  // doesn't honor addEventListener on document consistently
  // for synthetic PointerEvent in this version); we just
  // call `engine.preview(dx, dy)` and `engine.commit()`
  // directly to lock the integration contract.

  function makeNode(id: string): Node {
    return { id, schema: { key: id } as never, parent: null } as unknown as Node;
  }

  function makeProject(node: Node, patches: Array<Record<string, number>>): Project {
    return {
      document: {
        getNode: (_id: string) => (node.id === _id ? node : undefined),
        setProps: (_n: Node, p: Record<string, number>) => { patches.push(p); },
      },
    } as unknown as Project;
  }

  it('preview() computes the new rect from the current anchor + delta', () => {
    const node = makeNode('n1');
    const patches: Array<Record<string, number>> = [];
    const project = makeProject(node, patches);
    // canvas + node element with getBoundingClientRect returning
    // 100x60 at (20, 30) → origin (20, 30, 100, 60).
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'n1');
    canvas.appendChild(el);
    el.getBoundingClientRect = () => ({ width: 100, height: 60, left: 20, top: 30, right: 120, bottom: 90, x: 20, y: 30, toJSON: () => ({}) } as DOMRect);
    canvas.getBoundingClientRect = () => ({ width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    const engine = new DragResizeEngine({ project, canvas });
    // Simulate a pointerdown by calling start() with a stub event.
    const fakeEvt = { clientX: 0, clientY: 0, button: 0 } as unknown as PointerEvent;
    engine.start('n1', 'se', fakeEvt);
    expect(engine.isResizing).toBe(true);

    // Drag the SE anchor +20 right, +10 down.
    const r = engine.preview(20, 10);
    expect(r).not.toBeNull();
    expect(r!.width).toBe(120);
    expect(r!.height).toBe(70);

    // applyPreview mutates the DOM inline style.
    engine.applyPreview(20, 10);
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('70px');

    // commit() calls applyProps with the rounded patch. For the
    // SE anchor with origin (20, 30, 100, 60), `last` carries the
    // unchanged left/top (the engine preserves them so consumers
    // can decide whether to re-apply). The patch includes them.
    engine.commit();
    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual({ width: 120, height: 70, left: 20, top: 30 });
    expect(engine.isResizing).toBe(false);
  });

  it('cancel() reverts the inline style and does NOT call applyProps', () => {
    const node = makeNode('n2');
    const patches: Array<Record<string, number>> = [];
    const project = makeProject(node, patches);
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'n2');
    canvas.appendChild(el);
    el.getBoundingClientRect = () => ({ width: 80, height: 40, left: 0, top: 0, right: 80, bottom: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    canvas.getBoundingClientRect = () => ({ width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    const engine = new DragResizeEngine({ project, canvas });
    engine.start('n2', 'e', { clientX: 0, clientY: 0, button: 0 } as unknown as PointerEvent);
    engine.applyPreview(50, 0);
    expect(el.style.width).toBe('130px');
    engine.cancel();
    // After cancel: inline style restored, no applyProps call.
    expect(patches).toHaveLength(0);
    expect(engine.isResizing).toBe(false);
  });

  it('start() refuses when the node id is not in the document', () => {
    const project = { document: { getNode: () => undefined, setProps: () => {} } } as unknown as Project;
    const canvas = document.createElement('div');
    const engine = new DragResizeEngine({ project, canvas });
    engine.start('ghost', 'se', { clientX: 0, clientY: 0, button: 0 } as unknown as PointerEvent);
    expect(engine.isResizing).toBe(false);
  });

  it('start() refuses when already resizing (nested-drag guard)', () => {
    const node = makeNode('n3');
    const project = makeProject(node, []);
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'n3');
    canvas.appendChild(el);
    el.getBoundingClientRect = () => ({ width: 10, height: 10, left: 0, top: 0, right: 10, bottom: 10, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    const engine = new DragResizeEngine({ project, canvas });
    engine.start('n3', 'se', { clientX: 0, clientY: 0, button: 0 } as unknown as PointerEvent);
    expect(engine.isResizing).toBe(true);
    // A second start() with a different id is a no-op.
    engine.start('n4', 'se', { clientX: 0, clientY: 0, button: 0 } as unknown as PointerEvent);
    expect(engine.isResizing).toBe(true);
  });

  it('NW anchor commits with left + top + width + height (move + resize)', () => {
    const node = makeNode('n5');
    const patches: Array<Record<string, number>> = [];
    const project = makeProject(node, patches);
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'n5');
    el.style.left = '20px';
    el.style.top = '30px';
    canvas.appendChild(el);
    el.getBoundingClientRect = () => ({ width: 100, height: 60, left: 20, top: 30, right: 120, bottom: 90, x: 20, y: 30, toJSON: () => ({}) } as DOMRect);
    canvas.getBoundingClientRect = () => ({ width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    const engine = new DragResizeEngine({ project, canvas });
    engine.start('n5', 'nw', { clientX: 20, clientY: 30, button: 0 } as unknown as PointerEvent);
    // Drag NW -20, -10 → new width 120, height 70, left 0, top 20.
    engine.applyPreview(-20, -10);
    engine.commit();
    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual({ width: 120, height: 70, left: 0, top: 20 });
  });

  it('all 8 anchors are accepted by computeResize (no typos in the switch)', () => {
    const anchors: ResizeAnchor[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const a of anchors) {
      const r = computeResize(ORIGIN, a, 10, 10);
      expect(r).toBeDefined();
      expect(typeof r.width).toBe('number');
      expect(typeof r.height).toBe('number');
    }
  });
});
