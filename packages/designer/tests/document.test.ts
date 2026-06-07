import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deepClone } from '@monbolc/lowcode-utils';
import { DocumentModel } from '../src/document';
import { Node } from '../src/node';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const SEED_ROOT: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header' },
    { componentName: 'Body', children: [
      { componentName: 'Sidebar' },
      { componentName: 'Main' },
    ]},
  ],
};

describe('DocumentModel', () => {
  // Each test gets a freshly-cloned root so cross-test mutations don't leak.
  let root: IPublicTypeRootSchema;
  beforeEach(() => {
    root = deepClone(SEED_ROOT);
  });

  it('indexes the entire tree on construction', () => {
    const d = new DocumentModel(root);
    expect(d.nodes.size).toBe(5); // Page + Header + Body + Sidebar + Main
  });

  it('getNode returns a Node wrapper for an existing id', () => {
    const d = new DocumentModel(root);
    const page = d.getNode(d.root.key as string)!;
    const body = page.children[1];
    expect(body).toBeInstanceOf(Node);
    expect(body.componentName).toBe('Body');
  });

  it('setRoot clears the old nodes and indexes the new ones', () => {
    const d = new DocumentModel(root);
    expect(d.nodes.size).toBe(5);
    d.setRoot(deepClone({ fileName: 'q.json', componentName: 'X' }));
    expect(d.nodes.size).toBe(1);
  });

  it('insert appends a child and fires event', () => {
    const d = new DocumentModel(root);
    const fn = vi.fn();
    d.events.on('nodeAdded', fn);
    const page = d.getNode(d.root.key as string)!;
    const inserted = d.insert({ componentName: 'NewFooter' }, page, 99);
    expect(inserted.parent).toBe(page);
    expect(inserted.componentName).toBe('NewFooter');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('remove fires event and detaches from tree', () => {
    const d = new DocumentModel(root);
    const fn = vi.fn();
    d.events.on('nodeRemoved', fn);
    const page = d.getNode(d.root.key as string)!;
    const header = page.children[0];
    const headerId = header.id;
    d.remove(header);
    expect(d.getNode(headerId)).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('setProps fires event with changed keys', () => {
    const d = new DocumentModel(root);
    const fn = vi.fn();
    d.events.on('nodePropsChanged', fn);
    const header = d.getNode(d.root.key as string)!.children[0];
    d.setProps(header, { foo: 1, bar: 2 });
    const args = fn.mock.calls[0][0] as { changedKeys: string[] };
    expect(args.changedKeys).toContain('foo');
    expect(args.changedKeys).toContain('bar');
    expect(args.changedKeys.length).toBe(2);
  });

  it('rename fires event with old and new name', () => {
    const d = new DocumentModel(root);
    const fn = vi.fn();
    d.events.on('nodeRenamed', fn);
    const page = d.getNode(d.root.key as string)!;
    d.rename(page, 'App');
    expect(page.componentName).toBe('App');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('move moves the node and fires event', () => {
    const d = new DocumentModel(root);
    const fn = vi.fn();
    d.events.on('nodeMoved', fn);
    const page = d.getNode(d.root.key as string)!;
    const header = page.children[0];
    const body = page.children[1];
    d.move(header, body, 0);
    expect(body.children[0].componentName).toBe('Header');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('Node', () => {
  let root: IPublicTypeRootSchema;
  beforeEach(() => { root = deepClone(SEED_ROOT); });

  it('exposes id, componentName, depth, path', () => {
    const d = new DocumentModel(root);
    const sidebar = d.getNode(d.root.key as string)!
      .children.find((c) => c.componentName === 'Body')!
      .children.find((c) => c.componentName === 'Sidebar')!;
    expect(sidebar.componentName).toBe('Sidebar');
    expect(sidebar.depth).toBe(2);
    expect(sidebar.path).toBe('Page.Body.Sidebar');
  });
  it('isLeaf / hasChildren', () => {
    const d = new DocumentModel(root);
    const sidebar = d.getNode(d.root.key as string)!
      .children.find((c) => c.componentName === 'Body')!
      .children.find((c) => c.componentName === 'Sidebar')!;
    expect(sidebar.isLeaf).toBe(true);
    expect(sidebar.hasChildren).toBe(false);
  });
});
