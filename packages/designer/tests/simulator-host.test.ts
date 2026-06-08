/**
 * BuiltinSimulatorHost — tests
 *
 * The host is the bridge between canvas DOM events and the Dragon.
 * Pure logic worth covering here:
 *   - `computeDropTarget` for an empty canvas → root, end of children
 *   - `computeDropTarget` for a hit in the top / middle / bottom
 *     third of an element → 'before' / 'inside' / 'after'
 *   - `computeDropTarget` for a hit on a root child (parent=null)
 *     uses the schema's `key` to look up the index
 *
 * DOM-level interactions (pointerdown, pointermove, pointerup) are
 * not exercised here — they'd require happy-dom to actually compute
 * layout, which it doesn't. The pointer handlers are thin wrappers
 * around the same `computeDropTarget` / `dragon.commit` calls
 * already covered.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from '../src/project';
import { BuiltinSimulatorHost } from '../src/simulator-host';
import { tagElementWithNodeId } from '../src/dom';
import { deepClone } from '@monbolc/lowcode-utils';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const SEED: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header' },
    { componentName: 'Body', children: [
      { componentName: 'Sidebar' },
      { componentName: 'Main' },
    ] },
  ],
};

describe('BuiltinSimulatorHost.computeDropTarget', () => {
  let project: Project;
  let canvas: HTMLElement;
  let host: BuiltinSimulatorHost;
  let root: IPublicTypeRootSchema;
  // happy-dom doesn't compute layout, so `document.elementsFromPoint`
  // returns an empty array and `getBoundingClientRect` returns
  // zeros. We install a fake `elementsFromPoint` that walks the
  // canvas's tagged children and returns the one whose mocked
  // rect contains the pointer. This is the minimum scaffolding
  // needed to exercise the vertical-thirds algorithm end-to-end.
  let origElementsFromPoint: typeof document.elementsFromPoint | undefined;
  beforeEach(() => {
    root = deepClone(SEED);
    project = new Project(root);
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    canvas.innerHTML = `
      <div data-lce-id="__header__" style="position:absolute; top:0; height:60px"></div>
      <div data-lce-id="__body__"   style="position:absolute; top:60px; height:60px"></div>
    `;
    canvas.querySelectorAll<HTMLElement>('[data-lce-id]').forEach((el) => {
      const top = el.dataset.lceId === '__header__' ? 0 : 60;
      el.getBoundingClientRect = () => ({ top, bottom: top + 60, left: 0, right: 100, width: 100, height: 60, x: 0, y: top, toJSON: () => ({}) } as DOMRect);
    });
    // Install the elementsFromPoint shim that returns the canvas
    // child whose mocked rect contains (x, y). The shim is
    // removed in afterEach so other tests aren't affected.
    origElementsFromPoint = document.elementsFromPoint;
    (document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = (x: number, y: number) => {
      const stack: Element[] = [];
      canvas.querySelectorAll<HTMLElement>('[data-lce-id]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          stack.push(el);
        }
      });
      return stack;
    };
    host = new BuiltinSimulatorHost(project, { canvas });
  });
  afterEach(() => {
    if (origElementsFromPoint) {
      (document as unknown as { elementsFromPoint: typeof document.elementsFromPoint }).elementsFromPoint = origElementsFromPoint;
    }
  });

  it('returns root / end-of-children for an empty canvas', () => {
    // Clear out the test fixture; no element under the pointer.
    canvas.innerHTML = '';
    const t = host.computeDropTarget(50, 50);
    // Empty canvas → append to root. The seed has 2 children, so
    // index 2 is the end. placement: 'inside' is the canonical
    // "no specific spot" answer.
    expect(t).toEqual({ parentId: null, index: 2, placement: 'inside' });
  });

  // Drive the vertical-thirds branches directly via the
  // public API. The body node is at index 1 in root.children,
  // its assigned id is what we re-tag the DOM fixture with.
  // Body's rendered rect is y=[60, 120] (60px tall).
  // Note: "drop at root level" returns the root Node's id (not
  // null) — the root is a real Node in the document tree, and
  // its children are accessed via `rootNode.children`. The
  // document.move() function handles both forms identically
  // (it falls back to `_root` when parent is null).

  it('top third of body → drop as a sibling before it (root, index 1)', () => {
    const rootId = project.document.root.key as string;
    const bodyId = project.document.getNode(rootId)!.children[1].id;
    const bodyEl = canvas.querySelector('[data-lce-id="__body__"]') as HTMLElement;
    tagElementWithNodeId(bodyEl, bodyId);
    // y=70 → inside body's rect (60..120), relativeY=10 → top third
    const t = host.computeDropTarget(50, 70);
    expect(t).toEqual({ parentId: rootId, index: 1, placement: 'before' });
  });

  it('middle third of body → drop as the last child of body', () => {
    const rootId = project.document.root.key as string;
    const bodyId = project.document.getNode(rootId)!.children[1].id;
    const bodyEl = canvas.querySelector('[data-lce-id="__body__"]') as HTMLElement;
    tagElementWithNodeId(bodyEl, bodyId);
    // y=90 → inside body's rect, relativeY=30 → middle third
    // body has 2 children → "inside" lands at index 2 (append)
    const t = host.computeDropTarget(50, 90);
    expect(t).toEqual({ parentId: bodyId, index: 2, placement: 'inside' });
  });

  it('bottom third of body → drop as a sibling after it (root, index 2)', () => {
    const rootId = project.document.root.key as string;
    const bodyId = project.document.getNode(rootId)!.children[1].id;
    const bodyEl = canvas.querySelector('[data-lce-id="__body__"]') as HTMLElement;
    tagElementWithNodeId(bodyEl, bodyId);
    // y=110 → inside body's rect, relativeY=50 → bottom third
    // "after body" lands at index 2 in root.children
    const t = host.computeDropTarget(50, 110);
    expect(t).toEqual({ parentId: rootId, index: 2, placement: 'after' });
  });

  it('returns null when the hit id is not in the document', () => {
    canvas.innerHTML = '<div data-lce-id="__ghost__" style="position:absolute; top:0; height:60px"></div>';
    const el = canvas.querySelector('[data-lce-id="__ghost__"]') as HTMLElement;
    el.getBoundingClientRect = () => ({ top: 0, bottom: 60, left: 0, right: 100, width: 100, height: 60, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    const t = host.computeDropTarget(50, 30);
    // The host tries to look up the ghost id; document.getNode
    // returns undefined → the host returns null. This is the
    // "no valid drop target" signal the caller should respect.
    expect(t).toBeNull();
  });
});
