import { describe, it, expect, beforeAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { deepClone } from '@monbolc/lowcode-utils';
import { Project } from '@monbolc/lowcode-designer';
import { Skeleton } from '../src/skeleton';
import { ComponentPalette } from '../src/component-palette';
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

const COMPONENTS: Record<string, unknown> = {
  Header: () => null,
  Footer: () => null,
  Button: () => null,
};

describe('Skeleton', () => {
  it('renders three pane headers (Outline / canvas / Settings)', () => {
    const project = new Project(deepClone(SEED));
    render(<Skeleton project={project} components={{}} />);
    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('exposes a Project that owns the document', () => {
    const project = new Project(deepClone(SEED));
    render(<Skeleton project={project} components={{}} />);
    // Sanity: the project still has its root accessible from outside
    expect(project.document.root.componentName).toBe('Page');
    // The skeleton subscribes to the document events
    expect(typeof project.document.events.on).toBe('function');
  });

  // P2.3 — selection overlay wiring. The Skeleton must mount the
  // Overlays component inside the canvas pane so the dashed border
  // appears on the selected node. happy-dom doesn't actually measure
  // (no layout), so we can't verify the border's position; we just
  // verify the Overlays effect runs without throwing and the
  // selectedIds state flows through.
  it('mounts the Overlays component (no throw on render with selection)', () => {
    const project = new Project(deepClone(SEED));
    const root = project.document.root;
    const a = project.document.getNode(root.key as string)!.children[0];
    project.select(a.id);

    // Render should not throw with a non-null selectedIds.
    expect(() => render(<Skeleton project={project} components={{}} />)).not.toThrow();
    expect(project.selectedIds).toContain(a.id);
  });

  // L4 — left view switching. The default leftArea is a thin icon
  // strip with one button per built-in LeftView. Clicking the
  // "Components" button should switch the left panel body from
  // the outline tree to the component palette, and the header
  // label should follow.
  it('renders a default leftArea with view switcher buttons', () => {
    const project = new Project(deepClone(SEED));
    render(<Skeleton project={project} components={COMPONENTS} />);
    // Both built-in views should have a button in the default icon
    // strip. The buttons are matched by their `title` attribute.
    expect(screen.getByTitle('Outline view')).toBeInTheDocument();
    expect(screen.getByTitle('Component palette')).toBeInTheDocument();
  });

  it('switches the left panel from Outline to Components on click', () => {
    const project = new Project(deepClone(SEED));
    render(<Skeleton project={project} components={COMPONENTS} />);
    // Initially: outline is active, header reads "Outline".
    expect(screen.getAllByText('Outline').length).toBeGreaterThan(0);
    // The palette's draggable rows are NOT rendered yet.
    expect(screen.queryByTitle(/Drag to canvas/)).toBeNull();
    // Click the components switcher button.
    fireEvent.click(screen.getByTitle('Component palette'));
    // Header should now read "Components", and the palette rows
    // should be present.
    expect(screen.getByText('Components')).toBeInTheDocument();
    // Each component should appear as a draggable row (matched
    // by the title pattern the palette uses).
    expect(screen.getAllByTitle(/Drag to canvas/).length).toBe(3);
  });

  it('notifies the host when the left view changes (controlled mode)', () => {
    const project = new Project(deepClone(SEED));
    let last: string | null = null;
    render(
      <Skeleton
        project={project}
        components={COMPONENTS}
        onLeftViewChange={(v) => { last = v; }}
      />,
    );
    fireEvent.click(screen.getByTitle('Component palette'));
    expect(last).toBe('components');
  });
});

describe('ComponentPalette', () => {
  it('renders one draggable row per registered component', () => {
    const project = new Project(deepClone(SEED));
    render(<ComponentPalette project={project} components={COMPONENTS} />);
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getAllByTitle(/Drag to canvas/).length).toBe(3);
  });

  it('shows an empty-state hint when no components are registered', () => {
    const project = new Project(deepClone(SEED));
    render(<ComponentPalette project={project} components={{}} />);
    expect(screen.getByText(/No components registered/)).toBeInTheDocument();
  });

  it('emits a boost on pointerdown', () => {
    const project = new Project(deepClone(SEED));
    let captured: { componentName: string } | null = null;
    project.dragon.events.on('startBoost', (e) => { captured = e.meta; });
    render(<ComponentPalette project={project} components={COMPONENTS} />);
    // First draggable row is "Button" (alphabetical sort).
    const buttonRow = screen.getByText('Button').closest('[title]') as HTMLElement;
    fireEvent.pointerDown(buttonRow, { clientX: 10, clientY: 20 });
    expect(captured).not.toBeNull();
    expect(captured!.componentName).toBe('Button');
    expect(project.dragon.isBoosting).toBe(true);
  });
});
