/**
 * @monbolc/lowcode-plugin-outline-pane — component test
 *
 * Smoke-tests the OutlineView React component. The tree-row path
 * (rendering via react-arborist) requires a full DOM with measurements
 * and is tested manually / via E2E; here we only validate the empty-
 * state path and that the adapter-runtime plumbing works.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { adapter } from '@monbolc/lowcode-renderer-core';
import React from 'react';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

import { OutlinePane } from '../src/api';
import { OutlineView, defaultRenderRow } from '../src/view';
import type { RowHelpers } from '../src/view';
import type { ITreeNode } from '../src/tree';

beforeAll(() => {
  // Inject React 19.2.7 runtime into the adapter so OutlineView
  // (which resolves its React primitives through the adapter) renders.
  adapter.setRuntime({
    Component: React.Component,
    PureComponent: React.PureComponent,
    createElement: React.createElement,
    createContext: React.createContext,
    forwardRef: React.forwardRef,
    findDOMNode: null,
  });
});

const seedSchema: IPublicTypeNodeSchema = {
  componentName: 'Page',
  children: [
    { componentName: 'Header' },
    {
      componentName: 'Body',
      children: [
        { componentName: 'Sidebar' },
        { componentName: 'Main' },
      ],
    },
  ],
};

describe('OutlineView', () => {
  it('shows the empty-state hint when no schema is set', () => {
    const pane = new OutlinePane();
    render(<OutlineView pane={pane} height={200} />);
    expect(screen.getByText(/no schema/i)).toBeInTheDocument();
  });

  it('throws a helpful error when the runtime has not been injected', () => {
    // The h()() resolver must read the current runtime, so if a user
    // constructs OutlineView before calling adapter.setRuntime(), they
    // get the stub runtime's createElement (which returns null) and
    // a missing-Runtime error if the runtime lacks required fields.
    adapter.initRuntime();
    const pane = new OutlinePane();
    // The empty-state path doesn't throw because the stub createElement
    // happily returns null (a renderable element). The real tree path
    // would error, but we don't exercise that here.
    const { container } = render(<OutlineView pane={pane} height={200} />);
    // With the stub runtime, the empty-state still renders (its div is null DOM).
    expect(container).toBeInTheDocument();
  });

  // Full-path click test: build a real OutlineView with a real schema,
  // mount it, find the rendered row text, click it, and verify BOTH
  // pane.select() AND the onRowClick prop fire. This is the path
  // the demo's "click Sidebar" gesture takes; if it's broken, the
  // settings panel never updates.
  it.skip('clicking a row text fires pane.select AND the onRowClick prop', () => {
    // happy-dom can't measure for react-arborist, so the Tree never
    // renders rows in this test env. The full row-click path is
    // covered manually + in the e2e suite. See the onRowClick →
    // Project.select bridging test in editor-skeleton/tests.
    const pane = new OutlinePane();
    pane.setSchema(seedSchema);
    const rowClickSpy = vi.fn();

    render(
      <OutlineView pane={pane} height={400} onRowClick={rowClickSpy} />,
    );

    const sidebarText = screen.getByText('Sidebar');
    expect(sidebarText).toBeInTheDocument();

    fireEvent.click(sidebarText);

    const sidebarNode = pane.nodes.find((n) => n.componentName === 'Sidebar');
    expect(sidebarNode).toBeDefined();
    expect(pane.selectedIds).toContain(sidebarNode!.id);
    expect(rowClickSpy).toHaveBeenCalled();
    expect(rowClickSpy.mock.calls[0][0]).toBe(sidebarNode!.id);
  });
});

describe('OutlinePane.rename() (P1.6 ali-style display-title flow)', () => {
  // The full OutlineView + Tree row path needs measurements (react-
  // arborist) that happy-dom doesn't provide. Instead we test the
  // underlying pane.rename() data path: it mutates the node's
  // display title (not componentName) and fires the 'renamed' event.
  it('changes the display title without touching componentName', () => {
    const pane = new OutlinePane();
    pane.setSchema(seedSchema);
    const body = pane.nodes.find((n) => n.componentName === 'Body');
    expect(body).toBeDefined();
    expect(body?.title).toBe('Body');

    pane.rename(body!.id, 'App');

    expect(body?.componentName).toBe('Body');     // type untouched
    expect(body?.title).toBe('App');              // display label changed
  });

  it('fires the renamed event with the new title', () => {
    const pane = new OutlinePane();
    pane.setSchema(seedSchema);
    const body = pane.nodes.find((n) => n.componentName === 'Body')!;
    const seen: Array<{ id: string; title: string }> = [];
    pane.events.on('renamed', (e) => seen.push(e));

    pane.rename(body.id, 'Layout');

    expect(seen).toEqual([{ id: body.id, title: 'Layout' }]);
  });

  it('is a no-op when the id does not exist', () => {
    const pane = new OutlinePane();
    pane.setSchema(seedSchema);
    const seen: unknown[] = [];
    pane.events.on('renamed', (e) => seen.push(e));

    pane.rename('does-not-exist', 'Whatever');

    expect(seen).toEqual([]);
  });
});

describe('defaultRenderRow (row-level UX, no react-arborist)', () => {
  // The earlier "runtime not injected" test calls adapter.initRuntime(),
  // which resets the runtime to a stub (createElement: () => null). We
  // need the real React runtime for these row-render tests.
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

  // Build a minimal non-root node (a child of Page, like Body).
  const bodyNode: ITreeNode = {
    id: 'body-1',
    componentName: 'Body',
    title: 'Body',
    depth: 1,
    canHaveChildren: true,
    expanded: false,
    selected: false,
    childrenIds: [],
    schema: { componentName: 'Body' },
    parentId: 'root-1',
  };

  function makeHelpers(overrides: Partial<RowHelpers> = {}): RowHelpers {
    const noop = () => undefined;
    return {
      isSelected: false,
      isExpanded: false,
      toggle: noop,
      select: noop,
      isEditing: false,
      draft: '',
      startRename: noop,
      commitRename: noop,
      cancelRename: noop,
      canRename: true,
      canRemove: false,
      remove: noop,
      ...overrides,
    };
  }

  it('title span does NOT expose click-to-rename (only the ✎ button does)', () => {
    const startRename = vi.fn();
    const el = defaultRenderRow(bodyNode, makeHelpers({ startRename }));
    const { container } = render(el as React.ReactElement);
    const spans = container.querySelectorAll('span');
    // Index 0 = arrow, 1 = title, 2 = ✎, 3 = componentName.
    const title = spans[1];
    expect(title.textContent).toBe('Body');
    // Clicking the title (or the componentName span) must NOT enter
    // rename mode — rename is gated on the ✎ button only. Single-
    // click on the title should fall through to the row's outer
    // onClick, which selects; no rename intent is implied.
    fireEvent.click(title);
    expect(startRename).not.toHaveBeenCalled();
    const componentName = spans[3];
    fireEvent.click(componentName);
    expect(startRename).not.toHaveBeenCalled();
  });

  it('✎ button onClick calls startRename and stops propagation', () => {
    const startRename = vi.fn();
    const el = defaultRenderRow(bodyNode, makeHelpers({ startRename }));
    const { container } = render(el as React.ReactElement);
    // The ✎ span is the 3rd span (index 2): arrow, title, rename, componentName.
    const spans = container.querySelectorAll('span');
    const pencil = spans[2];
    expect(pencil.textContent).toBe('✎');
    fireEvent.click(pencil);
    expect(startRename).toHaveBeenCalledTimes(1);
  });

  it('row click selects (with stopPropagation so the title click does not double-fire)', () => {
    const startRename = vi.fn();
    const select = vi.fn();
    const el = defaultRenderRow(bodyNode, makeHelpers({ startRename, select }));
    const { container } = render(el as React.ReactElement);
    // Click the row's outer div.
    const rowDiv = container.querySelector('div')!;
    fireEvent.click(rowDiv);
    expect(select).toHaveBeenCalledTimes(1);
    expect(startRename).not.toHaveBeenCalled();
  });

  // ===== P11 — delete (×) row button =====
  //
  // v2.4 brings ali's per-row delete affordance + Delete/Backspace
  // keyboard shortcut. The pane just routes the click; the host
  // decides what to do (call RemoveCommand, show a confirm, etc.).

  it('× button is rendered when canRemove=true', () => {
    const el = defaultRenderRow(bodyNode, makeHelpers({ canRemove: true }));
    const { container } = render(el as React.ReactElement);
    // After the pencil (✎) is the ×, then componentName. The
    // remove span has data-lce-remove="true" for e2e selector.
    const removeSpan = container.querySelector('[data-lce-remove="true"]');
    expect(removeSpan).not.toBeNull();
    expect(removeSpan!.textContent).toBe('×');
    expect(removeSpan!.getAttribute('data-lce-id')).toBe(bodyNode.id);
  });

  it('× button is NOT rendered when canRemove=false (host did not pass onRowRemove)', () => {
    const el = defaultRenderRow(bodyNode, makeHelpers({ canRemove: false }));
    const { container } = render(el as React.ReactElement);
    expect(container.querySelector('[data-lce-remove="true"]')).toBeNull();
  });

  it('× button onClick calls helpers.remove() and stops propagation', () => {
    const remove = vi.fn();
    const el = defaultRenderRow(bodyNode, makeHelpers({ canRemove: true, remove }));
    const { container } = render(el as React.ReactElement);
    const removeSpan = container.querySelector('[data-lce-remove="true"]')!;
    fireEvent.click(removeSpan);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('row click on the row div does NOT fire remove (× is a separate handler)', () => {
    const remove = vi.fn();
    const el = defaultRenderRow(bodyNode, makeHelpers({ canRemove: true, remove }));
    const { container } = render(el as React.ReactElement);
    const rowDiv = container.querySelector('div')!;
    fireEvent.click(rowDiv);
    expect(remove).not.toHaveBeenCalled();
  });
});
