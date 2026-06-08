/**
 * @monbolc/lowcode-designer — Phase C ali-mirror tests
 * computeRect + getNodeInstancesRect + findDOMNodes
 *
 * Per `~/.claude/plans/dynamic-marinating-rabbit.md` Phase C. Closes
 * the only user-visible gap ali has but sapu didn't: multi-instance
 * DOM rect union math. Ali-faithful algorithm (verbatim port of
 * `host.ts:969-1030`); the slim sapu version operates on real DOM
 * Elements via the slim `InstanceLike` from `./dom.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BuiltinSimulatorHost } from '../src/simulator-host';
import { Project } from '../src/project';
import { findDOMNodes, instanceToElement } from '../src/dom';
import type { IPublicTypeNodeSchema, IPublicTypeRootSchema } from '@monbolc/lowcode-types';

function mkRoot(...children: IPublicTypeNodeSchema[]): IPublicTypeRootSchema {
  return { componentName: 'Page', props: {}, children } as IPublicTypeRootSchema;
}

function mkNode(name: string, key: string, children: IPublicTypeNodeSchema[] = []): IPublicTypeNodeSchema {
  return { componentName: name, props: {}, key, children } as IPublicTypeNodeSchema;
}

/** Build a DOM element with stubbed `getClientRects` returning the
 *  rects we want. Returns a fresh detached element. */
function mkEl(rect: { left: number; top: number; right: number; bottom: number }): HTMLDivElement {
  const el = document.createElement('div');
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  el.getClientRects = () => {
    const r = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: w, height: h, x: rect.left, y: rect.top, toJSON: () => ({}) } as DOMRect;
    return { length: 1, item: (i: number) => (i === 0 ? r : null), [Symbol.iterator]: function* () { yield r; } } as unknown as DOMRectList;
  };
  return el;
}

describe('findDOMNodes (Phase C ali-mirror)', () => {
  it('returns the element when instance is a real Element', () => {
    const el = document.createElement('div');
    const got = findDOMNodes(el);
    expect(got).toEqual([el]);
  });

  it('returns the .dom property when instance is a wrapper object', () => {
    const el = document.createElement('div');
    const got = findDOMNodes({ dom: el });
    expect(got).toEqual([el]);
  });

  it('returns the .element property when instance uses that key', () => {
    const el = document.createElement('div');
    const got = findDOMNodes({ element: el });
    expect(got).toEqual([el]);
  });

  it('returns null when instance is null or undefined', () => {
    expect(findDOMNodes(null)).toBeNull();
    expect(findDOMNodes(undefined)).toBeNull();
  });

  it('returns null when wrapper has neither .dom nor .element', () => {
    expect(findDOMNodes({})).toBeNull();
    expect(findDOMNodes({ dom: undefined, element: undefined })).toBeNull();
  });

  it('narrows to a single element when selector matches', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span class="target">x</span><span class="other">y</span>';
    const span = el.querySelector('.target')!;
    const got = findDOMNodes(el, '.target');
    expect(got).toEqual([span]);
  });

  it('returns null when selector matches no element', () => {
    const el = document.createElement('div');
    const got = findDOMNodes(el, '.nonexistent');
    expect(got).toBeNull();
  });

  it('finds a matching descendant when the element itself does not match', () => {
    const el = document.createElement('div');
    el.innerHTML = '<section><p class="needle">x</p></section>';
    const p = el.querySelector('.needle')!;
    const got = findDOMNodes(el, '.needle');
    expect(got).toEqual([p]);
  });
});

describe('instanceToElement (Phase C ali-mirror)', () => {
  it('returns the Element directly', () => {
    const el = document.createElement('div');
    expect(instanceToElement(el)).toBe(el);
  });
  it('unwraps .dom', () => {
    const el = document.createElement('div');
    expect(instanceToElement({ dom: el })).toBe(el);
  });
  it('unwraps .element', () => {
    const el = document.createElement('div');
    expect(instanceToElement({ element: el })).toBe(el);
  });
  it('returns null for null/undefined', () => {
    expect(instanceToElement(null)).toBeNull();
    expect(instanceToElement(undefined)).toBeNull();
  });
  it('prefers .dom over .element when both present', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    expect(instanceToElement({ dom: a, element: b })).toBe(a);
  });
});

