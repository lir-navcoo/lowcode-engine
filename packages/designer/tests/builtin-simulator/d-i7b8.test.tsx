/**
 * @monbolc/lowcode-designer — Phase D.I7b.8 tests
 *
 * Covers the real `<ContextMenu>` port (BaseUI Menu) + the
 * `contextmenu` event listener on `BuiltinSimulatorHost`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { Project } from '../../src/project';
import { BuiltinSimulatorHost } from '../../src/simulator-host';
import { ContextMenu } from '../../src/builtin-simulator/context-menu';
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

describe('ContextMenu (Phase D.I7b.8)', () => {
  it('returns null when state is null (no menu open)', () => {
    const { host, canvas } = buildHost();
    const { container } = render(
      <ContextMenu host={host} state={null} onClose={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
    canvas.remove();
  });

  it('renders 7 default actions when state is set', () => {
    const { host, canvas } = buildHost();
    const state = { nodeId: 'btn1', x: 100, y: 200 };
    render(
      <ContextMenu host={host} state={state} onClose={() => undefined} />,
    );
    // The Menu's Popup is rendered into a Portal (document.body),
    // not the test container. Use document.querySelector to find
    // the items.
    const items = document.querySelectorAll('[data-testid^="context-menu-"]');
    expect(items.length).toBeGreaterThanOrEqual(7);
    // The expected actions: copy, paste-after, cut, duplicate,
    // insert-above, insert-below, delete (+ 2 separators).
    ['copy', 'paste-after', 'cut', 'duplicate', 'insert-above', 'insert-below', 'delete'].forEach((id) => {
      expect(document.querySelector(`[data-testid="context-menu-${id}"]`)).not.toBeNull();
    });
    canvas.remove();
  });

  it('clicking the Delete action calls RemoveCommand and closes the menu', () => {
    const { project, host, canvas } = buildHost();
    const onClose = vi.fn();
    const state = { nodeId: 'btn1', x: 100, y: 200 };
    render(
      <ContextMenu host={host} state={state} onClose={onClose} />,
    );
    const deleteBtn = document.querySelector('[data-testid="context-menu-delete"]') as HTMLElement;
    fireEvent.click(deleteBtn);
    // The slim port: the action runs, then onClose fires. The
    // RemoveCommand removes the node from the document.
    expect(project.document.getNode('btn1')).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
    canvas.remove();
  });

  it('clicking the Copy action calls ClipboardCommand (copy) and closes the menu', () => {
    const { project, host, canvas } = buildHost();
    const onClose = vi.fn();
    const state = { nodeId: 'btn1', x: 100, y: 200 };
    render(
      <ContextMenu host={host} state={state} onClose={onClose} />,
    );
    const copyBtn = document.querySelector('[data-testid="context-menu-copy"]') as HTMLElement;
    fireEvent.click(copyBtn);
    // The clipboard is set; the node is still in the document
    // (copy is a non-destructive op).
    expect(project.document.getNode('btn1')).toBeDefined();
    expect(onClose).toHaveBeenCalled();
    canvas.remove();
  });

  it('clicking the Duplicate action copies + pastes the node', () => {
    const { project, host, canvas } = buildHost();
    const onClose = vi.fn();
    const state = { nodeId: 'btn1', x: 100, y: 200 };
    render(
      <ContextMenu host={host} state={state} onClose={onClose} />,
    );
    const initialCount = (project.document.root.children ?? []).length;
    const dupBtn = document.querySelector('[data-testid="context-menu-duplicate"]') as HTMLElement;
    fireEvent.click(dupBtn);
    // After duplicate, the root has one more child.
    expect((project.document.root.children ?? []).length).toBe(initialCount + 1);
    expect(onClose).toHaveBeenCalled();
    canvas.remove();
  });

  it('host.getContextMenuState returns the current state', () => {
    const { host, canvas } = buildHost();
    expect(host.getContextMenuState()).toBeNull();
    host.setContextMenuState({ nodeId: 'btn1', x: 50, y: 50 });
    expect(host.getContextMenuState()).toEqual({ nodeId: 'btn1', x: 50, y: 50 });
    host.setContextMenuState(null);
    expect(host.getContextMenuState()).toBeNull();
    canvas.remove();
  });

  it('the canvas contextmenu listener opens the menu with the cursor position', () => {
    const { project, host, canvas } = buildHost();
    host.mount();
    // Append a tagged element so the contextmenu can find a node.
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'btn1');
    canvas.appendChild(el);
    // Synthesize a contextmenu event on the tagged element.
    const evt = new MouseEvent('contextmenu', { bubbles: true, clientX: 123, clientY: 456 });
    el.dispatchEvent(evt);
    const state = host.getContextMenuState();
    expect(state).not.toBeNull();
    expect(state!.nodeId).toBe('btn1');
    expect(state!.x).toBe(123);
    expect(state!.y).toBe(456);
    host.unmount();
    canvas.remove();
  });

  it('the contextmenu listener does NOT open the menu on empty canvas (no data-lce-id)', () => {
    const { host, canvas } = buildHost();
    host.mount();
    // No tagged element under the cursor.
    const evt = new MouseEvent('contextmenu', { bubbles: true, clientX: 0, clientY: 0 });
    canvas.dispatchEvent(evt);
    expect(host.getContextMenuState()).toBeNull();
    host.unmount();
    canvas.remove();
  });
});
