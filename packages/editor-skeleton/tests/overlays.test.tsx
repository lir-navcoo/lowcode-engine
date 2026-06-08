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
    canvas?.querySelectorAll('.sapu-border-overlay, .sapu-hover-overlay, .sapu-drag-ghost, .sapu-insertion-indicator')
      .forEach((n) => n.remove());
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
});
