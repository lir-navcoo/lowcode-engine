import { describe, it, expect } from 'vitest';
import { OutlinePane } from '../src/api';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

const schema: IPublicTypeNodeSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'A' },
    { componentName: 'B', children: [{ componentName: 'B1' }] },
  ],
};

describe('OutlinePane', () => {
  it('setSchema populates nodes', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    expect(p.nodes.length).toBe(4);
  });

  it('clear empties nodes', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    p.clear();
    expect(p.nodes.length).toBe(0);
  });

  it('select sets selection and emits event', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    let captured: string[] | undefined;
    p.events.on('selectionChanged', (e) => { captured = e.ids; });
    const id = p.nodes[1].id;
    p.select([id]);
    expect(p.selectedIds).toEqual([id]);
    expect(captured).toEqual([id]);
  });

  it('addToSelection is idempotent', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    const id = p.nodes[1].id;
    p.select([p.nodes[0].id]);
    p.addToSelection(id);
    p.addToSelection(id);
    expect(p.selectedIds).toEqual([p.nodes[0].id, id]);
  });

  it('removeFromSelection removes the id', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    const a = p.nodes[0].id;
    const b = p.nodes[1].id;
    p.select([a, b]);
    p.removeFromSelection(a);
    expect(p.selectedIds).toEqual([b]);
  });

  it('expand / collapse / toggle work', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    const id = p.nodes[2].id; // B
    expect(p.isExpanded(id)).toBe(true);
    p.collapse(id);
    expect(p.isExpanded(id)).toBe(false);
    p.toggle(id);
    expect(p.isExpanded(id)).toBe(true);
  });

  it('expandAll / collapseAll', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    p.collapseAll();
    expect(p.nodes.every((n) => !n.expanded)).toBe(true);
    p.expandAll();
    expect(p.nodes.every((n) => n.expanded)).toBe(true);
  });

  it('rename updates title and emits event', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    let captured: string | undefined;
    p.events.on('renamed', (e) => { captured = e.title; });
    const id = p.nodes[0].id;
    p.rename(id, 'NewName');
    expect(p.getNode(id)?.title).toBe('NewName');
    expect(captured).toBe('NewName');
  });

  it('isSelected returns true for selected ids', () => {
    const p = new OutlinePane();
    p.setSchema(schema);
    const a = p.nodes[0].id;
    const b = p.nodes[1].id;
    p.select([a]);
    expect(p.isSelected(a)).toBe(true);
    expect(p.isSelected(b)).toBe(false);
  });
});
