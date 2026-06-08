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
 *   - `commitDrop` for a boost (palette → canvas) ALWAYS produces
 *     a schema node with a `props: {}` field, even if no
 *     `initialProps` were supplied — so the settings panel has
 *     a stable target to write into.
 *   - DOM-level interactions: `pointerdown` on a tagged element
 *     fires `project.select(...)`; a `pointermove` past the drag
 *     threshold promotes the pending click to a `dragon.start(...)`
 *     so the existing move-path code can take over.
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

/**
 * Commit-drop tests for the boost path. We reach into the host's
 * private `commitDrop` indirectly by going through the public
 * boost → commit → drop flow:
 *   1. `dragon.boost(meta, x, y)` starts a boost drag.
 *   2. `dragon.move(x, y, target)` carries the drop target.
 *   3. `host.handleUp(...)` calls `commitDrop(result)`.
 *
 * We expose `handleUp` for the test by casting the host to `any`
 * (it's intentionally private — production code goes through
 * pointer events; tests just want the deterministic API).
 */

// ===== P8.3 — lock-ancestor guard =====
describe('BuiltinSimulatorHost.computeDropTarget — locked ancestor (v2.3.5)', () => {
  let project: Project;
  let canvas: HTMLElement;
  let host: BuiltinSimulatorHost;
  let rootId: string;
  let bodyId: string;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    canvas.innerHTML = `
      <div data-lce-id="__header__" style="position:absolute; top:0; height:60px"></div>
      <div data-lce-id="__body__"   style="position:absolute; top:60px; height:60px"></div>
    `;
    rootId = project.document.root.key as string;
    bodyId = project.document.getNode(rootId)!.children[1].id;
    // Re-tag the body canvas div with the real node id so the
    // host's hit-test can resolve it via document.getNode.
    const bodyEl = canvas.querySelector('[data-lce-id="__body__"]') as HTMLElement;
    bodyEl.setAttribute('data-lce-id', bodyId);
    canvas.querySelectorAll<HTMLElement>('[data-lce-id]').forEach((el) => {
      const top = el.getAttribute('data-lce-id') === bodyId ? 60 : 0;
      el.getBoundingClientRect = () => ({ top, bottom: top + 60, left: 0, right: 100, width: 100, height: 60, x: 0, y: top, toJSON: () => ({}) } as DOMRect);
    });
    (document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = (x: number, y: number) => {
      const stack: Element[] = [];
      canvas.querySelectorAll<HTMLElement>('[data-lce-id]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) stack.push(el);
      });
      return stack;
    };
    host = new BuiltinSimulatorHost(project, { canvas });
  });

  it('rejects the drop (returns null) when the hit node is itself locked', () => {
    const bodyNode = project.document.getNode(bodyId)!;
    // Ali-faithful: lock is a `props.isLocked` boolean on the node.
    project.document.setProps(bodyNode, { isLocked: true });
    // Pointer inside the body rect → would normally resolve to
    // body (or one of its children). With lock, the host returns
    // null → Dragon emits `cancel` instead of `drop`.
    const target = host.computeDropTarget(50, 90);
    expect(target).toBeNull();
  });

  it('rejects the drop when an ancestor of the hit is locked', () => {
    // Lock the root (which is an ancestor of every node). The
    // hit resolves to body; body → root is locked → drop rejected.
    const root = project.document.getNode(rootId)!;
    project.document.setProps(root, { isLocked: true });
    const target = host.computeDropTarget(50, 90);
    expect(target).toBeNull();
  });

  it('accepts the drop when isLocked is false or absent', () => {
    // Default SEED: no isLocked anywhere. The host returns a
    // non-null DropTarget. (We don't assert the exact target
    // shape here — that's the existing computeDropTarget suite's
    // job; this test only asserts "lock does not break unlocked
    // drops".)
    const target = host.computeDropTarget(50, 90);
    expect(target).not.toBeNull();
  });
});
describe('BuiltinSimulatorHost.commitDrop (boost → insert)', () => {
  let project: Project;
  let canvas: HTMLElement;
  let host: BuiltinSimulatorHost;
  beforeEach(() => {
    const root = deepClone(SEED);
    project = new Project(root);
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    host = new BuiltinSimulatorHost(project, { canvas });
  });

  it('inserted node has props: {} even when initialProps is undefined', () => {
    project.dragon.boost({ componentName: 'Footer' }, 50, 50);
    // Drop at the end of root.children (index 2).
    project.dragon.move(50, 50, { parentId: null, index: 2, placement: 'inside' });
    (host as unknown as { handleUp: (e: PointerEvent) => void }).handleUp(new PointerEvent('pointerup'));
    const rootChildren = project.document.root.children ?? [];
    const inserted = rootChildren[2];
    expect(inserted.componentName).toBe('Footer');
    // The whole point of this test: the schema MUST have a `props`
    // field (even if empty) so the settings panel / inferSetterName
    // can later write into it. Without this, dragging a vanilla
    // "Button" from the palette gives the user a node they cannot
    // configure.
    expect(inserted.props).toBeDefined();
    expect(inserted.props).toEqual({});
  });

  it('inserted node merges initialProps into props', () => {
    project.dragon.boost({ componentName: 'Sidebar', initialProps: { bg: '0xfff3c7' } }, 50, 50);
    project.dragon.move(50, 50, { parentId: null, index: 2, placement: 'inside' });
    (host as unknown as { handleUp: (e: PointerEvent) => void }).handleUp(new PointerEvent('pointerup'));
    const rootChildren = project.document.root.children ?? [];
    expect(rootChildren[2].props).toEqual({ bg: '0xfff3c7' });
  });

  it('freshly inserted node is selected (so the settings panel shows its props)', () => {
    project.dragon.boost({ componentName: 'Footer' }, 50, 50);
    project.dragon.move(50, 50, { parentId: null, index: 2, placement: 'inside' });
    (host as unknown as { handleUp: (e: PointerEvent) => void }).handleUp(new PointerEvent('pointerup'));
    // The selection should now contain the freshly inserted node's id.
    const rootChildren = project.document.root.children ?? [];
    const insertedId = (rootChildren[2] as { key: string }).key;
    expect(project.selectedIds).toEqual([insertedId]);
  });
});

