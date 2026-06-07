import { describe, it, expect } from 'vitest';
import { schemaToTreeNodes, findNode, defaultOpenIds } from '../src/tree';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

const schema: IPublicTypeNodeSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header', children: [
      { componentName: 'Logo' },
      { componentName: 'Nav' },
    ]},
    { componentName: 'Footer' },
  ],
};

describe('schemaToTreeNodes', () => {
  it('flattens the tree', () => {
    const nodes = schemaToTreeNodes(schema, 'r');
    expect(nodes.length).toBe(5); // Page + Header + Logo + Nav + Footer
  });
  it('assigns correct depth', () => {
    const nodes = schemaToTreeNodes(schema, 'r');
    const root = nodes.find((n) => n.componentName === 'Page')!;
    const header = nodes.find((n) => n.componentName === 'Header')!;
    const logo = nodes.find((n) => n.componentName === 'Logo')!;
    expect(root.depth).toBe(0);
    expect(header.depth).toBe(1);
    expect(logo.depth).toBe(2);
  });
  it('sets parentId correctly', () => {
    const nodes = schemaToTreeNodes(schema, 'r');
    const root = nodes.find((n) => n.componentName === 'Page')!;
    const header = nodes.find((n) => n.componentName === 'Header')!;
    const logo = nodes.find((n) => n.componentName === 'Logo')!;
    expect(root.parentId).toBe('');
    expect(header.parentId).toBe(root.id);
    expect(logo.parentId).toBe(header.id);
  });
  it('auto-expands first 2 levels', () => {
    const nodes = schemaToTreeNodes(schema, 'r');
    const root = nodes.find((n) => n.componentName === 'Page')!;
    const header = nodes.find((n) => n.componentName === 'Header')!;
    const logo = nodes.find((n) => n.componentName === 'Logo')!;
    expect(root.expanded).toBe(true);
    expect(header.expanded).toBe(true);
    expect(logo.expanded).toBe(false);
  });
});

describe('findNode', () => {
  it('returns the matching node or undefined', () => {
    const nodes = schemaToTreeNodes(schema, 'r');
    const id = nodes[1].id; // Header
    expect(findNode(nodes, id)?.componentName).toBe('Header');
    expect(findNode(nodes, 'nope')).toBeUndefined();
  });
});

describe('defaultOpenIds', () => {
  it('returns ids of expanded nodes (depth 0 and 1)', () => {
    const nodes = schemaToTreeNodes(schema, 'r');
    // Page (depth 0) + Header + Logo (both depth 1) are all expanded
    expect(defaultOpenIds(nodes).length).toBe(3);
  });
});
