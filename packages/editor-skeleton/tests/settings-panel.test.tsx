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
    { componentName: 'A', props: { x: 1, label: 'foo', enabled: true } },
  ],
};

describe('SettingsPanel', () => {
  it('shows the empty hint when nothing is selected', () => {
    const project = new Project(deepClone(SEED));
    render(<SettingsPanel project={project} />);
    expect(screen.getByText(/No selection/i)).toBeInTheDocument();
  });

  it('shows props of the selected node (rendered through plugin-setters)', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);
    render(<SettingsPanel project={project} />);
    // Component name + prop keys are still plain text.
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
    expect(screen.getByText('label')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    // Prop values are inside BaseUI inputs with `defaultValue`; use
    // getByDisplayValue to find them (BaseUI sets defaultValue on
    // the underlying <input>).
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('foo')).toBeInTheDocument();
  });

  it('typing into a string setter input + blur commits the new value', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);
    render(<SettingsPanel project={project} />);

    // The 'label' prop is a string → Input setter. Type a new value
    // and blur (Input's onBlur commits).
    const input = screen.getByDisplayValue('foo') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bar' } });
    fireEvent.blur(input);

    const updated = project.document.getNode(a.id)!;
    expect(updated.schema.props?.label).toBe('bar');
  });

  it('typing into a number setter input + blur commits the new number', () => {
    const project = new Project(deepClone(SEED));
    const a = project.document.getNode(project.document.root.key as string)!.children[0];
    project.select(a.id);
    render(<SettingsPanel project={project} />);

    // The 'x' prop is a number → NumberField setter. Change the value
    // and blur to commit (NumberField's onValueChange fires on blur).
    const input = screen.getByDisplayValue('1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    const updated = project.document.getNode(a.id)!;
    expect(updated.schema.props?.x).toBe(42);
  });
});
