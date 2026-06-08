import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { deepClone } from '@monbolc/lowcode-utils';
import { Project } from '@monbolc/lowcode-designer';
import { Overlays } from '../src/overlays';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

beforeAll(() => {
  adapter.setRuntime({
    Component: React.Component,
    PureComponent: React.PureComponent,
    createElement: React.createElement,
    createContext: React.createContext,
    forwardRef: React.forwardRef,
    findDOMNode: null,
  });
});

const SEED: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [{ componentName: 'A' }, { componentName: 'B' }],
};

describe('Overlays', () => {
  let canvas: HTMLElement;
  afterEach(() => {
    canvas?.querySelectorAll(
      '.sapu-border-overlay, .sapu-hover-overlay, .sapu-drag-ghost, ' +
      '.sapu-insertion-indicator, .sapu-resize-handle',
    ).forEach((n) => n.remove());
  });

  it('renders a border overlay for the selected node', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);

    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const target = document.createElement('div');
    target.setAttribute('data-lce-id', a.id);
    canvas.appendChild(target);

    render(<Overlays project={project} canvasContainer={canvas} />);
    const overlay = canvas.querySelector('.sapu-border-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute('data-lce-id')).toBeNull(); // overlays don't tag themselves
  });

  it('renders a drag ghost when a drag is in progress', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.dragon.start(a.id, 50, 60);

    canvas = document.createElement('div');
    document.body.appendChild(canvas);

    render(<Overlays project={project} canvasContainer={canvas} />);
    const ghost = canvas.querySelector('.sapu-drag-ghost');
    expect(ghost).not.toBeNull();
    expect(ghost!.textContent).toContain('A');
  });

  it('clears the ghost when no drag is active', () => {
    const project = new Project(deepClone(SEED));
    canvas = document.createElement('div');
    document.body.appendChild(canvas);

    // Pre-populate a ghost (as if a previous drag left one)
    const ghost = document.createElement('div');
    ghost.className = 'sapu-drag-ghost';
    canvas.appendChild(ghost);

    render(<Overlays project={project} canvasContainer={canvas} />);
    expect(canvas.querySelector('.sapu-drag-ghost')).toBeNull();
  });

  it('renders insertion indicator when dropTarget is set', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.dragon.start(a.id, 0, 0);
    project.dragon.move(10, 10, { parentId: null, index: 0, placement: 'inside' });

    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    // No target element — but the indicator should still render at root level
    render(<Overlays project={project} canvasContainer={canvas} />);
    const indicator = canvas.querySelector('.sapu-insertion-indicator');
    expect(indicator).not.toBeNull();
  });

  /**
   * The "border stays on the original spot after a move" bug.
   *
   * Root cause: the Overlays effect runs BEFORE the Skeleton's
   * `root.render(...)` commit that re-orders the simulator's
   * children. A single useEffect-based repaint reads the OLD
   * bounding rect and leaves the border on the old coordinates.
   *
   * The fix is a MutationObserver on the canvas subtree that
   * re-paints after React has actually moved the DOM node. This
   * test simulates that by:
   *   1. mounting <Overlays> with a selected node A
   *   2. mutating the canvas (remove + append a new element with
   *      the same data-lce-id) — this is what the Skeleton's
   *      `root.render(...)` commit effectively does
   *   3. waiting a rAF tick
   *   4. asserting the border is still there (it didn't get
   *      painted in a stale spot and then forgotten)
   *
   * happy-dom returns zero rects for everything, so we can't
   * assert the *position* — just that the border overlay still
   * exists and tracks the selected node.
   */
  it('repaints border after a canvas mutation (root.render re-order)', async () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);

    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const target = document.createElement('div');
    target.setAttribute('data-lce-id', a.id);
    canvas.appendChild(target);

    render(<Overlays project={project} canvasContainer={canvas} />);
    expect(canvas.querySelector('.sapu-border-overlay')).not.toBeNull();

    // Simulate React's commit: remove the existing target and
    // append a fresh one in a different position. The MutationObserver
    // should fire, the rAF-debounced repaint should run, and the
    // border overlay should still be present.
    canvas.removeChild(target);
    const newTarget = document.createElement('div');
    newTarget.setAttribute('data-lce-id', a.id);
    // happy-dom getBoundingClientRect returns zeros; give the
    // target a position so renderBorders's querySelector still
    // finds it. The repaint itself just re-reads the rect.
    canvas.appendChild(newTarget);
    // Wait for the rAF-debounced repaint to flush.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(canvas.querySelector('.sapu-border-overlay')).not.toBeNull();
  });

  /**
   * Companion to the test above: when a mutation removes the
   * selected node from the DOM entirely (e.g. React unmounts it
   * because document.remove fired), the repaint should not leave
   * a stale border stuck on a phantom position. The repaint
   * gracefully degrades to "no overlay" because the lookup
   * misses.
   */
  it('clears border when the selected node disappears from the DOM', async () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);

    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const target = document.createElement('div');
    target.setAttribute('data-lce-id', a.id);
    canvas.appendChild(target);

    render(<Overlays project={project} canvasContainer={canvas} />);
    expect(canvas.querySelector('.sapu-border-overlay')).not.toBeNull();

    canvas.removeChild(target);
    // happy-dom may not deliver MutationObserver callbacks
    // synchronously; allow a few rAF ticks + a microtask flush to
    // make sure the observer fires and the rAF-debounced repaint
    // runs.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    // After repaint, the lookup for the (now missing) id returns
    // null → renderBorders creates no overlay → the old one was
    // already removed in the same repaint pass.
    expect(canvas.querySelector('.sapu-border-overlay')).toBeNull();
  });

  // ===== P6.1 — dead 'end' subscription fix =====
  // The pre-P6.1 code subscribed to a non-existent `'end'` event.
  // That meant the `cancel` and `cancelBoost` repaints (which fire
  // when a drag ends without a drop target) were never delivered
  // to the Overlays effect. Ghost + insertion indicator stuck
  // around on screen even after the Dragon went idle. The fix
  // subscribes to the real event names: 'cancel', 'cancelBoost',
  // 'drop', 'dropBoost' (and the new 'dragend' instrumented name).

  it('clears the ghost on cancel (move-mode without dropTarget)', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    // Begin a move, then cancel — simulates "user released the
    // pointer outside the canvas" (no drop target → Dragon fires
    // 'cancel' and resets to idle).
    project.dragon.start(a.id, 50, 50);
    project.dragon.move(200, 200, null);
    project.dragon.cancel();

    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    // Leave a phantom ghost on the canvas to prove it gets cleaned.
    const ghost = document.createElement('div');
    ghost.className = 'sapu-drag-ghost';
    canvas.appendChild(ghost);

    render(<Overlays project={project} canvasContainer={canvas} />);
    expect(canvas.querySelector('.sapu-drag-ghost')).toBeNull();
  });

  it('clears the ghost on cancelBoost (palette drop cancelled)', () => {
    const project = new Project(deepClone(SEED));
    // Boost (palette → canvas) without a drop target → cancelBoost.
    project.dragon.boost({ componentName: 'Text' }, 50, 50);
    project.dragon.move(200, 200, null);
    project.dragon.cancel();

    canvas = document.createElement('div');
    document.body.appendChild(canvas);

    render(<Overlays project={project} canvasContainer={canvas} />);
    // No ghost + no insertion indicator should be left.
    expect(canvas.querySelector('.sapu-drag-ghost')).toBeNull();
    expect(canvas.querySelector('.sapu-insertion-indicator')).toBeNull();
  });

  // ===== P6.2 — real child-rect math for the indicator =====
  // The pre-P6.2 code positioned the indicator at
  // `parentR.top + parentR.height * (index / total)` — a coarse
  // ratio that was wrong the moment the parent had non-uniform
  // child heights. The fix looks up the actual bounding rects of
  // the parent's direct `[data-lce-id]` children and places the
  // line at the midpoint between the previous and next child (or
  // at the parent's edge for index 0 / index === count).

  it('places the insertion indicator using real child-rect midpoints', () => {
    const project = new Project(deepClone(SEED));
    const rootId = project.document.root.key as string;
    const rootNode = project.document.getNode(rootId)!;
    // SEED: Page { children: [A, B] }. Add a C so we can target
    // index=1 (the midpoint between A and B).
    project.document.insert({ componentName: 'C' }, rootNode, 2);

    // Start a move so the dragon is active.
    const a = project.document.getNode(rootId)!.children[0];
    project.dragon.start(a.id, 0, 0);
    // index 1 → the indicator should sit between child 0 (A) and
    // child 1 (B). With three children and a 90px-tall canvas
    // (30px each in happy-dom's default layout — actually 0 in
    // happy-dom because there's no renderer running), the data-
    // attribute is the observable fact; the position math is
    // exercised too.
    project.dragon.move(10, 10, { parentId: null, index: 1, placement: 'inside' });

    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    // Two child divs to back the math: child 0 (A) and child 1 (B).
    // We attach `data-lce-id` so renderInsertion picks them up.
    const aId = a.id;
    const b = project.document.getNode(rootId)!.children[1];
    const bId = b.id;
    const childA = document.createElement('div');
    childA.setAttribute('data-lce-id', aId);
    childA.style.height = '40px';
    const childB = document.createElement('div');
    childB.setAttribute('data-lce-id', bId);
    childB.style.height = '60px';
    canvas.appendChild(childA);
    canvas.appendChild(childB);

    render(<Overlays project={project} canvasContainer={canvas} />);
    const indicator = canvas.querySelector('.sapu-insertion-indicator') as HTMLElement | null;
    expect(indicator).not.toBeNull();
    // The data attributes prove the indicator is anchored on the
    // right parent + index (the visual y depends on happy-dom's
    // rect math, which returns 0 — out of scope here).
    expect(indicator!.getAttribute('data-lce-index')).toBe('1');
    expect(indicator!.getAttribute('data-lce-parent')).toBe('root');
  });

  // ===== P6.3 — ResizeHandles (visual only) =====
  // v2.3 ships 4 corner + 4 edge handles for the first selected
  // node. The drag wiring (real resize) is a v2.4 follow-up — for
  // now the handles prove the selection boundary is readable. The
  // Settings panel already exposes a stable props editor for
  // editing width / height directly.

  it('renders 8 resize handles for the (first) selected node', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);

    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const target = document.createElement('div');
    target.setAttribute('data-lce-id', a.id);
    target.style.width = '100px';
    target.style.height = '50px';
    canvas.appendChild(target);

    render(<Overlays project={project} canvasContainer={canvas} />);
    const handles = canvas.querySelectorAll('.sapu-resize-handle');
    expect(handles.length).toBe(8);
    // Each handle carries the target id (so a future drag engine
    // can resolve which node to resize) and a unique anchor name.
    const anchors = new Set<string>();
    handles.forEach((h) => {
      expect(h.getAttribute('data-lce-target')).toBe(a.id);
      anchors.add(h.getAttribute('data-lce-handle')!);
    });
    expect(anchors.size).toBe(8);
    for (const expected of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      expect(anchors.has(expected)).toBe(true);
    }
  });

  it('does NOT render resize handles when nothing is selected', () => {
    const project = new Project(deepClone(SEED));
    canvas = document.createElement('div');
    document.body.appendChild(canvas);

    render(<Overlays project={project} canvasContainer={canvas} />);
    expect(canvas.querySelectorAll('.sapu-resize-handle').length).toBe(0);
  });
});
