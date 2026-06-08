/**
 * @monbolc/lowcode-designer — Phase C.AC tests
 * BuiltinSimulatorHost.getNodeRect (multi-instance union)
 *
 * Per `~/.claude/plans/dynamic-marinating-rabbit.md` Phase C. Closes
 * the multi-instance rect gap. When a component is rendered N
 * times on the canvas, all N share the same `data-lce-id`. The
 * drop-target math needs the UNION of their rects. Sapu's slim
 * `querySelector` returned only the FIRST instance's first
 * element — wrong for multi-instance cases (e.g. 3 Sidebar
 * nodes in a Dashboard layout). The new `getNodeRect` uses
 * `querySelectorAll` + a per-rect union to compute the
 * bounding rect of ALL instances.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from '../src/project';
import { BuiltinSimulatorHost } from '../src/simulator-host';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const mkRoot = (): IPublicTypeRootSchema => ({ componentName: 'Page', props: {}, children: [] });

/** Build an element tagged with `data-lce-id=X` and a known
 *  bounding rect. The element is attached to the canvas so the
 *  host's `querySelectorAll` actually finds it. */
function mkCanvasEl(canvas: HTMLElement, id: string, rect: { left: number; top: number; right: number; bottom: number }): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('data-lce-id', id);
  el.getBoundingClientRect = () =>
    ({
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.right - rect.left, height: rect.bottom - rect.top,
      x: rect.left, y: rect.top, toJSON: () => ({}),
    } as DOMRect);
  canvas.appendChild(el);
  return el;
}

describe('BuiltinSimulatorHost.getNodeRect (Phase C.AC multi-instance union)', () => {
  let canvas: HTMLDivElement;
  let project: Project;
  let host: BuiltinSimulatorHost;

  beforeEach(() => {
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    project = new Project(mkRoot());
    host = new BuiltinSimulatorHost(project, { canvas });
  });
  afterEach(() => {
    document.body.removeChild(canvas);
  });

  it('returns null when no element has the given data-lce-id', () => {
    expect(host.getNodeRect('nope')).toBeNull();
  });

  it('returns the single rect when exactly one element matches', () => {
    mkCanvasEl(canvas, 'btn-1', { left: 10, top: 20, right: 110, bottom: 70 });
    const r = host.getNodeRect('btn-1');
    expect(r).not.toBeNull();
    expect(r!.left).toBe(10);
    expect(r!.top).toBe(20);
    expect(r!.right).toBe(110);
    expect(r!.bottom).toBe(70);
    expect(r!.width).toBe(100);
    expect(r!.height).toBe(50);
  });

  it('returns the bounding rect of two horizontally adjacent instances', () => {
    // Two side-by-side cards: [0..50] and [60..100] horizontally
    mkCanvasEl(canvas, 'card-1', { left: 0, top: 0, right: 50, bottom: 50 });
    mkCanvasEl(canvas, 'card-1', { left: 60, top: 0, right: 100, bottom: 50 });
    const r = host.getNodeRect('card-1');
    expect(r).not.toBeNull();
    expect(r!.left).toBe(0);
    expect(r!.top).toBe(0);
    expect(r!.right).toBe(100);
    expect(r!.bottom).toBe(50);
    expect(r!.width).toBe(100);
    expect(r!.height).toBe(50);
  });

  it('returns the bounding rect of three vertically stacked instances', () => {
    // 3 stacked rows: [0..20], [30..50], [60..80] vertically
    mkCanvasEl(canvas, 'row-1', { left: 0, top: 0, right: 100, bottom: 20 });
    mkCanvasEl(canvas, 'row-1', { left: 0, top: 30, right: 100, bottom: 50 });
    mkCanvasEl(canvas, 'row-1', { left: 0, top: 60, right: 100, bottom: 80 });
    const r = host.getNodeRect('row-1');
    expect(r).not.toBeNull();
    expect(r!.top).toBe(0);
    expect(r!.bottom).toBe(80);
    expect(r!.height).toBe(80);
  });

  it('skips collapsed (zero-area) elements but still unions the rest', () => {
    mkCanvasEl(canvas, 'box-1', { left: 10, top: 10, right: 50, bottom: 50 });
    mkCanvasEl(canvas, 'box-1', { left: 0, top: 0, right: 0, bottom: 0 }); // collapsed
    const r = host.getNodeRect('box-1');
    expect(r).not.toBeNull();
    expect(r!.left).toBe(10);
    expect(r!.right).toBe(50);
  });

  it('returns null when all elements are collapsed', () => {
    mkCanvasEl(canvas, 'all-collapsed', { left: 0, top: 0, right: 0, bottom: 0 });
    mkCanvasEl(canvas, 'all-collapsed', { left: 0, top: 0, right: 0, bottom: 0 });
    expect(host.getNodeRect('all-collapsed')).toBeNull();
  });

  it('handles node ids with embedded dots (CSS selector metachar)', () => {
    // CSS.escape is used in production; this test verifies a
    // benign weird-id case that works under both happy-dom and
    // browser-native `querySelectorAll`. Browser-native also
    // handles `"` and `\\` via CSS.escape; happy-dom has known
    // gaps in those edge cases that we don't need to test here.
    const weirdId = 'weird.id-with-dots';
    mkCanvasEl(canvas, weirdId, { left: 5, top: 5, right: 25, bottom: 25 });
    const r = host.getNodeRect(weirdId);
    expect(r).not.toBeNull();
    expect(r!.left).toBe(5);
  });

  it('_rectForNode (private alias) routes to getNodeRect (public)', () => {
    mkCanvasEl(canvas, 'btn-1', { left: 0, top: 0, right: 100, bottom: 50 });
    const a = host.getNodeRect('btn-1');
    // _rectForNode is the internal alias used by computeDropTarget
    // and the locate builders. We invoke it via a cast (TS-level
    // private, runtime-public for testing).
    const b = (host as unknown as { _rectForNode: (id: string) => DOMRect | null })._rectForNode('btn-1');
    expect(b).toEqual(a);
  });
});
