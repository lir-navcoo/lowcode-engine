import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deepClone } from '@monbolc/lowcode-utils';
import { Project } from '../src/project';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const SEED_ROOT: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'A' },
    { componentName: 'B' },
  ],
};

describe('Project', () => {
  let root: IPublicTypeRootSchema;
  beforeEach(() => { root = deepClone(SEED_ROOT); });

  it('exposes a DocumentModel on construction', () => {
    const p = new Project(root);
    expect(p.document.root).toBe(root);
  });

  it('select / isSelected / clearSelection', () => {
    const p = new Project(root);
    const a = p.document.getNode(p.document.root.key as string)!.children[0].id;
    p.select(a);
    expect(p.isSelected(a)).toBe(true);
    expect(p.selectedIds).toEqual([a]);
    p.clearSelection();
    expect(p.selectedIds).toEqual([]);
  });

  it('selectMany + addToSelection + removeFromSelection', () => {
    const p = new Project(root);
    const ids = p.document.getNode(p.document.root.key as string)!.children.map((c) => c.id);
    p.selectMany(ids);
    expect(p.selectedIds).toEqual(ids);
    p.removeFromSelection(ids[0]);
    expect(p.selectedIds.length).toBe(1);
  });

  it('re-emits document events', () => {
    const p = new Project(root);
    const fn = vi.fn();
    p.events.on('nodeAdded', fn);
    p.document.insert({ componentName: 'C' }, p.document.getNode(p.document.root.key as string)!, 0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-emits dragon events', () => {
    const p = new Project(root);
    const fn = vi.fn();
    p.events.on('start', fn);
    p.dragon.start('A', 10, 20);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('getSelectedNodes returns Node wrappers for current selection', () => {
    const p = new Project(root);
    const a = p.document.getNode(p.document.root.key as string)!.children[0];
    p.select(a.id);
    const nodes = p.getSelectedNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0].componentName).toBe('A');
  });
});

describe('Dragon', () => {
  it('tracks start / move / commit', () => {
    const p = new Project(deepClone(SEED_ROOT));
    expect(p.dragon.isDragging).toBe(false);
    p.dragon.start('A', 0, 0);
    expect(p.dragon.isDragging).toBe(true);
    p.dragon.move(10, 20);
    expect(p.dragon.state.x).toBe(10);
    p.dragon.commit();
    expect(p.dragon.isDragging).toBe(false);
  });

  it('ignores start while a drag is in progress', () => {
    const p = new Project(deepClone(SEED_ROOT));
    p.dragon.start('A', 0, 0);
    p.dragon.start('B', 1, 1);
    expect(p.dragon.state.draggingNodeId).toBe('A');
  });

  it('ignores move/end when not dragging', () => {
    const p = new Project(deepClone(SEED_ROOT));
    const fn = vi.fn();
    p.dragon.events.on('move', fn);
    p.dragon.move(10, 10);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('DOM utils', () => {
  it('rectContains / rectsOverlap', async () => {
    const { rectContains, rectsOverlap } = await import('../src/dom');
    expect(rectContains({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 20, height: 20 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, width: 50, height: 50 }, { x: 25, y: 25, width: 50, height: 50 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 })).toBe(false);
  });

  it('tagElementWithNodeId / findNodeIdFromElement', async () => {
    const { tagElementWithNodeId, findNodeIdFromElement } = await import('../src/dom');
    const root = document.createElement('div');
    const child = document.createElement('span');
    root.appendChild(child);
    tagElementWithNodeId(child, 'n_42');
    expect(findNodeIdFromElement(child)).toBe('n_42');
    expect(findNodeIdFromElement(root)).toBeNull();
  });
});
