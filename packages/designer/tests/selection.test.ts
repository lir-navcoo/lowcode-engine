/**
 * @monbolc/lowcode-designer — Selection tests
 * Ali-mirror Phase D.I7b-prep.
 */
import { describe, it, expect, vi } from 'vitest';
import { Selection } from '../src/selection';
import { DocumentModel } from '../src/document';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

function mkDoc(childIds: string[]): DocumentModel {
  // Build a real schema tree for DocumentModel to index
  const children: IPublicTypeNodeSchema[] = childIds.map((id) => ({
    componentName: 'Test',
    key: id,
  } as IPublicTypeNodeSchema));
  return new DocumentModel({ componentName: 'Page', children } as never);
}

describe('Selection (Phase D.I7b-prep)', () => {
  it('initial state is empty', () => {
    const sel = new Selection(mkDoc([]));
    expect(sel.selected).toEqual([]);
    expect(sel.has('a')).toBe(false);
  });

  it('select(id) replaces the selection with a single id', () => {
    const sel = new Selection(mkDoc(['a', 'b']));
    sel.select('a');
    expect(sel.selected).toEqual(['a']);
    sel.select('b');
    expect(sel.selected).toEqual(['b']);
  });

  it('select(id) is a no-op if the same id is already the sole selection', () => {
    const sel = new Selection(mkDoc(['a']));
    const fn = vi.fn();
    sel.onSelectionChange(fn);
    sel.select('a');
    expect(fn).toHaveBeenCalledTimes(1);
    sel.select('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('add(id) appends; remove(id) deletes; has(id) checks', () => {
    const sel = new Selection(mkDoc(['a', 'b']));
    sel.add('a');
    sel.add('b');
    sel.add('a'); // no-op
    expect(sel.selected).toEqual(['a', 'b']);
    sel.remove('a');
    expect(sel.selected).toEqual(['b']);
    expect(sel.has('a')).toBe(false);
    expect(sel.has('b')).toBe(true);
  });

  it('selectAll(ids) sets the full set; emits selectionchange', () => {
    const sel = new Selection(mkDoc(['a', 'b', 'c']));
    const fn = vi.fn();
    sel.onSelectionChange(fn);
    sel.selectAll(['a', 'b', 'c']);
    expect(sel.selected).toEqual(['a', 'b', 'c']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clear() empties the selection; no-op if already empty', () => {
    const sel = new Selection(mkDoc(['a']));
    const fn = vi.fn();
    sel.onSelectionChange(fn);
    sel.clear(); // no-op
    expect(fn).not.toHaveBeenCalled();
    sel.select('a');
    sel.clear();
    expect(sel.selected).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('onSelectionChange: disposer stops further events', () => {
    const sel = new Selection(mkDoc(['a', 'b']));
    const fn = vi.fn();
    const off = sel.onSelectionChange(fn);
    sel.select('a');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    sel.select('b');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('getNodes: returns the selected nodes (length matches the selection)', () => {
    const sel = new Selection(mkDoc(['a', 'b']));
    sel.selectAll(['a', 'b']);
    const nodes = sel.getNodes();
    expect(nodes.length).toBe(2);
  });

  it('getTopNodes: returns all selected when no selected is an ancestor of another', () => {
    // Two flat nodes (no parent-child relationship between them) —
    // both are top-level
    const sel = new Selection(mkDoc(['a', 'b']));
    sel.selectAll(['a', 'b']);
    const topNodes = sel.getTopNodes();
    expect(topNodes.length).toBe(2);
  });

  it('containsNode: returns true if any selected node is an ancestor of the query', () => {
    // Ali-faithful: the slim `Node.contains` walks `parent` chain.
    // We test the lookup behavior: selecting a non-existent id
    // returns false; selecting a real id returns true when the
    // query is that node itself.
    const sel = new Selection(mkDoc(['a']));
    sel.select('a');
    const node = (sel as unknown as { _doc: { getNode: (id: string) => unknown } })._doc.getNode('a');
    expect(sel.containsNode(node as never, false)).toBe(true);
  });

  it('containsNode: returns false if no selected node is an ancestor', () => {
    const sel = new Selection(mkDoc(['a', 'b']));
    sel.select('a');
    const bNode = (sel as unknown as { _doc: { getNode: (id: string) => unknown } })._doc.getNode('b');
    expect(sel.containsNode(bNode as never, false)).toBe(false);
  });

  it('DocumentModel.selection: lazy-init singleton', () => {
    const doc = mkDoc([]);
    const sel1 = doc.selection;
    const sel2 = doc.selection;
    expect(sel1).toBe(sel2);
  });

  it('dispose: prunes dangling ids (whose node was removed)', () => {
    const sel = new Selection(mkDoc(['a', 'b']));
    sel.selectAll(['a', 'b']);
    // Simulate node removal by re-constructing a doc without 'b'
    const slim = sel as unknown as { _doc: { _nodes: Map<string, unknown> } };
    slim._doc._nodes.delete('b');
    sel.dispose();
    expect(sel.selected).toEqual(['a']);
  });
});
