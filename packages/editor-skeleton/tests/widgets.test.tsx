/**
 * @monbolc/lowcode-editor-skeleton — widget unit tests
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

import { adapter } from '@monbolc/lowcode-renderer-core';

import {
  SapuModal,
  SapuFloatingPanel,
  SapuToaster,
  createToastManager,
} from '../src/widgets';

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

describe('SapuModal (E: L4 widgets — Modal)', () => {
  it('renders the title and description when open', () => {
    render(
      <SapuModal
        open
        onOpenChange={() => undefined}
        title="Reset schema?"
        description="This clears all edits."
        confirmLabel="Reset"
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByText('Reset schema?')).toBeInTheDocument();
    expect(screen.getByText('This clears all edits.')).toBeInTheDocument();
    // The confirm button renders as a plain <button> with the label
    // text directly (not wrapped). getByRole is the safer match.
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('fires onConfirm and onOpenChange(false) when confirm is clicked', () => {
    let open = true;
    const onConfirm = vi.fn();
    const onOpenChange = (next: boolean) => { open = next; };
    render(
      <SapuModal
        open={open}
        onOpenChange={onOpenChange}
        title="Delete?"
        confirmLabel="Delete"
        tone="danger"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(open).toBe(false);
  });
});

// Use vi.fn() from vitest directly.
import { vi } from 'vitest';

describe('SapuFloatingPanel (E: L4 widgets — Panel primitive)', () => {
  it('renders the title in the title bar', () => {
    render(
      <SapuFloatingPanel title="Plugin: Color Picker" initialX={20} initialY={20}>
        <span>panel body</span>
      </SapuFloatingPanel>,
    );
    expect(screen.getByText('Plugin: Color Picker')).toBeInTheDocument();
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('fires onClose when the close button is clicked (when provided)', () => {
    const onClose = vi.fn();
    render(
      <SapuFloatingPanel title="X" onClose={onClose}>
        body
      </SapuFloatingPanel>,
    );
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render a close button when onClose is omitted', () => {
    render(<SapuFloatingPanel title="No close">body</SapuFloatingPanel>);
    expect(screen.queryByLabelText('Close panel')).toBeNull();
  });
});

describe('createToastManager + SapuToaster (E: L4 widgets — Toast)', () => {
  it('push() returns an id and the manager exposes the item', () => {
    const m = createToastManager();
    const id = m.push({ title: 'Saved', tone: 'success' });
    expect(typeof id).toBe('string');
    expect(m.items.length).toBe(1);
    expect(m.items[0].title).toBe('Saved');
  });

  it('dismiss(id) removes the item', () => {
    const m = createToastManager();
    const id = m.push({ title: 'A' });
    m.dismiss(id);
    expect(m.items.length).toBe(0);
  });

  it('clear() empties the list', () => {
    const m = createToastManager();
    m.push({ title: 'A' });
    m.push({ title: 'B' });
    m.clear();
    expect(m.items.length).toBe(0);
  });

  it('SapuToaster renders each item as a visible toast', () => {
    const m = createToastManager();
    m.push({ title: 'Schema saved' });
    m.push({ title: 'Reset done', tone: 'warning' });
    render(<SapuToaster manager={m} />);
    expect(screen.getByText('Schema saved')).toBeInTheDocument();
    expect(screen.getByText('Reset done')).toBeInTheDocument();
  });

  it('clicking the close button on a toast dismisses it', () => {
    const m = createToastManager();
    m.push({ title: 'Dismiss me' });
    render(<SapuToaster manager={m} />);
    const buttons = screen.getAllByLabelText('Dismiss toast');
    fireEvent.click(buttons[0]);
    expect(m.items.length).toBe(0);
  });
});
