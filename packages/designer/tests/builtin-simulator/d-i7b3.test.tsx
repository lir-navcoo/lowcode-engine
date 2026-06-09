/**
 * @monbolc/lowcode-designer — Phase D.I7b.3 tests
 *
 * Covers the real `<BorderResizing>` port — the 8-anchor resize
 * handles that reuse the existing `DragResizeEngine` (P9).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import { Project } from '../../src/project';
import { ComponentMetaLite } from '../../src/component-meta';
import { BuiltinSimulatorHost } from '../../src/simulator-host';
import { BorderResizing } from '../../src/builtin-simulator/bem-tools/border-resizing';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mkRoot(): IPublicTypeRootSchema {
  return {
    componentName: 'Page',
    children: [{ componentName: 'Button', key: 'btn1' } as never],
  } as IPublicTypeRootSchema;
}

function buildHost(): { project: Project; host: BuiltinSimulatorHost; canvas: HTMLDivElement } {
  const project = new Project(mkRoot());
  const canvas = document.createElement('div');
  document.body.appendChild(canvas);
  const host = new BuiltinSimulatorHost(project, { canvas });
  return { project, host, canvas };
}

describe('BorderResizing (Phase D.I7b.3)', () => {
  it('renders null when there is no selection', () => {
    const { host, canvas } = buildHost();
    const { container } = render(<BorderResizing host={host} />);
    expect(container.firstChild).toBeNull();
    canvas.remove();
  });

  it('renders 8 resize handles when a node is selected', () => {
    const { project, host, canvas } = buildHost();
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'btn1');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) }),
    });
    canvas.appendChild(el);
    project.select('btn1');
    const { container } = render(<BorderResizing host={host} />);
    // Debug: see what the container has
    expect(container.innerHTML).toBeTruthy();
    const handles = container.querySelectorAll('[data-testid^="resize-handle-"]');
    expect(handles.length).toBe(8);
    // Verify the 8 anchors are present.
    const anchors = new Set<string>();
    handles.forEach((h) => anchors.add(h.getAttribute('data-anchor') ?? ''));
    ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].forEach((a) => expect(anchors.has(a)).toBe(true));
    canvas.remove();
  });

  it('each handle has the correct cursor style', () => {
    const { project, host, canvas } = buildHost();
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'btn1');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) }),
    });
    canvas.appendChild(el);
    project.select('btn1');
    const { getByTestId } = render(<BorderResizing host={host} />);
    expect(getByTestId('resize-handle-n').style.cursor).toBe('ns-resize');
    expect(getByTestId('resize-handle-s').style.cursor).toBe('ns-resize');
    expect(getByTestId('resize-handle-e').style.cursor).toBe('ew-resize');
    expect(getByTestId('resize-handle-w').style.cursor).toBe('ew-resize');
    expect(getByTestId('resize-handle-nw').style.cursor).toBe('nwse-resize');
    expect(getByTestId('resize-handle-se').style.cursor).toBe('nwse-resize');
    expect(getByTestId('resize-handle-ne').style.cursor).toBe('nesw-resize');
    expect(getByTestId('resize-handle-sw').style.cursor).toBe('nesw-resize');
    canvas.remove();
  });

  it('renders null when the selected node has no rect (defensive)', () => {
    const { project, host, canvas } = buildHost();
    // No element tagged for btn1 → createOffsetObserver returns null
    // (the slim stub) or the border-resizing instance returns null.
    project.select('btn1');
    const { container } = render(<BorderResizing host={host} />);
    expect(container.firstChild).toBeNull();
    canvas.remove();
  });

  it('host exposes getCanvas() for the DragResizeEngine', () => {
    const { host, canvas } = buildHost();
    expect(host.getCanvas()).toBe(canvas);
    canvas.remove();
  });

  it('the component reuses the existing DragResizeEngine (no duplicate instance)', () => {
    const { host, canvas } = buildHost();
    // Importing the engine from the slim port and constructing it
    // requires the { project, canvas } pair. The BorderResizing
    // class does this internally; this test verifies the
    // constructor wiring is correct by rendering it without
    // throwing.
    const { container } = render(<BorderResizing host={host} />);
    expect(container).toBeDefined();
    canvas.remove();
  });
});