describe('BuiltinSimulatorHost.computeComponentInstanceRect (Phase C ali-mirror)', () => {
  let canvas: HTMLDivElement;
  let project: Project;
  let host: BuiltinSimulatorHost;
  let root: IPublicTypeRootSchema;

  beforeEach(() => {
    canvas = document.createElement('div');
    canvas.id = 'phase-c-canvas';
    document.body.appendChild(canvas);
    root = mkRoot(mkNode('Button', 'btn-1'));
    project = new Project(root);
    host = new BuiltinSimulatorHost(project, { canvas });
  });
  afterEach(() => {
    document.body.removeChild(canvas);
  });

  it('returns null when no instances are registered', () => {
    const btn = project.document.getNode('btn-1')!;
    expect(host.computeComponentInstanceRect(document.createElement('div'))).toBeNull();
    void btn;
  });

  it('computes a single rect when one instance is registered', () => {
    const btn = project.document.getNode('btn-1')!;
    const el = mkEl({ left: 10, top: 20, right: 110, bottom: 70 });
    host.setInstance(btn.id, [el]);
    const rect = host.computeComponentInstanceRect(el);
    expect(rect).not.toBeNull();
    expect(rect!.left).toBe(10);
    expect(rect!.top).toBe(20);
    expect(rect!.right).toBe(110);
    expect(rect!.bottom).toBe(70);
    expect(rect!.width).toBe(100);
    expect(rect!.height).toBe(50);
    // Single rect → computed: false
    expect(rect!.computed).toBe(false);
    expect(rect!.elements).toEqual([el]);
  });

  it('unions multiple client rects of one element (multi-line span)', () => {
    // `computeComponentInstanceRect` is per-instance; for a single
    // inline Element with multiple line boxes, `getClientRects()`
    // returns one DOMRect per line. The algorithm unions them
    // (computed: true). This is the canonical use case ali uses
    // the multi-rect union for — see host.ts:976 `rects = renderer.getClientRects(elem)`.
    const btn = project.document.getNode('btn-1')!;
    const el = document.createElement('span');
    el.getClientRects = () => {
      // Three line boxes, horizontally adjacent, stacked vertically.
      const rects = [
        { left: 0, top: 0, right: 50, bottom: 20, width: 50, height: 20, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
        { left: 0, top: 25, right: 60, bottom: 45, width: 60, height: 20, x: 0, y: 25, toJSON: () => ({}) } as DOMRect,
        { left: 0, top: 50, right: 40, bottom: 70, width: 40, height: 20, x: 0, y: 50, toJSON: () => ({}) } as DOMRect,
      ];
      let i = rects.length;
      return {
        length: rects.length,
        item: (idx: number) => rects[idx] ?? null,
        [Symbol.iterator]: function* () { while (i--) yield rects[i]!; },
      } as unknown as DOMRectList;
    };
    host.setInstance(btn.id, [el]);
    const rect = host.computeComponentInstanceRect(el);
    expect(rect).not.toBeNull();
    expect(rect!.left).toBe(0);
    expect(rect!.top).toBe(0);
    expect(rect!.right).toBe(60);
    expect(rect!.bottom).toBe(70);
    expect(rect!.width).toBe(60);
    expect(rect!.height).toBe(70);
    expect(rect!.computed).toBe(true);
  });

  it('skips zero-area rects (collapsed whitespace, hidden elements)', () => {
    const btn = project.document.getNode('btn-1')!;
    const visible = mkEl({ left: 10, top: 10, right: 60, bottom: 30 });
    const zero = mkEl({ left: 0, top: 0, right: 0, bottom: 0 });
    host.setInstance(btn.id, [zero, visible]);
    const rect = host.computeComponentInstanceRect(visible);
    expect(rect).not.toBeNull();
    expect(rect!.left).toBe(10);
    expect(rect!.top).toBe(10);
    expect(rect!.right).toBe(60);
    expect(rect!.bottom).toBe(30);
  });

  it('setInstance(null) clears the registration', () => {
    const btn = project.document.getNode('btn-1')!;
    const el = mkEl({ left: 0, top: 0, right: 10, bottom: 10 });
    host.setInstance(btn.id, [el]);
    expect(host.getComponentInstances(btn)).toEqual([el]);
    host.setInstance(btn.id, null);
    expect(host.getComponentInstances(btn)).toBeNull();
  });

  it('getComponentInstances returns a defensive copy', () => {
    const btn = project.document.getNode('btn-1')!;
    const el = mkEl({ left: 0, top: 0, right: 10, bottom: 10 });
    const instances = [el];
    host.setInstance(btn.id, instances);
    const got = host.getComponentInstances(btn);
    expect(got).toEqual([el]);
    expect(got).not.toBe(instances); // defensive copy
  });

  it('narrowing a selector to a descendant computes a smaller rect', () => {
    const btn = project.document.getNode('btn-1')!;
    const wrapper = document.createElement('div');
    wrapper.getClientRects = () => {
      const r = { left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      return { length: 1, item: (i: number) => (i === 0 ? r : null), [Symbol.iterator]: function* () { yield r; } } as unknown as DOMRectList;
    };
    const inner = document.createElement('span');
    inner.className = 'inner';
    inner.getClientRects = () => {
      const r = { left: 10, top: 10, right: 50, bottom: 30, width: 40, height: 20, x: 10, y: 10, toJSON: () => ({}) } as DOMRect;
      return { length: 1, item: (i: number) => (i === 0 ? r : null), [Symbol.iterator]: function* () { yield r; } } as unknown as DOMRectList;
    };
    wrapper.appendChild(inner);
    host.setInstance(btn.id, [wrapper]);
    const full = host.computeComponentInstanceRect(wrapper);
    const inner1 = host.computeComponentInstanceRect(wrapper, '.inner');
    expect(full).not.toBeNull();
    expect(inner1).not.toBeNull();
    expect(full!.width).toBe(200);
    expect(inner1!.width).toBe(40);
  });
});

describe('DocumentModel.computeRect / getNodeInstancesRect (Phase C ali-mirror)', () => {
  let canvas: HTMLDivElement;
  let project: Project;
  let host: BuiltinSimulatorHost;
  let root: IPublicTypeRootSchema;

  beforeEach(() => {
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    root = mkRoot(mkNode('Button', 'btn-1'), mkNode('Card', 'card-1'));
    project = new Project(root);
    host = new BuiltinSimulatorHost(project, { canvas });
  });
  afterEach(() => {
    document.body.removeChild(canvas);
  });

  it('computeRect returns the rect of the first registered instance', () => {
    const btn = project.document.getNode('btn-1')!;
    const el = mkEl({ left: 5, top: 5, right: 55, bottom: 25 });
    host.setInstance(btn.id, [el]);
    const rect = project.document.computeRect(btn);
    expect(rect).not.toBeNull();
    expect(rect!.left).toBe(5);
    expect(rect!.top).toBe(5);
    expect(rect!.right).toBe(55);
    expect(rect!.bottom).toBe(25);
  });

  it('getNodeInstancesRect is an alias of computeRect', () => {
    const card = project.document.getNode('card-1')!;
    const el = mkEl({ left: 100, top: 200, right: 200, bottom: 300 });
    host.setInstance(card.id, [el]);
    const a = project.document.computeRect(card);
    const b = project.document.getNodeInstancesRect(card);
    expect(a).toEqual(b);
  });

  it('computeRect returns null when no host is wired', () => {
    const btn = project.document.getNode('btn-1')!;
    // Detach the host by calling setHost(null) — simulates a project
    // without a simulator (e.g. headless tests that only check the
    // schema tree).
    project.document.setHost(null);
    expect(project.document.computeRect(btn)).toBeNull();
  });

  it('computeRect returns null when the node has no registered instances', () => {
    const btn = project.document.getNode('btn-1')!;
    expect(project.document.computeRect(btn)).toBeNull();
  });

  it('setHost with a mock host redirects computeRect through the mock', () => {
    const btn = project.document.getNode('btn-1')!;
    const mockInstance = { dom: mkEl({ left: 7, top: 8, right: 17, bottom: 28 }) };
    project.document.setHost({
      getComponentInstances: (n) => (n.id === 'btn-1' ? [mockInstance] : null),
      computeComponentInstanceRect: (inst, _sel) => {
        const el = (inst as { dom: HTMLDivElement }).dom;
        return new DOMRect(7, 8, 10, 20);
      },
    });
    const rect = project.document.computeRect(btn);
    expect(rect).not.toBeNull();
    expect(rect!.left).toBe(7);
    expect(rect!.top).toBe(8);
    expect(rect!.right).toBe(17);
    expect(rect!.bottom).toBe(28);
  });

  it('BuiltinSimulatorHost constructor auto-wires the document', () => {
    // Sanity: `new BuiltinSimulatorHost(project, ...)` is enough
    // to make `document.computeRect` work — no explicit
    // `project.setSimulatorHost(host)` needed.
    const card = project.document.getNode('card-1')!;
    const el = mkEl({ left: 0, top: 0, right: 10, bottom: 10 });
    host.setInstance(card.id, [el]);
    const rect = project.document.computeRect(card);
    expect(rect).not.toBeNull();
    expect(rect!.right).toBe(10);
  });
});

describe('OffsetObserver.rectProvider integration (Phase C wires Phase B)', () => {
  let canvas: HTMLDivElement;
  let project: Project;
  let host: BuiltinSimulatorHost;
  let root: IPublicTypeRootSchema;

  beforeEach(() => {
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    root = mkRoot(mkNode('Button', 'btn-1'));
    project = new Project(root);
    host = new BuiltinSimulatorHost(project, { canvas });
  });
  afterEach(() => {
    document.body.removeChild(canvas);
  });

  it('rectProvider that calls document.computeRect returns a live rect', () => {
    const btn = project.document.getNode('btn-1')!;
    const el = mkEl({ left: 1, top: 2, right: 11, bottom: 12 });
    host.setInstance(btn.id, [el]);
    // The Phase B OffsetObserver is the canonical consumer of
    // computeRect. We don't construct one here (no DOM mount);
    // we just verify the provider pattern works end-to-end.
    const provider = (): DOMRect | null => {
      const r = project.document.computeRect(btn);
      return r;
    };
    const rect = provider();
    expect(rect).not.toBeNull();
    expect(rect!.left).toBe(1);
    expect(rect!.top).toBe(2);
    expect(rect!.right).toBe(11);
    expect(rect!.bottom).toBe(12);
  });
});
