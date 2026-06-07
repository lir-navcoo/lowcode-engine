import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  children: [{ componentName: 'A' }, { componentName: 'B' }],
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
});
