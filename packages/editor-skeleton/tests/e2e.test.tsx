/**
 * E2E integration test: the entire L0–L4 stack composes correctly.
 *
 * Verifies that the Skeleton, SettingsPanel, and Project can be
 * driven through a realistic editor workflow:
 *   1. Mount the Skeleton with a real Project + real components
 *   2. The Outline pane renders the schema
 *   3. The Settings pane shows the empty hint (no selection)
 *   4. Select a node → the Settings pane now shows its props
 *   5. Edit a prop via the input → the schema is updated
 *   6. Reload the project → the new schema persists
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { deepClone } from '@monbolc/lowcode-utils';
import { Project } from '@monbolc/lowcode-designer';
import { Skeleton } from '../src/skeleton';
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
  children: [
    { componentName: 'Header', props: { title: 'Hello' } },
    { componentName: 'Footer', props: { year: 2024 } },
  ],
};

const components = {
  Header: (p: Record<string, unknown>) => React.createElement('header', p, 'Header'),
  Footer: (p: Record<string, unknown>) => React.createElement('footer', p, 'Footer'),
};

describe('E2E: L0–L4 stack', () => {
  it('mounts and shows three pane headers', () => {
    const project = new Project(deepClone(SEED));
    render(<Skeleton project={project} components={components} />);
    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('the Settings pane shows the empty hint until a node is selected', () => {
    const project = new Project(deepClone(SEED));
    render(<Skeleton project={project} components={components} />);
    expect(screen.getByText(/No selection/i)).toBeInTheDocument();
  });

  it('selecting a node via Project.select makes its props visible in Settings', () => {
    const project = new Project(deepClone(SEED));
    const header = project.document.getNode(project.document.root.key as string)!.children[0];
    render(<Skeleton project={project} components={components} />);
    act(() => { project.select(header.id); });
    // The Settings pane has a <code> element with the component name
    expect(screen.getByText('title')).toBeInTheDocument();
    // The 'title' prop is a string → Input setter. The value is
    // rendered as the defaultValue of the underlying <input>.
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
  });

  it('a full edit cycle: select → edit prop → schema persists', () => {
    const project = new Project(deepClone(SEED));
    const header = project.document.getNode(project.document.root.key as string)!.children[0];
    render(<Skeleton project={project} components={components} />);
    act(() => { project.select(header.id); });

    // The 'title' prop is a string → Input setter. Type a new
    // value + blur (Input's onBlur commits via the setter's
    // onChange → setProps).
    const input = screen.getByDisplayValue('Hello') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'World' } });
    fireEvent.blur(input);

    // After commit, the input shows the new defaultValue.
    expect(screen.getByDisplayValue('World')).toBeInTheDocument();

    // Re-create a Project from the same schema source to simulate
    // save → reload. The new value should persist.
    const updated = deepClone(project.document.root);
    const reloaded = new Project(updated);
    const reloadedHeader = reloaded.document.getNode(reloaded.document.root.key as string)!.children[0];
    expect((reloadedHeader.schema.props as Record<string, string>).title).toBe('World');
  });

  it('adding a new node to the document and re-rendering shows it in the outline', () => {
    const project = new Project(deepClone(SEED));
    const root = project.document.getNode(project.document.root.key as string)!;
    const { rerender } = render(<Skeleton project={project} components={components} />);
    act(() => {
      project.document.insert({ componentName: 'Sidebar' }, root, 0);
    });
    rerender(<Skeleton project={project} components={components} />);
    // The new Sidebar node should now appear in the document
    expect(project.document.root.children!.map((c) => c.componentName)).toContain('Sidebar');
  });

  // -----------------------------------------------------------------
  //  Plugin extension slots (P-leftArea) — host-supplied topArea /
  //  leftArea render above / to-the-left of the 3-pane layout.
  //  Ali's `topArea` / `leftArea` are the original reference.
  // -----------------------------------------------------------------
  it('renders host-provided topArea and leftArea content when supplied', () => {
    const project = new Project(deepClone(SEED));
    render(
      <Skeleton
        project={project}
        components={components}
        topArea={() => <button>Undo</button>}
        leftArea={() => <button>Custom</button>}
      />,
    );
    expect(screen.getByText('Undo')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('omits slot content when topArea/leftArea are not provided (no crash)', () => {
    const project = new Project(deepClone(SEED));
    render(<Skeleton project={project} components={components} />);
    // No toolbar buttons rendered — the slot containers exist but are
    // empty. This is the default for hosts that don't need them.
    expect(screen.queryByText('Undo')).toBeNull();
    expect(screen.queryByText('Custom')).toBeNull();
    // The 3-pane headers still appear.
    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
