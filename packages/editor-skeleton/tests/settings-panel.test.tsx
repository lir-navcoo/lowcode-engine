import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { deepClone } from '@monbolc/lowcode-utils';
import { Project } from '@monbolc/lowcode-designer';
import { SettingsPanel } from '../src/settings-panel';
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
    { componentName: 'A', props: { x: 1, label: 'foo' } },
  ],
};

describe('SettingsPanel', () => {
  it('shows the empty hint when nothing is selected', () => {
    const project = new Project(deepClone(SEED));
    render(<SettingsPanel project={project} />);
    expect(screen.getByText(/No selection/i)).toBeInTheDocument();
  });

  it('shows props of the selected node', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);
    render(<SettingsPanel project={project} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('label')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('"foo"')).toBeInTheDocument();
  });

  it('clicking a prop value opens an input; Enter commits the edit', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);
    render(<SettingsPanel project={project} />);
    // Click the VALUE '1' to enter edit mode (not the key 'x')
    const valueDiv = screen.getByText('1');
    fireEvent.click(valueDiv);
    // Now there's an input with current value '1'
    const input = screen.getByDisplayValue('1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Verify the document was updated
    const updated = project.document.getNode(a.id)!;
    expect(updated.schema.props?.x).toBe(42);
  });
});
