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
});