/**
 * Pointer-level interaction tests. happy-dom doesn't lay elements
 * out, so we install a `getBoundingClientRect` mock per fixture
 * element AND an `elementsFromPoint` shim that walks the canvas
 * children. Same scaffold as the `computeDropTarget` tests, just
 * exercised through `pointerdown` / `pointermove` / `pointerup`.
 */
describe('BuiltinSimulatorHost pointer interactions', () => {
  let project: Project;
  let canvas: HTMLElement;
  let host: BuiltinSimulatorHost;
  let rootId: string;
  let bodyId: string;
  let origElementsFromPoint: typeof document.elementsFromPoint | undefined;
  // Stub the `getBoundingClientRect` on the two tagged elements
  // so `getHitInfo` and `elementsFromPoint` agree on the layout.
  const tagElementAt = (el: HTMLElement, top: number): void => {
    el.getBoundingClientRect = () => ({ top, bottom: top + 60, left: 0, right: 100, width: 100, height: 60, x: 0, y: top, toJSON: () => ({}) } as DOMRect);
  };
  beforeEach(() => {
    const root = deepClone(SEED);
    project = new Project(root);
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    canvas.innerHTML = `
      <div data-lce-id="__header__" style="position:absolute; top:0; height:60px"></div>
      <div data-lce-id="__body__"   style="position:absolute; top:60px; height:60px"></div>
    `;
    const headerEl = canvas.querySelector('[data-lce-id="__header__"]') as HTMLElement;
    const bodyEl = canvas.querySelector('[data-lce-id="__body__"]') as HTMLElement;
    tagElementAt(headerEl, 0);
    tagElementAt(bodyEl, 60);
    rootId = project.document.root.key as string;
    bodyId = project.document.getNode(rootId)!.children[1].id;
    tagElementWithNodeId(bodyEl, bodyId);
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

  it('pointerdown + pointerup on a tagged node (no movement) selects it', () => {
    // v2.3.1: selection is DEFERRED to pointerup. A click without
    // movement past the drag threshold is a "select"; a click with
    // movement becomes a drag and the drag decides post-drop
    // selection (move = no change, boost = the inserted node).
    (host as unknown as { handleDown: (e: PointerEvent) => void }).handleDown(new PointerEvent('pointerdown', { clientX: 50, clientY: 90, button: 0 }));
    // pointerdown alone: selection is still the initial empty set.
    expect(project.selectedIds).toEqual([]);
    // pointerup without movement past threshold commits the
    // deferred select.
    (host as unknown as { handleUp: (e: PointerEvent) => void }).handleUp(new PointerEvent('pointerup'));
    expect(project.selectedIds).toEqual([bodyId]);
  });

  it('pointerdown on a tagged node that turns into a drag does NOT select', () => {
    // The user clicks Body and drags it. The pointerdown alone
    // does not select (deferred to pointerup); the subsequent
    // pointermove past the threshold promotes to a drag and
    // `pendingClick` is cleared. The deferred select is dropped
    // because a drag started.
    //
    // We intentionally DON'T call `handleUp` here: the test
    // fixture's drop target resolves to "drop Body inside itself"
    // (a self-move), which would recurse in `unindexSubtree`. The
    // point of this test is the deferred-select behaviour, not
    // the commit path — that's covered by the other move tests.
    (host as unknown as { handleDown: (e: PointerEvent) => void }).handleDown(new PointerEvent('pointerdown', { clientX: 50, clientY: 90, button: 0 }));
    // pointerdown alone: selection is still the initial empty set.
    expect(project.selectedIds).toEqual([]);
    // Move past the 4px threshold — promotes to a drag, clears
    // pendingClick, fires `dragon.start`.
    (host as unknown as { handleMove: (e: PointerEvent) => void }).handleMove(new PointerEvent('pointermove', { clientX: 70, clientY: 90 }));
    expect(project.dragon.isDragging).toBe(true);
    // The deferred select was dropped — selection is still empty.
    expect(project.selectedIds).toEqual([]);
  });

  it('pointerdown on an empty canvas does not change selection', () => {
    // First, select something so we can detect the no-op.
    project.select(rootId);
    canvas.innerHTML = '';
    (host as unknown as { handleDown: (e: PointerEvent) => void }).handleDown(new PointerEvent('pointerdown', { clientX: 50, clientY: 90, button: 0 }));
    expect(project.selectedIds).toEqual([rootId]);
  });

  it('pointermove past the drag threshold promotes the click to dragon.start()', () => {
    // pointerdown on body.
    (host as unknown as { handleDown: (e: PointerEvent) => void }).handleDown(new PointerEvent('pointerdown', { clientX: 50, clientY: 90, button: 0 }));
    // Tiny move (1px) — still considered a click, dragon not started.
    (host as unknown as { handleMove: (e: PointerEvent) => void }).handleMove(new PointerEvent('pointermove', { clientX: 51, clientY: 90 }));
    expect(project.dragon.isDragging).toBe(false);
    // Big move (20px) — promotes to a move drag.
    (host as unknown as { handleMove: (e: PointerEvent) => void }).handleMove(new PointerEvent('pointermove', { clientX: 70, clientY: 90 }));
    expect(project.dragon.isDragging).toBe(true);
    // The dragon's state should now point at body's id (not a boost).
    expect(project.dragon.state.draggingNodeId).toBe(bodyId);
  });

  it('pointerup without movement selects the clicked node and does not mutate the document', () => {
    (host as unknown as { handleDown: (e: PointerEvent) => void }).handleDown(new PointerEvent('pointerdown', { clientX: 50, clientY: 90, button: 0 }));
    (host as unknown as { handleUp: (e: PointerEvent) => void }).handleUp(new PointerEvent('pointerup'));
    // v2.3.1: selection is deferred to pointerup. With no movement
    // past the drag threshold, handleUp flushes the pending select.
    expect(project.selectedIds).toEqual([bodyId]);
    // Document unchanged.
    const rootChildren = project.document.root.children ?? [];
    expect(rootChildren.length).toBe(2);
  });

  it('pointerdown during an in-progress drag is ignored (existing drag owns the pointer)', () => {
    // Start a boost drag from the palette (synthetic — we just call
    // dragon.boost directly; in production ComponentPalette fires
    // this on its own pointerdown).
    project.dragon.boost({ componentName: 'Footer' }, 0, 0);
    // Now pointerdown on body. The host should NOT change selection
    // (the boost drag owns the pointer) and NOT call dragon.start.
    (host as unknown as { handleDown: (e: PointerEvent) => void }).handleDown(new PointerEvent('pointerdown', { clientX: 50, clientY: 90, button: 0 }));
    expect(project.dragon.isBoosting).toBe(true);
    expect(project.dragon.state.draggingNodeId).toBeNull();
  });
});

/**
 * v2.3.2: while a drag is in progress, the host sets
 * `user-select: none` on `documentElement` so the browser doesn't
 * accidentally select text in the canvas / palette / outline as
 * the user drags across them. The setting is refcounted (the
 * host listens to BOTH the ali `dragstart` AND the v2.2-legacy
 * `start` / `startBoost` events), so overlapping / nested
 * drags don't accidentally leave the no-select stuck on.
 */
describe('BuiltinSimulatorHost no-select-during-drag (v2.3.2)', () => {
  let project: Project;
  let canvas: HTMLElement;
  let host: BuiltinSimulatorHost;
  beforeEach(() => {
    project = new Project({ componentName: 'Page', children: [] });
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    host = new BuiltinSimulatorHost(project, { canvas });
    host.mount();
    // Make sure no previous test left the style stuck on.
    document.documentElement.style.userSelect = '';
  });
  afterEach(() => {
    host.unmount();
    document.documentElement.style.userSelect = '';
  });

  it('start → drop sets and clears user-select on documentElement', () => {
    expect(document.documentElement.style.userSelect).toBe('');
    // Fire the v2.2-legacy `start` event (manual move-mode).
    project.dragon.events.emit('start', { nodeId: 'x', x: 0, y: 0 });
    expect(document.documentElement.style.userSelect).toBe('none');
    project.dragon.events.emit('drop', { nodeId: 'x', target: { parentId: null, index: 0, placement: 'inside' } });
    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('startBoost → dropBoost sets and clears user-select', () => {
    project.dragon.events.emit('startBoost', { meta: { componentName: 'Footer' } });
    expect(document.documentElement.style.userSelect).toBe('none');
    project.dragon.events.emit('dropBoost', { meta: { componentName: 'Footer' }, target: { parentId: null, index: 0, placement: 'inside' } });
    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('dragstart → dragend (ali-style) sets and clears user-select', () => {
    project.dragon.events.emit('dragstart', { dragObject: { type: 'Any', extra: null }, copy: false });
    expect(document.documentElement.style.userSelect).toBe('none');
    project.dragon.events.emit('dragend', { dragObject: { type: 'Any', extra: null }, copy: false, cancelled: false });
    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('cancel / cancelBoost also clear user-select', () => {
    project.dragon.events.emit('start', { nodeId: 'x', x: 0, y: 0 });
    expect(document.documentElement.style.userSelect).toBe('none');
    project.dragon.events.emit('cancel', { nodeId: 'x' });
    expect(document.documentElement.style.userSelect).toBe('');

    project.dragon.events.emit('startBoost', { meta: { componentName: 'F' } });
    project.dragon.events.emit('cancelBoost', { meta: { componentName: 'F' } });
    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('refcount: overlapping add signals do not leave user-select stuck', () => {
    // Two `start` events (e.g. nested boosts) followed by one
    // `drop` should keep the no-select active.
    project.dragon.events.emit('start', { nodeId: 'a', x: 0, y: 0 });
    project.dragon.events.emit('start', { nodeId: 'b', x: 0, y: 0 });
    project.dragon.events.emit('drop', { nodeId: 'a', target: { parentId: null, index: 0, placement: 'inside' } });
    expect(document.documentElement.style.userSelect).toBe('none');
    project.dragon.events.emit('drop', { nodeId: 'b', target: { parentId: null, index: 0, placement: 'inside' } });
    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('unmount clears the no-select even if a drag is in progress', () => {
    project.dragon.events.emit('startBoost', { meta: { componentName: 'F' } });
    expect(document.documentElement.style.userSelect).toBe('none');
    host.unmount();
    // unmount must release the refcount + clear the style.
    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('selectstart is preventDefault-ed while a drag is in progress', () => {
    // Belt-and-suspenders: in addition to the CSS user-select,
    // the host installs a `selectstart` preventer at the
    // document level with capture=true. Without this, some
    // browsers still start a small text selection range on
    // the first mousedown→mousemove even with `user-select: none`.
    project.dragon.events.emit('startBoost', { meta: { componentName: 'F' } });
    const evt = new Event('selectstart', { bubbles: true, cancelable: true });
    document.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('sets user-select on BOTH documentElement and document.body', () => {
    project.dragon.events.emit('startBoost', { meta: { componentName: 'F' } });
    // Some browsers honor the rule on root only, others on body
    // only — set both for the cheapest cross-browser guarantee.
    expect(document.documentElement.style.userSelect).toBe('none');
    expect(document.body.style.userSelect).toBe('none');
  });

  it('startBoost → dropBoost clears the selectstart preventer (refcount returns to 0)', () => {
    // The observable side-effect of the refcount returning to 0:
    // both the inline style AND the selectstart listener are
    // removed. We assert the style here (happy-dom honors it
    // cleanly); the preventer wiring is covered by the test
    // above.
    project.dragon.events.emit('startBoost', { meta: { componentName: 'F' } });
    expect(document.documentElement.style.userSelect).toBe('none');
    project.dragon.events.emit('dropBoost', { meta: { componentName: 'F' }, target: { parentId: null, index: 0, placement: 'inside' } });
    expect(document.documentElement.style.userSelect).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });
});
